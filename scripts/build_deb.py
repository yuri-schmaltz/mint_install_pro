#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import stat

import json

with open("package.json", encoding="utf-8") as manifest:
    VERSION = json.load(manifest)["version"]
PACKAGE_NAME = "mint-install-pro"
DEB_DIR = f"/tmp/{PACKAGE_NAME}_{VERSION}_all"
OUTPUT_DEB = f"{PACKAGE_NAME}_{VERSION}_all.deb"

print(f"📦 Criando pacote Debian para {PACKAGE_NAME} v{VERSION}...")

# Limpar diretório temporário se existir
if os.path.exists(DEB_DIR):
    shutil.rmtree(DEB_DIR)

# Criar estrutura de diretórios do .deb
dirs = [
    f"{DEB_DIR}/DEBIAN",
    f"{DEB_DIR}/usr/bin",
    f"{DEB_DIR}/usr/share/{PACKAGE_NAME}",
    f"{DEB_DIR}/usr/share/applications",
    f"{DEB_DIR}/usr/share/icons/hicolor/96x96/apps",
    f"{DEB_DIR}/usr/share/icons/hicolor/scalable/apps",
]

for d in dirs:
    os.makedirs(d, exist_ok=True)

# 1. Copiar bundle de produção (dist)
dist_dir = "dist"
if not os.path.exists(dist_dir):
    raise RuntimeError("Diretório dist/ não encontrado. Execute 'npm run build' primeiro.")

shutil.copytree(dist_dir, f"{DEB_DIR}/usr/share/{PACKAGE_NAME}", dirs_exist_ok=True)
shutil.copy('icon_mip.svg', f'{DEB_DIR}/usr/share/{PACKAGE_NAME}/icon_mip.svg')

# 2. Criar script executável /usr/bin/mint-install-pro
launcher_content = open("scripts/launcher.py", encoding="utf-8").read()
shutil.copy("scripts/package_backend.py", f"{DEB_DIR}/usr/share/{PACKAGE_NAME}/package_backend.py")

launcher_path = f"{DEB_DIR}/usr/bin/{PACKAGE_NAME}"
with open(launcher_path, "w", encoding="utf-8") as f:
    f.write(launcher_content)

# Dar permissão de execução ao launcher
os.chmod(launcher_path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)

# 3. Criar arquivo de desktop /usr/share/applications/mint-install-pro.desktop
# Lê app_manager.desktop da raiz (fonte de verdade) se existir, senão usa inline.
desktop_src = "app_manager.desktop"
if os.path.exists(desktop_src):
    with open(desktop_src, "r", encoding="utf-8") as f:
        desktop_content = f.read()
else:
    desktop_content = """[Desktop Entry]
Type=Application
Name=Mint Install Pro
Comment=Gerenciador de Aplicativos Moderno para Linux Mint
Comment[pt_BR]=Gerenciador de Aplicativos Moderno para Linux Mint
Exec=mint-install-pro
Icon=/usr/share/mint-install-pro/icon_mip.svg
Terminal=false
Categories=GNOME;GTK;System;Settings;PackageManager;
Keywords=package;apt;software;install;uninstall;flatpak;flathub;
StartupNotify=true
"""

with open(f"{DEB_DIR}/usr/share/applications/{PACKAGE_NAME}.desktop", "w", encoding="utf-8") as f:
    f.write(desktop_content)

# 4. Registrar o SVG canônico também no tema hicolor.
shutil.copy("public/icons/hicolor-96x96.png",
            f"{DEB_DIR}/usr/share/icons/hicolor/96x96/apps/{PACKAGE_NAME}.png")
shutil.copy('icon_mip.svg',
            f'{DEB_DIR}/usr/share/icons/hicolor/scalable/apps/{PACKAGE_NAME}.svg')

# 5. Criar DEBIAN/control
control_content = f"""Package: {PACKAGE_NAME}
Version: {VERSION}
Section: admin
Priority: optional
Architecture: all
Depends: python3, python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1 | gir1.2-webkit2-4.0
Recommends: flatpak, policykit-1, libglib2.0-bin
Maintainer: Yuri Schmaltz <yuri.schmaltz@gmail.com>
Homepage: https://github.com/yuri-schmaltz/mint_install_pro
Description: Gerenciador de aplicativos APT e Flatpak para Linux Mint
 Interface inspirada no tema Mint-Y Dark, com categorias e pesquisa,
 instalacao e remocao individuais ou em lote com uma autorizacao
 administrativa por lote e protecao de componentes essenciais.
"""

with open(f"{DEB_DIR}/DEBIAN/control", "w", encoding="utf-8") as f:
    f.write(control_content)

# 6. Atualizar o cache de ícones sem abrir janelas ou alterar associações.
postinst_content = """#!/bin/sh
set -e
# Apenas atualiza o cache de ícones (operação silenciosa, sem UI).
if which gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
exit 0
"""

with open(f"{DEB_DIR}/DEBIAN/postinst", "w", encoding="utf-8") as f:
    f.write(postinst_content)
os.chmod(f"{DEB_DIR}/DEBIAN/postinst", 0o755)

postrm_content = """#!/bin/sh
set -e
# Apenas atualiza o cache de ícones (operação silenciosa, sem UI).
if which gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
exit 0
"""

with open(f"{DEB_DIR}/DEBIAN/postrm", "w", encoding="utf-8") as f:
    f.write(postrm_content)
os.chmod(f"{DEB_DIR}/DEBIAN/postrm", 0o755)

# Garantir permissões estritas no diretório raiz e DEBIAN (dpkg-deb requer 0755)
os.chmod(DEB_DIR, 0o755)
os.chmod(f"{DEB_DIR}/DEBIAN", 0o755)

# 7. Empacotar usando dpkg-deb
cmd = ["dpkg-deb", "--build", "--root-owner-group", DEB_DIR, OUTPUT_DEB]
result = subprocess.run(cmd, capture_output=True, text=True)

if result.returncode != 0:
    print(f"❌ Erro ao gerar o .deb:\n{result.stderr}")
    sys.exit(1)

# Limpeza
shutil.rmtree(DEB_DIR)

size_mb = os.path.getsize(OUTPUT_DEB) / (1024 * 1024)
print(f"✅ Pacote {OUTPUT_DEB} gerado com sucesso! ({size_mb:.2f} MB)")
