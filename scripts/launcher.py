#!/usr/bin/env python3
import sys
import os
import threading
import webbrowser
import time

APP_DIR = "/usr/share/mint-install-pro"
sys.path.insert(0, APP_DIR)
from package_backend import PackageServer

def try_gtk_webview(url):
    try:
        import gi
        gi.require_version('Gtk', '3.0')
    except (ImportError, ValueError) as e:
        return False, f"PyGObject não instalado: {e}"
    try:
        try:
            gi.require_version('WebKit2', '4.1')
        except ValueError:
            gi.require_version('WebKit2', '4.0')
    except ValueError as e:
        return False, f"Nenhum binding WebKit2 GTK disponível: {e}"
    try:
        from gi.repository import Gtk, WebKit2, Gdk
    except Exception as e:
        return False, f"Falha ao importar Gtk/WebKit2: {e}"
    try:
        win = Gtk.Window(title="Gerenciador de Aplicativos")
        win.set_default_size(1200, 780)
        win.set_position(Gtk.WindowPosition.CENTER)

        icon_path = os.path.join(APP_DIR, 'icon_mip.svg')
        if os.path.exists(icon_path):
            win.set_icon_from_file(icon_path)

        webview = WebKit2.WebView()

        load_failed = [False]

        def on_load_failed(webview, load_event, failing_uri, error):
            load_failed[0] = True
            sys.stderr.write(f"[mip-launcher] Falha ao carregar {failing_uri}: {error}\n")
            Gtk.main_quit()
            return False

        webview.connect('load-failed', on_load_failed)

        webview.load_uri(url)
        win.add(webview)
        win.connect("destroy", Gtk.main_quit)
        win.show_all()

        Gtk.main()
        if load_failed[0]:
            return False, "WebView falhou ao carregar a URL (load_failed)"
        return True, None
    except Exception as e:
        return False, f"Erro ao abrir WebView: {e}"


def show_error_dialog(reason, url):
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        from gi.repository import Gtk
        dialog = Gtk.MessageDialog(
            type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.OK,
            message_format="Mint Install Pro não pôde iniciar"
        )
        dialog.format_secondary_text(
            f"Causa: {reason}\n\n"
            "O Mint Install Pro precisa de GTK + WebKit2 para abrir como app nativo.\n\n"
            "1) Instale as dependências:\n"
            "   sudo apt install gir1.2-gtk-3.0 gir1.2-webkit2-4.1\n\n"
            "2) Se já estão instaladas mas persiste, teste o servidor:\n"
            "   mint-install-pro --force-browser\n"
            "   (abre no seu navegador padrão — útil pra confirmar se o\n"
            "    problema é do WebView nativo ou do servidor)\n\n"
            f"URL do servidor local: {url}"
        )
        dialog.run()
        dialog.destroy()
    except Exception:
        # Se nem o GTK pra diálogo tá disponível, cai pro stderr
        print(f"[mint-install-pro] ERRO: {reason}", file=sys.stderr)
        print(f"[mint-install-pro] URL: {url}", file=sys.stderr)
        print("[mint-install-pro] Para forçar browser: mint-install-pro --force-browser", file=sys.stderr)


def main():
    server = PackageServer(("127.0.0.1", 0), directory=APP_DIR)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    url = f"http://127.0.0.1:{server.server_port}"

    if "--browser" not in sys.argv and "--force-browser" not in sys.argv:
        ok, reason = try_gtk_webview(url)
        if ok:
            return
        show_error_dialog(reason, url)
        sys.exit(1)

    # --browser explícito (modo legacy): pula WebView direto
    webbrowser.open(url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
