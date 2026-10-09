"""Verify the built artifact without installing it or running maintainer scripts."""
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
deb = root / f'mint-install-pro_{version}_all.deb'
with tempfile.TemporaryDirectory(prefix='mip-deb-check-') as tmp:
    subprocess.run(['dpkg-deb', '-x', str(deb), tmp], check=True)
    extracted = Path(tmp)
    for source, destination in [
        ('scripts/launcher.py', 'usr/bin/mint-install-pro'),
        ('scripts/package_backend.py', 'usr/share/mint-install-pro/package_backend.py'),
        ('app_manager.desktop', 'usr/share/applications/mint-install-pro.desktop'),
        ('public/icons/hicolor-96x96.png', 'usr/share/icons/hicolor/96x96/apps/mint-install-pro.png'),
        ('icon_mip.svg', 'usr/share/icons/hicolor/scalable/apps/mint-install-pro.svg'),
        ('icon_mip.svg', 'usr/share/mint-install-pro/icon_mip.svg')
    ]:
        assert (root / source).read_bytes() == (extracted / destination).read_bytes(), destination
    bundle = extracted / 'usr/share/mint-install-pro'
    expected_files = {path.relative_to(root / 'dist') for path in (root / 'dist').rglob('*') if path.is_file()}
    actual_files = {path.relative_to(bundle) for path in bundle.rglob('*') if path.is_file()}
    assert actual_files == expected_files | {Path('package_backend.py'), Path('icon_mip.svg')}, 'Arquivos ausentes ou extras no bundle.'
    for relative in expected_files:
        assert (root / 'dist' / relative).read_bytes() == (bundle / relative).read_bytes(), str(relative)
    assert (extracted / 'usr/bin/mint-install-pro').stat().st_mode & 0o111, 'Launcher sem permissão de execução.'
    desktop = (extracted / 'usr/share/applications/mint-install-pro.desktop').read_text()
    assert 'Icon=/usr/share/mint-install-pro/icon_mip.svg' in desktop, 'Desktop não referencia o SVG canônico.'
    compile((extracted / 'usr/bin/mint-install-pro').read_text(), '<launcher>', 'exec')
    compile((extracted / 'usr/share/mint-install-pro/package_backend.py').read_text(), '<backend>', 'exec')
    metadata = subprocess.check_output(['dpkg-deb', '-f', str(deb), 'Version'], text=True).strip()
    assert metadata == version
    assert subprocess.check_output(['dpkg-deb', '-f', str(deb), 'Architecture'], text=True).strip() == 'all'
    assert subprocess.check_output(['dpkg-deb', '-f', str(deb), 'Package'], text=True).strip() == 'mint-install-pro'
print(f'Pacote {deb.name}: todos os {len(expected_files)} arquivos do bundle, ícones, launcher, backend, metadados e sintaxe verificados.')
