"""Local package API shared by Vite and the installed GTK launcher."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlsplit

APT_ID = re.compile(r'[a-z0-9][a-z0-9+.\-]{0,127}')
FLATPAK_ID = re.compile(r'[A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+){2,}')
MAX_BODY = 8192
MAX_BATCH_BODY = 65536
MAX_BATCH_ITEMS = 500
APT_QUERY_FORMAT = '${binary:Package}\t${db:Status-Status}\t${Essential}\t${Protected}\t${Priority}\n'
BASE_PACKAGES = {
    'apt', 'dpkg', 'libc6', 'init', 'systemd', 'systemd-sysv', 'udev',
    'dbus', 'dbus-user-session', 'sudo', 'policykit-1', 'polkitd', 'pkexec',
    'network-manager', 'linux-firmware', 'linux-generic', 'linux-image-generic',
    'initramfs-tools', 'initramfs-tools-core', 'mintsystem',
    'ubuntu-system-adjustments', 'mint-install-pro', 'python3', 'python3-minimal',
}
DESKTOP_PACKAGES = {
    'cinnamon', 'cinnamon-core', 'cinnamon-session', 'cinnamon-settings-daemon',
    'muffin', 'lightdm', 'slick-greeter', 'xorg', 'xserver-xorg', 'xserver-xorg-core',
    'mate-desktop', 'mate-session-manager', 'mate-panel', 'marco',
    'xfce4', 'xfce4-session', 'xfwm4', 'xfce4-panel',
}


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def run(args, timeout=30):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, 'DEBIAN_FRONTEND': 'noninteractive', 'LC_ALL': 'C.UTF-8'})


def protection_reason(app_id, essential='', protected='', priority=''):
    if essential == 'yes':
        return 'Pacote essencial para o funcionamento do sistema.'
    if protected == 'yes':
        return 'Componente protegido pelo gerenciador de pacotes.'
    if priority == 'required':
        return 'Pacote obrigatório da base do sistema.'
    kernel = os.uname().release
    if app_id in {f'linux-image-{kernel}', f'linux-image-unsigned-{kernel}',
                  f'linux-modules-{kernel}', f'linux-modules-extra-{kernel}'}:
        return 'Componente do kernel que está em uso neste momento.'
    if app_id in DESKTOP_PACKAGES:
        return 'Componente da interface gráfica e da sessão do sistema.'
    if app_id in BASE_PACKAGES or app_id.startswith(('mint-meta-', 'grub-', 'shim-')):
        return 'Componente de base necessário para manter o sistema funcionando.'
    return None


def apt_inventory():
    try:
        proc = run(['/usr/bin/dpkg-query', '-W', '-f=' + APT_QUERY_FORMAT])
    except (OSError, subprocess.TimeoutExpired) as err:
        raise ApiError(503, 'Não foi possível verificar os pacotes protegidos do sistema.') from err
    if proc.returncode:
        raise ApiError(503, 'Não foi possível verificar os pacotes protegidos do sistema.')
    if not proc.stdout.strip():
        raise ApiError(503, 'A consulta dos pacotes protegidos está vazia.')
    packages, protections = set(), {}
    for line in proc.stdout.splitlines():
        fields = line.split('\t')
        if len(fields) != 5:
            raise ApiError(503, 'A consulta dos pacotes protegidos está incompleta.')
        app_id, status, essential, protected, priority = fields
        app_id = app_id.split(':')[0]
        if status == 'installed':
            packages.add(app_id)
        if status not in ('not-installed', 'config-files'):
            reason = protection_reason(app_id, essential, protected, priority)
            if reason:
                protections[app_id] = reason
    return sorted(packages), protections


def assert_safe_apt_removal(app_ids):
    if not app_ids:
        return
    _packages, protections = apt_inventory()
    blocked = sorted(set(app_ids) & protections.keys())
    if blocked:
        raise ApiError(403, 'Remoção bloqueada: ' + ', '.join(blocked) +
                       '. Esses pacotes são componentes protegidos do sistema.')
    try:
        proc = run(['/usr/bin/apt-get', '--simulate', 'remove', '--', *app_ids])
    except (OSError, subprocess.TimeoutExpired) as err:
        raise ApiError(503, 'Não foi possível verificar o impacto da remoção. Nenhum pacote foi removido.') from err
    if proc.returncode:
        raise ApiError(503, 'Não foi possível verificar o impacto da remoção. ' + (proc.stderr or proc.stdout)[-2000:])
    removals = {line.split()[1].split(':')[0] for line in proc.stdout.splitlines()
                if line.startswith('Remv ') and len(line.split()) >= 2}
    blocked = sorted(removals & protections.keys())
    if blocked:
        raise ApiError(403, 'Remoção bloqueada: essa ação também removeria componentes protegidos do sistema (' +
                       ', '.join(blocked) + ').')


def installed():
    result = {'apt': [], 'flatpaks': [], 'flatpakScopes': {}, 'protectedPackages': {},
              'aptStatus': 'unknown', 'flatpakStatus': 'unknown'}
    try:
        result['apt'], result['protectedPackages'] = apt_inventory()
        result['aptStatus'] = 'available'
    except ApiError:
        pass
    try:
        for scope in ('user', 'system'):
            proc = run(['flatpak', 'list', '--' + scope, '--app', '--columns=application'])
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr)
            for app_id in proc.stdout.splitlines():
                if app_id.strip():
                    result['flatpakScopes'].setdefault(app_id.strip(), []).append(scope)
        result['flatpaks'] = sorted(result['flatpakScopes'])
        result['flatpakStatus'] = 'available'
    except FileNotFoundError:
        result['flatpakStatus'] = 'missing'
    except (OSError, RuntimeError, subprocess.TimeoutExpired):
        pass
    return result


def validate_package(data):
    if not isinstance(data, dict):
        raise ApiError(400, 'Payload deve ser um objeto JSON.')
    app_id, kind = data.get('id'), data.get('packageType')
    if kind not in ('apt', 'flatpak'):
        raise ApiError(400, 'Tipo de pacote deve ser apt ou flatpak.')
    pattern = FLATPAK_ID if kind == 'flatpak' else APT_ID
    if not isinstance(app_id, str) or not pattern.fullmatch(app_id):
        raise ApiError(400, 'Identificador de pacote inválido.')
    return app_id, kind


def operate(action, data):
    app_id, kind = validate_package(data)
    if action == 'launch':
        if kind == 'flatpak':
            snapshot = installed()
            scopes = snapshot['flatpakScopes'].get(app_id, [])
            if snapshot['flatpakStatus'] != 'available' or not scopes:
                raise ApiError(409, 'Aplicativo não está instalado ou não pôde ser consultado.')
            command = ['flatpak', 'run', '--' + scopes[0], app_id]
        else:
            proc = run(['dpkg-query', '-L', '--', app_id])
            entries = sorted(p for p in proc.stdout.splitlines()
                             if p.startswith('/usr/share/applications/') and p.endswith('.desktop')
                             and Path(p).is_file())
            if proc.returncode or not entries:
                raise ApiError(409, 'Este pacote não possui um lançador gráfico instalado.')
            command = ['gio', 'launch', entries[0]]
        subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
        return {'success': True, 'output': 'Solicitação de abertura enviada ao sistema.'}
    if kind == 'apt':
        if action == 'uninstall':
            # Share the same checks before and after authorization with batches.
            for event in operate_batch(prepare_batch({'operations': [{**data, 'action': action}]})):
                if 'result' in event:
                    return event['result']
            raise ApiError(503, 'A remoção não retornou um resultado.')
        commands = [['pkexec', 'apt-get', 'install', '--no-remove', '-y', '--', app_id]]
    elif action == 'install':
        commands = [['flatpak', 'install', '--user', '-y', '--noninteractive', 'flathub', '--', app_id]]
    else:
        snapshot = installed()
        if snapshot['flatpakStatus'] != 'available':
            raise ApiError(503, 'Não foi possível consultar as instalações Flatpak.')
        scopes = snapshot['flatpakScopes'].get(app_id, [])
        if not scopes:
            return {'success': True, 'output': 'Aplicativo já está removido.'}
        commands = [['flatpak', 'uninstall', '--' + scope, '-y', '--noninteractive', '--', app_id]
                    for scope in scopes]
    output = []
    for command in commands:
        proc = run(command, timeout=300)
        output.append(proc.stdout + proc.stderr)
        if proc.returncode:
            return {'success': False, 'code': proc.returncode, 'output': '\n'.join(output)[-8000:]}
    return {'success': True, 'output': '\n'.join(output)[-8000:]}


def validate_batch(data):
    operations = data.get('operations') if isinstance(data, dict) else None
    if not isinstance(operations, list) or not 0 < len(operations) <= MAX_BATCH_ITEMS:
        raise ApiError(400, f'O lote deve conter de 1 a {MAX_BATCH_ITEMS} operações.')
    validated, seen = [], set()
    for item in operations:
        app_id, kind = validate_package(item)
        action = item.get('action')
        if action not in ('install', 'uninstall') or (kind, app_id) in seen:
            raise ApiError(400, 'Ação inválida ou pacote repetido no lote.')
        seen.add((kind, app_id))
        validated.append({'id': app_id, 'packageType': kind, 'action': action})
    return validated


def command_result(command):
    try:
        proc = run(command, timeout=300)
        return {'success': proc.returncode == 0, 'code': proc.returncode,
                'output': (proc.stdout + proc.stderr)[-8000:]}
    except subprocess.TimeoutExpired:
        return {'success': False, 'output': 'A operação excedeu o tempo limite. Consulte o estado do sistema antes de tentar novamente.'}
    except OSError as err:
        return {'success': False, 'output': str(err)}


def privileged_batch(data):
    # This entry point never starts the HTTP server. Revalidate the entire fixed
    # plan before executing anything, including when invoked directly via pkexec.
    operations = validate_batch(data)
    if any(item['packageType'] == 'flatpak' and item['action'] != 'uninstall'
           for item in operations):
        raise ApiError(400, 'O auxiliar só remove Flatpaks do sistema.')
    assert_safe_apt_removal([item['id'] for item in operations
                             if item['packageType'] == 'apt' and item['action'] == 'uninstall'])
    for index, item in enumerate(operations):
        print(json.dumps({'index': index, 'status': 'processing'}), flush=True)
        if item['packageType'] == 'apt':
            if item['action'] == 'uninstall':
                try:
                    # Earlier steps or external transactions may change dependencies.
                    assert_safe_apt_removal([item['id']])
                except ApiError as err:
                    print(json.dumps({'index': index, 'result': {'success': False, 'blocked': True,
                                                                'output': str(err)}}), flush=True)
                    continue
            command = ['/usr/bin/apt-get', 'install' if item['action'] == 'install' else 'remove',
                       *(['--no-remove'] if item['action'] == 'install' else []),
                       '-y', '--', item['id']]
        else:
            command = ['/usr/bin/flatpak', 'uninstall', '--system', '-y', '--noninteractive', '--', item['id']]
        print(json.dumps({'index': index, 'result': command_result(command)}), flush=True)


def prepare_batch(data):
    operations = validate_batch(data)
    assert_safe_apt_removal([item['id'] for item in operations
                             if item['packageType'] == 'apt' and item['action'] == 'uninstall'])
    snapshot = None
    if any(item['packageType'] == 'flatpak' and item['action'] == 'uninstall'
           for item in operations):
        snapshot = installed()
        if snapshot['flatpakStatus'] != 'available':
            raise ApiError(503, 'Não foi possível consultar as instalações Flatpak.')
    privileged, user, removed = [], [], []
    for index, item in enumerate(operations):
        if item['packageType'] == 'apt':
            privileged.append((index, item))
        elif item['action'] == 'install':
            user.append((index, ['flatpak', 'install', '--user', '-y', '--noninteractive', 'flathub', '--', item['id']]))
        else:
            scopes = snapshot['flatpakScopes'].get(item['id'], [])
            if 'system' in scopes:
                privileged.append((index, item))
            if 'user' in scopes:
                user.append((index, ['flatpak', 'uninstall', '--user', '-y', '--noninteractive', '--', item['id']]))
            if not scopes:
                removed.append(index)
    return operations, privileged, user, removed


def operate_batch(plan):
    operations, privileged, user, removed = plan
    results = {}
    user_indices = {index for index, _command in user}
    for index in removed:
        yield {'index': index, 'result': {'success': True, 'output': 'Aplicativo já está removido.'}}
    if privileged:
        command = ['pkexec', '/usr/bin/python3', '-I', str(Path(__file__).resolve()),
                   '--batch-helper', json.dumps({'operations': [item for _index, item in privileged]})]
        # Only this process holds privileges, for this immutable batch. User
        # Flatpaks stay in the desktop user's process, after administrative work.
        with tempfile.TemporaryFile(mode='w+') as errors:
            with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                  stderr=errors, text=True) as proc:
                for line in proc.stdout:
                    event = json.loads(line)
                    index = privileged[event['index']][0]
                    if event.get('status') == 'processing':
                        yield {'index': index, 'status': 'processing'}
                    else:
                        results[index] = event['result']
                        if index not in user_indices:
                            yield {'index': index, 'result': results[index]}
                code = proc.wait()
            missing = {index for index, _item in privileged} - results.keys()
            if code or missing:
                errors.seek(0)
                message = ('Autorização administrativa cancelada.' if code == 126 else
                           'Não foi possível obter autorização administrativa.' if code == 127 else
                           errors.read()[-8000:] or
                           ('O auxiliar administrativo encerrou antes de concluir o lote. Consulte o estado do sistema.'
                            if missing else 'O auxiliar administrativo falhou.'))
                # Cancellation or incomplete output never retries authorization
                # per package, nor starts the remaining user operations.
                for index in range(len(operations)):
                    if index not in results and index not in removed:
                        yield {'index': index, 'result': {'success': False, 'code': code, 'output': message}}
                    elif index in user_indices and index in results:
                        yield {'index': index, 'result': {'success': False, 'code': code, 'output': message}}
                return
    for index, command in user:
        yield {'index': index, 'status': 'processing'}
        result = command_result(command)
        if index in results:
            previous = results[index]
            result = {**result, 'success': previous['success'] and result['success'],
                      'output': (previous['output'] + '\n' + result['output'])[-8000:]}
        yield {'index': index, 'result': result}


class PackageServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, directory=None):
        self.operation_lock = threading.Lock()
        self.serve_files = directory is not None
        super().__init__(address, functools.partial(PackageHandler, directory=directory))


class PackageHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def respond(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorize(self, mutation=False):
        host = self.headers.get('Host', '')
        try:
            parsed = urlsplit('http://' + host)
            if (self.client_address[0] not in ('127.0.0.1', '::1') or
                    parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or
                    parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment):
                raise ValueError()
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + host:
                raise ValueError()
            # JSON requests are not simple cross-origin requests; no CORS grants.
            if mutation and (not origin or self.headers.get_content_type() != 'application/json'):
                raise ValueError()
            if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                raise ValueError()
        except ValueError:
            raise ApiError(403, 'Origem não autorizada.')

    def do_GET(self):
        try:
            self.authorize()
            if self.path == '/api/installed':
                self.respond(200, installed())
            elif self.path.startswith('/api/') or not self.server.serve_files:
                self.respond(404, {'success': False, 'error': 'Recurso não encontrado.'})
            else:
                super().do_GET()
        except ApiError as err:
            self.respond(err.status, {'success': False, 'error': str(err)})

    def do_POST(self):
        locked = False
        streaming = False
        try:
            self.authorize(mutation=True)
            if self.path not in ('/api/install', '/api/uninstall', '/api/launch', '/api/batch'):
                raise ApiError(404, 'Recurso não encontrado.')
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                raise ApiError(400, 'Comprimento inválido.')
            limit = MAX_BATCH_BODY if self.path == '/api/batch' else MAX_BODY
            if not 0 < length <= limit or self.headers.get('Transfer-Encoding'):
                raise ApiError(413, 'Payload inválido ou muito grande.')
            locked = self.server.operation_lock.acquire(blocking=False)
            if not locked:
                raise ApiError(429, 'Outra operação já está em andamento.')
            self.connection.settimeout(10)
            try:
                data = json.loads(self.rfile.read(length))
            except (ValueError, UnicodeError):
                raise ApiError(400, 'JSON inválido.')
            if self.path == '/api/batch':
                plan = prepare_batch(data)
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.close_connection = True
                streaming = True
                for event in operate_batch(plan):
                    self.write_event(event)
            else:
                self.respond(200, operate(self.path.rsplit('/', 1)[1], data))
        except ApiError as err:
            self.respond(err.status, {'success': False, 'error': str(err)})
        except subprocess.TimeoutExpired:
            self.respond(504, {'success': False, 'error': 'A operação excedeu o tempo limite. Consulte o estado do sistema antes de tentar novamente.'})
        except (OSError, ValueError, KeyError, IndexError) as err:
            if streaming:
                try:
                    self.write_event({'error': str(err)})
                except OSError:
                    pass
            else:
                self.respond(503, {'success': False, 'error': str(err)})
        finally:
            if locked:
                self.server.operation_lock.release()

    def write_event(self, event):
        self.wfile.write((json.dumps(event) + '\n').encode())
        self.wfile.flush()

    def list_directory(self, path):
        self.send_error(404)
        return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--batch-helper')
    args = parser.parse_args()
    if args.batch_helper is not None:
        try:
            privileged_batch(json.loads(args.batch_helper))
        except (ApiError, ValueError) as err:
            print(str(err), file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    with PackageServer(('127.0.0.1', args.port)) as server:
        print(json.dumps({'port': server.server_port}), flush=True)
        server.serve_forever()
