"""Boundary, failure and scope matrices; all external commands are mocked."""
import http.client
import io
import itertools
import json
import subprocess
import threading
import unittest
from unittest.mock import MagicMock, Mock, patch
import package_backend as backend


def item(app_id='vlc', kind='apt', action='install'):
    return {'id': app_id, 'packageType': kind, 'action': action}


def helper(events=(), code=0):
    proc = MagicMock()
    proc.__enter__.return_value = proc
    proc.stdout = io.StringIO(''.join(json.dumps(event) + '\n' for event in events))
    proc.wait.return_value = code
    return proc


class InputMatrixTests(unittest.TestCase):
    @patch.object(backend, 'run')
    @patch.object(backend.subprocess, 'Popen')
    def test_identifier_injection_and_invalid_types(self, popen, run):
        invalid = [None, True, False, 1, [], {}, '', '--help', '-y',
                   ' vlc', 'vlc ', 'vlc\n', 'vlc\x00', 'vlc;id', 'vlc&&id',
                   '$(id)', '`id`', '../vlc', '/usr/bin/vlc', 'vlc:amd64',
                   'vlc\t', 'é', 'a b', 'a"b', "a'b", '*']
        for kind, app_id in itertools.product(('apt', 'flatpak'), invalid):
            with self.subTest(kind=kind, app_id=app_id):
                with self.assertRaises(backend.ApiError) as error:
                    backend.validate_package({'id': app_id, 'packageType': kind})
                self.assertEqual(error.exception.status, 400)
        popen.assert_not_called()
        run.assert_not_called()

    def test_apt_identifier_boundaries(self):
        for valid in ('a', '0', 'docker.io', 'libstdc++6', 'pkg-name', 'a' * 128):
            with self.subTest(valid=valid):
                self.assertEqual(backend.validate_package(item(valid)), (valid, 'apt'))
        for invalid in ('a' * 129, 'VLC', '.pkg', '+pkg', '-pkg'):
            with self.subTest(invalid=invalid), self.assertRaises(backend.ApiError):
                backend.validate_package(item(invalid))

    def test_flatpak_identifier_structure(self):
        for valid in ('org.test.App', 'org.test.App.Sub', 'org.test.App_name', 'org.test.App-name'):
            with self.subTest(valid=valid):
                self.assertEqual(backend.validate_package(item(valid, 'flatpak')), (valid, 'flatpak'))
        for invalid in ('org', 'org.test', 'org..App', '.org.test.App', 'org.test.App.', 'org.test.App+beta'):
            with self.subTest(invalid=invalid), self.assertRaises(backend.ApiError):
                backend.validate_package(item(invalid, 'flatpak'))

    @patch.object(backend, 'run')
    @patch.object(backend.subprocess, 'Popen')
    def test_batch_boundaries_duplicates_and_invalid_actions(self, popen, run):
        valid = [item(f'pkg-{index}') for index in range(backend.MAX_BATCH_ITEMS)]
        self.assertEqual(len(backend.validate_batch({'operations': valid})), 500)
        invalid = [None, [], {}, {'operations': None}, {'operations': {}},
                   {'operations': []}, {'operations': valid + [item('extra')]},
                   {'operations': [item(), item(action='uninstall')]}]
        invalid += [{'operations': [item(), item('gimp', action=action)]}
                    for action in (None, '', 'launch', 'update', True, [])]
        invalid += [{'operations': [item(), value]} for value in (None, 42, 'gimp', {})]
        for data in invalid:
            with self.subTest(data=str(data)[:100]), self.assertRaises(backend.ApiError):
                backend.validate_batch(data)
        run.assert_not_called()
        popen.assert_not_called()


class ScopeAndFailureMatrixTests(unittest.TestCase):
    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend, 'installed')
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run')
    def test_all_removal_scopes_and_command_outcomes(self, run, popen, installed, guard):
        for scopes in ([], ['user'], ['system'], ['user', 'system']):
            for system_ok, user_ok in itertools.product((False, True), repeat=2):
                with self.subTest(scopes=scopes, system_ok=system_ok, user_ok=user_ok):
                    run.reset_mock()
                    popen.reset_mock()
                    installed.return_value = {'flatpakStatus': 'available', 'flatpakScopes': {'org.test.App': scopes}}
                    popen.return_value = helper([{'index': 0, 'result': {'success': system_ok, 'output': 'system'}}])
                    run.return_value = Mock(returncode=0 if user_ok else 1, stdout='user', stderr='')
                    events = list(backend.operate_batch(backend.prepare_batch({'operations': [item('org.test.App', 'flatpak', 'uninstall')]})))
                    results = [event['result'] for event in events if 'result' in event]
                    self.assertEqual(len(results), 1)
                    expected = ('system' not in scopes or system_ok) and ('user' not in scopes or user_ok)
                    self.assertEqual(results[0]['success'], expected)
                    self.assertEqual(popen.call_count, int('system' in scopes))
                    self.assertEqual(run.call_count, int('user' in scopes))
                    if scopes == ['user', 'system']:
                        self.assertEqual(results[0]['output'], 'system\nuser')

    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run')
    def test_cancel_error_and_missing_permission_preserve_finished_and_stop_pending(self, run, popen, guard):
        operations = [item('vlc'), item('gimp'), item('org.test.New', 'flatpak')]
        for code in (1, 126, 127):
            with self.subTest(code=code):
                popen.reset_mock()
                popen.return_value = helper([{'index': 0, 'result': {'success': True, 'output': 'done'}}], code)
                results = {event['index']: event['result'] for event in
                           backend.operate_batch(backend.prepare_batch({'operations': operations})) if 'result' in event}
                self.assertEqual(set(results), {0, 1, 2})
                self.assertTrue(results[0]['success'])
                self.assertFalse(results[1]['success'])
                self.assertFalse(results[2]['success'])
                popen.assert_called_once()
                run.assert_not_called()

    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend, 'installed', return_value={
        'flatpakStatus': 'available', 'flatpakScopes': {'org.test.App': ['user', 'system']}})
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run', return_value=Mock(returncode=0, stdout='user removed', stderr=''))
    def test_incomplete_helper_never_reports_both_scope_uninstall_as_success(self, run, popen, installed, guard):
        popen.return_value = helper([], code=0)
        operations = [item('org.test.App', 'flatpak', 'uninstall'), item('org.test.New', 'flatpak')]
        events = list(backend.operate_batch(backend.prepare_batch({'operations': operations})))
        results = [event['result'] for event in events if 'result' in event]
        self.assertEqual(len(results), 2)
        self.assertTrue(all(result['success'] is False for result in results))
        popen.assert_called_once()
        run.assert_not_called()

    @patch.object(backend, 'run')
    def test_command_errors_and_output_limit(self, run):
        for error in (FileNotFoundError('missing'), PermissionError('denied'), subprocess.TimeoutExpired('test', 300)):
            with self.subTest(error=type(error).__name__):
                run.side_effect = error
                self.assertFalse(backend.command_result(['fake'])['success'])
        run.side_effect = None
        run.return_value = Mock(returncode=1, stdout='a' * 10000, stderr='END')
        result = backend.command_result(['fake'])
        self.assertFalse(result['success'])
        self.assertEqual(len(result['output']), 8000)
        self.assertTrue(result['output'].endswith('END'))

    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run')
    def test_maximum_batch_uses_one_authorization_and_emits_all_results(self, run, popen, guard):
        operations = [item(f'pkg-{index}') for index in range(500)]
        popen.return_value = helper([{'index': index, 'result': {'success': True, 'output': 'ok'}} for index in range(500)])
        events = list(backend.operate_batch(backend.prepare_batch({'operations': operations})))
        self.assertEqual(len(events), 500)
        self.assertEqual({event['index'] for event in events}, set(range(500)))
        self.assertTrue(all(event['result']['success'] for event in events))
        popen.assert_called_once()
        run.assert_not_called()

    @patch.object(backend, 'assert_safe_apt_removal')
    @patch.object(backend.subprocess, 'Popen')
    @patch.object(backend, 'run')
    def test_incomplete_helper_preserves_prior_success_and_stops_user_installs(self, run, popen, guard):
        popen.return_value = helper([{'index': 0, 'result': {'success': True, 'output': 'done'}}])
        operations = [item('vlc'), item('gimp'), item('org.test.New', 'flatpak')]
        results = {event['index']: event['result'] for event in
                   backend.operate_batch(backend.prepare_batch({'operations': operations})) if 'result' in event}
        self.assertEqual(set(results), {0, 1, 2})
        self.assertTrue(results[0]['success'])
        self.assertFalse(results[1]['success'])
        self.assertFalse(results[2]['success'])
        self.assertIn('antes de concluir', results[1]['output'])
        run.assert_not_called()

    @patch.object(backend, 'run')
    def test_every_curated_base_and_desktop_package_is_protected(self, run):
        for name in backend.BASE_PACKAGES | backend.DESKTOP_PACKAGES:
            with self.subTest(name=name):
                self.assertIsNotNone(backend.protection_reason(name))
        run.assert_not_called()

    @patch.object(backend, 'run')
    def test_inventory_statuses_and_protection_metadata_matrix(self, run):
        statuses = ['installed', 'unpacked', 'half-configured', 'half-installed', 'triggers-awaited', 'triggers-pending', 'config-files', 'not-installed']
        for status, essential, protected, priority in itertools.product(statuses, ('yes', 'no'), ('yes', 'no'), ('required', 'optional')):
            with self.subTest(status=status, essential=essential, protected=protected, priority=priority):
                run.return_value = Mock(returncode=0, stdout=f'example:amd64\t{status}\t{essential}\t{protected}\t{priority}\n')
                packages, protections = backend.apt_inventory()
                self.assertEqual(packages, ['example'] if status == 'installed' else [])
                expected = status not in ('config-files', 'not-installed') and (essential == 'yes' or protected == 'yes' or priority == 'required')
                self.assertEqual('example' in protections, expected)


class HttpBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = backend.PackageServer(('127.0.0.1', 0))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.host = f'127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, body, headers=None, path='/api/install'):
        connection = http.client.HTTPConnection(self.host, timeout=3)
        defaults = {'Content-Type': 'application/json', 'Origin': 'http://' + self.host}
        defaults.update(headers or {})
        connection.request('POST', path, body, defaults)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def assert_lock_released(self):
        acquired = self.server.operation_lock.acquire(timeout=1)
        self.assertTrue(acquired, 'A operação não liberou o bloqueio.')
        if acquired:
            self.server.operation_lock.release()

    @patch.object(backend, 'operate')
    def test_malformed_json_fails_and_next_request_succeeds(self, operate):
        operate.return_value = {'success': True}
        for body in (b'{', b'{"id":}', b'\xff', b'\x00', b'not json'):
            with self.subTest(body=body):
                self.assertEqual(self.request(body)[0], 400)
                self.assert_lock_released()
        operate.assert_not_called()
        self.assertEqual(self.request(json.dumps(item()))[0], 200)
        operate.assert_called_once()

    @patch.object(backend, 'operate')
    def test_content_length_and_transfer_encoding_rejections(self, operate):
        for length, status in (('nope', 400), ('-1', 413), ('0', 413), ('8193', 413)):
            with self.subTest(length=length):
                self.assertEqual(self.request(b'', {'Content-Length': length})[0], status)
                self.assert_lock_released()
        self.assertEqual(self.request(b'{}', {'Transfer-Encoding': 'chunked'})[0], 413)
        operate.assert_not_called()

    @patch.object(backend, 'operate')
    def test_origin_and_host_confusion_matrix(self, operate):
        for headers in (
            {'Host': 'localhost@evil.invalid', 'Origin': 'http://localhost@evil.invalid'},
            {'Host': '127.0.0.1/path', 'Origin': 'http://127.0.0.1/path'},
            {'Host': '127.0.0.1#fragment', 'Origin': 'http://127.0.0.1#fragment'},
            {'Origin': 'http://' + self.host + '/'},
            {'Origin': 'https://' + self.host},
            {'Origin': 'http://' + self.host + '.evil.invalid'},
            {'Content-Type': 'application/x-www-form-urlencoded'},
            {'Content-Type': 'multipart/form-data'},
        ):
            with self.subTest(headers=headers):
                self.assertEqual(self.request(b'{}', headers)[0], 403)
                self.assert_lock_released()
        operate.assert_not_called()


if __name__ == '__main__':
    unittest.main()
