"""Behavioral API tests. No test invokes a real package transaction."""
import contextlib
import io
import http.client
import json
from pathlib import Path
import subprocess
import threading
import unittest
from unittest.mock import patch, Mock, MagicMock
import package_backend as backend


class PackageApiTests(unittest.TestCase):
    def setUp(self):
        self.server = backend.PackageServer(('127.0.0.1', 0))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host = f'127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, data=None, path='/api/install', method='POST', **headers):
        conn = http.client.HTTPConnection(self.host, timeout=3)
        body = json.dumps(data if data is not None else {'id': 'docker.io', 'packageType': 'apt'})
        defaults = {'Content-Type': 'application/json', 'Origin': 'http://' + self.host}
        defaults.update(headers)
        conn.request(method, path, body, defaults)
        res = conn.getresponse()
        status, payload = res.status, json.loads(res.read())
        conn.close()
        return status, payload

    def assert_lock_released(self):
        # The client can receive the body just before the handler's finally
        # executes. Wait on the lock itself instead of racing that cleanup.
        acquired = self.server.operation_lock.acquire(timeout=1)
        self.assertTrue(acquired, 'A operação não liberou o bloqueio.')
        if acquired:
            self.server.operation_lock.release()

    @patch.object(backend, 'run')
    def test_apt_with_dot_and_real_failure(self, run):
        run.return_value = Mock(returncode=100, stdout='', stderr='not found')
        status, result = self.request()
        self.assertEqual(status, 200)
        self.assertFalse(result['success'])
        self.assertEqual(run.call_args.args[0], ['pkexec', 'apt-get', 'install', '--no-remove', '-y', '--', 'docker.io'])

    @patch.object(backend, 'run')
    def test_rejects_invalid_inputs_before_commands(self, run):
        for data in ([1], None, {'id': '--help', 'packageType': 'apt'},
                     {'id': 'foo;id', 'packageType': 'apt'}, {'id': 'docker.io'},
                     {'id': 'org.test.App\n', 'packageType': 'flatpak'},
                     {'id': 'pkg', 'packageType': 'unknown'}):
            if data is None:
                continue
            self.assertEqual(self.request(data)[0], 400)
        run.assert_not_called()

    @patch.object(backend, 'operate')
    def test_csrf_origin_host_and_content_type(self, operate):
        for headers in ({'Origin': 'https://evil.example'}, {'Origin': ''},
                        {'Origin': 'null'}, {'Origin': 'http://localhost:9999'},
                        {'Content-Type': 'text/plain'}, {'Host': 'evil.example'},
                        {'Sec-Fetch-Site': 'cross-site'}):
            self.assertEqual(self.request(**headers)[0], 403)
        operate.assert_not_called()

    @patch.object(backend, 'operate')
    def test_payload_limit(self, operate):
        self.assertEqual(self.request({'id': 'x' * 9000, 'packageType': 'apt'})[0], 413)
        operate.assert_not_called()

    @patch.object(backend, 'operate')
    def test_busy_operation_returns_429(self, operate):
        self.server.operation_lock.acquire()
        try:
            self.assertEqual(self.request()[0], 429)
            operate.assert_not_called()
        finally:
            self.server.operation_lock.release()

    def test_concurrent_request_is_rejected_while_read_still_works(self):
        started, finish = threading.Event(), threading.Event()
        outcomes = []
        def slow_operation(action, data):
            started.set()
            finish.wait(3)
            return {'success': True}
        with patch.object(backend, 'operate', slow_operation), patch.object(backend, 'installed', return_value={'apt': []}):
            worker = threading.Thread(target=lambda: outcomes.append(self.request()))
            worker.start()
            try:
                self.assertTrue(started.wait(2))
                self.assertEqual(self.request()[0], 429)
                self.assertEqual(self.request(path='/api/installed', method='GET')[0], 200)
            finally:
                finish.set()
                worker.join()
            self.assertEqual(outcomes[0][1]['success'], True)

    @patch.object(backend, 'operate', side_effect=FileNotFoundError('pkexec missing'))
    def test_missing_command_releases_lock(self, operate):
        self.assertEqual(self.request()[0], 503)
        self.assert_lock_released()

    @patch.object(backend, 'operate', side_effect=subprocess.TimeoutExpired('apt-get', 300))
    def test_timeout_is_failure(self, operate):
        status, result = self.request()
        self.assertEqual(status, 504)
        self.assertFalse(result['success'])
        self.assert_lock_released()

    @patch.object(backend, 'run')
    def test_installed_apt_and_both_flatpak_scopes(self, run):
        run.side_effect = [Mock(returncode=0, stdout='docker.io\tinstalled\tno\tno\toptional\nfoo:amd64\tinstalled\tyes\tno\trequired\ngone\tconfig-files\tyes\tno\trequired\n'),
                           Mock(returncode=0, stdout='org.test.App\n'),
                           Mock(returncode=0, stdout='org.test.App\norg.test.Other\n')]
        status, data = self.request(path='/api/installed', method='GET')
        self.assertEqual(status, 200)
        self.assertEqual(data['apt'], ['docker.io', 'foo'])
        self.assertEqual(data['protectedPackages'], {'foo': 'Pacote essencial para o funcionamento do sistema.'})
        self.assertEqual(data['flatpakScopes']['org.test.App'], ['user', 'system'])
        self.assertEqual(data['flatpaks'], ['org.test.App', 'org.test.Other'])

    @patch.object(backend, 'run')
    def test_missing_flatpak_preserves_apt(self, run):
        run.side_effect = [Mock(returncode=0, stdout='vlc\tinstalled\tno\tno\toptional\n'), FileNotFoundError()]
        result = backend.installed()
        self.assertEqual(result['apt'], ['vlc'])
        self.assertEqual(result['flatpakStatus'], 'missing')

    @patch.object(backend, 'installed', return_value={'flatpakStatus': 'available', 'flatpakScopes': {'org.test.App': ['user', 'system']}})
    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='', stderr=''))
    def test_uninstall_covers_both_scopes(self, run, installed):
        result = backend.operate('uninstall', {'id': 'org.test.App', 'packageType': 'flatpak'})
        self.assertTrue(result['success'])
        self.assertEqual([c.args[0][2] for c in run.call_args_list], ['--user', '--system'])

    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'installed', return_value={'flatpakStatus': 'available', 'flatpakScopes': {'org.test.App': ['system']}})
    def test_launch_uses_installed_scope(self, installed, popen):
        self.assertTrue(backend.operate('launch', {'id': 'org.test.App', 'packageType': 'flatpak'})['success'])
        self.assertEqual(popen.call_args.args[0], ['flatpak', 'run', '--system', 'org.test.App'])

    @patch.object(backend, 'operate_batch')
    def test_batch_stream_and_lock(self, operate_batch):
        def events(_plan):
            self.assertTrue(self.server.operation_lock.locked())
            yield {'index': 0, 'status': 'processing'}
            yield {'index': 0, 'result': {'success': True, 'output': 'ok'}}
        operate_batch.side_effect = events
        conn = http.client.HTTPConnection(self.host, timeout=3)
        conn.request('POST', '/api/batch', json.dumps({'operations': [
            {'id': 'vlc', 'packageType': 'apt', 'action': 'install'}
        ]}), {'Content-Type': 'application/json', 'Origin': 'http://' + self.host})
        res = conn.getresponse()
        self.assertEqual(res.status, 200)
        self.assertEqual(res.getheader('Content-Type'), 'application/x-ndjson')
        self.assertEqual(len(res.read().splitlines()), 2)
        conn.close()
        self.assert_lock_released()

    @patch.object(backend.subprocess, 'Popen')
    def test_batch_endpoint_rejects_origin_invalid_plan_and_payload(self, popen):
        data = {'operations': [{'id': 'vlc', 'packageType': 'apt', 'action': 'install'}]}
        self.assertEqual(self.request(data, path='/api/batch', Origin='https://evil.example')[0], 403)
        self.assertEqual(self.request({'operations': [{'id': '--help', 'packageType': 'apt', 'action': 'install'}]}, path='/api/batch')[0], 400)
        self.assertEqual(self.request({'operations': ['x' * 66000]}, path='/api/batch')[0], 413)
        popen.assert_not_called()
        self.assert_lock_released()

    @patch.object(backend, 'apt_inventory', return_value=(['bash'], {'bash': 'Pacote essencial.'}))
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run')
    def test_protected_removal_rejected_individually_and_in_batch_before_auth(self, run, popen, inventory):
        status, result = self.request({'id': 'bash', 'packageType': 'apt', 'protected': False}, path='/api/uninstall')
        self.assertEqual(status, 403)
        self.assertIn('Remoção bloqueada', result['error'])
        data = {'operations': [{'id': 'vlc', 'packageType': 'apt', 'action': 'install'},
                               {'id': 'bash', 'packageType': 'apt', 'action': 'uninstall'}]}
        self.assertEqual(self.request(data, path='/api/batch')[0], 403)
        run.assert_not_called()
        popen.assert_not_called()
        self.assert_lock_released()

    def test_launcher_compiles(self):
        code = Path(__file__).with_name('launcher.py').read_text()
        compile(code, '<launcher>', 'exec')


class BatchTests(unittest.TestCase):
    def setUp(self):
        guard = patch.object(backend, 'assert_safe_apt_removal')
        guard.start()
        self.addCleanup(guard.stop)

    def item(self, app_id, kind='apt', action='install'):
        return {'id': app_id, 'packageType': kind, 'action': action}

    def helper_process(self, events=(), code=0):
        proc = MagicMock()
        proc.__enter__.return_value = proc
        proc.stdout = io.StringIO(''.join(json.dumps(event) + '\n' for event in events))
        proc.wait.return_value = code
        return proc

    @patch.object(backend, 'run')
    @patch.object(backend.subprocess, 'Popen')
    def test_mixed_batch_uses_one_authorization_and_preserves_user_scope(self, popen, run):
        items = [self.item('vlc'), self.item('gimp', action='uninstall'),
                 self.item('org.test.System', 'flatpak', 'uninstall'),
                 self.item('org.test.New', 'flatpak')]
        success = {'success': True, 'output': 'ok'}
        popen.return_value = self.helper_process([
            event for index in range(3) for event in
            ({'index': index, 'status': 'processing'}, {'index': index, 'result': success})
        ])
        run.return_value = Mock(returncode=0, stdout='user ok', stderr='')
        with patch.object(backend, 'installed', return_value={
            'flatpakStatus': 'available', 'flatpakScopes': {'org.test.System': ['user', 'system']}
        }):
            events = list(backend.operate_batch(backend.prepare_batch({'operations': items})))
        popen.assert_called_once()
        command = popen.call_args.args[0]
        self.assertEqual(command[:3], ['pkexec', '/usr/bin/python3', '-I'])
        self.assertEqual(json.loads(command[-1])['operations'], items[:3])
        self.assertEqual([call.args[0] for call in run.call_args_list], [
            ['flatpak', 'uninstall', '--user', '-y', '--noninteractive', '--', 'org.test.System'],
            ['flatpak', 'install', '--user', '-y', '--noninteractive', 'flathub', '--', 'org.test.New']
        ])
        final = {event['index']: event['result'] for event in events if 'result' in event}
        self.assertEqual(len(final), 4)
        self.assertTrue(all(result['success'] for result in final.values()))
        self.assertEqual(final[2]['output'], 'ok\nuser ok')

    @patch.object(backend, 'run')
    @patch.object(backend.subprocess, 'Popen')
    def test_cancelled_authorization_stops_entire_batch_without_retry(self, popen, run):
        popen.return_value = self.helper_process(code=126)
        items = [self.item('vlc'), self.item('gimp', action='uninstall'), self.item('org.test.App', 'flatpak')]
        events = list(backend.operate_batch(backend.prepare_batch({'operations': items})))
        popen.assert_called_once()
        run.assert_not_called()
        self.assertEqual(len(events), 3)
        self.assertTrue(all(event['result']['success'] is False for event in events))
        self.assertTrue(all('cancelada' in event['result']['output'] for event in events))

    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='ok', stderr=''))
    @patch.object(backend.subprocess, 'Popen')
    def test_user_only_batch_never_requests_admin_authorization(self, popen, run):
        items = [self.item('org.test.One', 'flatpak'), self.item('org.test.Two', 'flatpak')]
        events = list(backend.operate_batch(backend.prepare_batch({'operations': items})))
        popen.assert_not_called()
        self.assertEqual(run.call_count, 2)
        self.assertEqual(len([event for event in events if 'result' in event]), 2)

    @patch.object(backend, 'run')
    @patch.object(backend.subprocess, 'Popen')
    def test_validates_whole_batch_before_any_execution(self, popen, run):
        for bad in (self.item('--help'), self.item('vlc', action='launch'),
                    self.item('org.test.App\n', 'flatpak'), self.item('vlc')):
            with self.assertRaises(backend.ApiError):
                backend.prepare_batch({'operations': [self.item('vlc'), bad]})
        for invalid in ({}, {'operations': []}, {'operations': [self.item('vlc')] * 501}, [1]):
            with self.assertRaises(backend.ApiError):
                backend.prepare_batch(invalid)
        popen.assert_not_called()
        run.assert_not_called()

    @patch.object(backend, 'run')
    def test_helper_revalidates_all_inputs_and_rejects_flatpak_install(self, run):
        with self.assertRaises(backend.ApiError):
            backend.privileged_batch({'operations': [self.item('vlc'), self.item('org.test.App', 'flatpak')]})
        with self.assertRaises(backend.ApiError):
            backend.privileged_batch({'operations': [self.item('vlc'), self.item('bad;id')]})
        run.assert_not_called()

    @patch.object(backend, 'run')
    def test_helper_executes_entire_mixed_plan_without_nested_pkexec(self, run):
        run.side_effect = [Mock(returncode=100, stdout='', stderr='apt failed'),
                           subprocess.TimeoutExpired('apt-get', 300),
                           Mock(returncode=0, stdout='removed', stderr='')]
        items = [self.item('vlc'), self.item('gimp', action='uninstall'), self.item('org.test.App', 'flatpak', 'uninstall')]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            backend.privileged_batch({'operations': items})
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual([event['result']['success'] for event in events if 'result' in event], [False, False, True])
        self.assertEqual([call.args[0] for call in run.call_args_list], [
            ['/usr/bin/apt-get', 'install', '--no-remove', '-y', '--', 'vlc'],
            ['/usr/bin/apt-get', 'remove', '-y', '--', 'gimp'],
            ['/usr/bin/flatpak', 'uninstall', '--system', '-y', '--noninteractive', '--', 'org.test.App']
        ])

    @patch.object(backend, 'installed', return_value={'flatpakStatus': 'unknown'})
    @patch.object(backend.subprocess, 'Popen')
    def test_unknown_flatpak_scope_rejects_batch_before_auth(self, popen, installed):
        with self.assertRaises(backend.ApiError):
            backend.prepare_batch({'operations': [self.item('vlc'), self.item('org.test.App', 'flatpak', 'uninstall')]})
        popen.assert_not_called()

    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='user removed', stderr=''))
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'installed', return_value={'flatpakStatus': 'available', 'flatpakScopes': {'org.test.App': ['user', 'system']}})
    def test_both_scope_removal_reports_system_failure(self, installed, popen, run):
        popen.return_value = self.helper_process([{'index': 0, 'result': {'success': False, 'output': 'system failed'}}])
        events = list(backend.operate_batch(backend.prepare_batch({'operations': [self.item('org.test.App', 'flatpak', 'uninstall')]})))
        final = [event['result'] for event in events if 'result' in event]
        self.assertEqual(len(final), 1)
        self.assertFalse(final[0]['success'])
        self.assertIn('system failed', final[0]['output'])
        run.assert_called_once()


class ProtectionTests(unittest.TestCase):
    @patch.object(backend, 'run')
    def test_inventory_detects_metadata_and_ignores_uninstalled_entries(self, run):
        run.return_value = Mock(returncode=0, stdout=(
            'bash\tinstalled\tyes\tno\toptional\n'
            'boot-package\tinstalled\tno\tyes\toptional\n'
            'required-package:amd64\tinstalled\tno\tno\trequired\n'
            'vlc\tinstalled\tno\tno\toptional\n'
            'gone\tconfig-files\tyes\tyes\trequired\n'))
        packages, protections = backend.apt_inventory()
        self.assertEqual(packages, ['bash', 'boot-package', 'required-package', 'vlc'])
        self.assertEqual(set(protections), {'bash', 'boot-package', 'required-package'})

    def test_protects_mint_desktop_boot_and_current_kernel_but_allows_old_kernels(self):
        for app_id in ('apt', 'dpkg', 'cinnamon', 'mate-session-manager', 'xfce4-session',
                       'mint-meta-cinnamon', 'grub-efi-amd64', 'network-manager',
                       'linux-image-' + backend.os.uname().release):
            self.assertIsNotNone(backend.protection_reason(app_id), app_id)
        for app_id in ('vlc', 'gimp', 'linux-image-0.0.0-old', 'build-essential'):
            self.assertIsNone(backend.protection_reason(app_id), app_id)

    @patch.object(backend, 'apt_inventory', return_value=(['libfoo', 'cinnamon'], {'cinnamon': 'Interface gráfica.'}))
    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='Remv libfoo [1.0]\nRemv cinnamon:amd64 [6.0]\n', stderr=''))
    @patch.object(backend.subprocess, 'Popen')
    def test_dependency_removal_is_rejected_without_auth_or_mutation(self, popen, run, inventory):
        with self.assertRaises(backend.ApiError) as error:
            backend.operate('uninstall', {'id': 'libfoo', 'packageType': 'apt'})
        self.assertEqual(error.exception.status, 403)
        self.assertIn('cinnamon', str(error.exception))
        run.assert_called_once_with(['/usr/bin/apt-get', '--simulate', 'remove', '--', 'libfoo'])
        popen.assert_not_called()

    @patch.object(backend, 'apt_inventory', return_value=(['vlc'], {}))
    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='Remv vlc [1.0]\n', stderr=''))
    def test_regular_app_removal_is_allowed(self, run, inventory):
        backend.assert_safe_apt_removal(['vlc'])
        run.assert_called_once()

    @patch.object(backend, 'run')
    def test_unknown_inventory_never_allows_removal(self, run):
        for result in (Mock(returncode=1, stdout='', stderr='failed'),
                       Mock(returncode=0, stdout='vlc\tinstalled\n', stderr=''),
                       Mock(returncode=0, stdout='', stderr='')):
            run.return_value = result
            with self.assertRaises(backend.ApiError) as error:
                backend.assert_safe_apt_removal(['vlc'])
            self.assertEqual(error.exception.status, 503)
        self.assertTrue(all(call.args[0][0] == '/usr/bin/dpkg-query' for call in run.call_args_list))

    @patch.object(backend, 'apt_inventory', return_value=(['vlc'], {}))
    @patch.object(backend, 'run', return_value=Mock(returncode=100, stdout='', stderr='broken dependencies'))
    def test_failed_simulation_blocks_removal(self, run, inventory):
        with self.assertRaises(backend.ApiError) as error:
            backend.assert_safe_apt_removal(['vlc'])
        self.assertEqual(error.exception.status, 503)
        self.assertIn('impacto', str(error.exception))

    @patch.object(backend, 'assert_safe_apt_removal', side_effect=backend.ApiError(403, 'Remoção bloqueada.'))
    @patch.object(backend, 'command_result')
    def test_helper_rechecks_entire_plan_before_any_transaction(self, command, guard):
        with self.assertRaises(backend.ApiError):
            backend.privileged_batch({'operations': [
                {'id': 'gimp', 'packageType': 'apt', 'action': 'install'},
                {'id': 'cinnamon', 'packageType': 'apt', 'action': 'uninstall'}
            ]})
        command.assert_not_called()

    @patch.object(backend, 'assert_safe_apt_removal', side_effect=[None, backend.ApiError(403, 'Estado mudou; remoção bloqueada.')])
    @patch.object(backend, 'command_result')
    def test_helper_rechecks_each_removal_after_previous_steps(self, command, guard):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            backend.privileged_batch({'operations': [{'id': 'libfoo', 'packageType': 'apt', 'action': 'uninstall'}]})
        final = json.loads(output.getvalue().splitlines()[-1])['result']
        self.assertFalse(final['success'])
        self.assertTrue(final['blocked'])
        command.assert_not_called()

    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend.subprocess, 'Popen')
    def test_flatpak_user_operation_has_no_apt_removal_to_check(self, popen, guard):
        plan = backend.prepare_batch({'operations': [{'id': 'org.test.App', 'packageType': 'flatpak', 'action': 'install'}]})
        self.assertEqual(plan[1], [])
        guard.assert_called_once_with([])
        popen.assert_not_called()


if __name__ == '__main__':
    unittest.main()
