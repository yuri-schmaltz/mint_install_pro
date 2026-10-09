"""Regenerate application icon assets from icon_mip.svg (requires rsvg-convert)."""
import copy
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
SVG_NS = "{http://www.w3.org/2000/svg}"


def main():
    renderer = shutil.which("rsvg-convert")
    if not renderer:
        raise SystemExit("Instale librsvg2-bin para disponibilizar rsvg-convert.")

    source = ROOT / "icon_mip.svg"
    source_bytes = source.read_bytes()
    original = ET.fromstring(source_bytes)
    preview_path = ROOT / "docs/icon-preview.svg"
    preview = ET.fromstring(preview_path.read_bytes())
    ET.register_namespace("", SVG_NS[1:-1])

    # Preserve the preview layout while replacing every sample with the source.
    # Prefix IDs so gradients cannot collide between samples in the same SVG.
    for index, child in enumerate(list(preview)):
        if child.tag != SVG_NS + "svg":
            continue
        sample = copy.deepcopy(original)
        prefix = f"preview-{index}-"
        for node in sample.iter():
            if "id" in node.attrib:
                node.set("id", prefix + node.get("id"))
            for name, value in list(node.attrib.items()):
                node.set(name, re.sub(r"url\(#([^)]*)\)",
                                     lambda match: "url(#" + prefix + match.group(1) + ")", value))
        for name in ("x", "y", "width", "height"):
            sample.set(name, child.get(name))
        preview.remove(child)
        preview.insert(index, sample)

    # Render from an immutable snapshot without keeping a redundant public SVG.
    with tempfile.TemporaryDirectory(prefix="mip-icons-") as temp:
        snapshot = Path(temp) / "icon.svg"
        snapshot.write_bytes(source_bytes)
        for size, destination in [(16, "public/favicon-16.png"),
                                  (32, "public/favicon-32.png"),
                                  (48, "public/favicon.png"),
                                  (96, "public/icons/hicolor-96x96.png")]:
            subprocess.run([renderer, "-w", str(size), "-h", str(size), "-o",
                            str(ROOT / destination), str(snapshot)], check=True)

    ET.indent(preview)
    preview_path.write_text(ET.tostring(preview, encoding="unicode") + "\n", encoding="utf-8")
    subprocess.run([renderer, "-o", str(ROOT / "docs/icon-preview.png"),
                    str(preview_path)], check=True)
    if source.read_bytes() != source_bytes:
        raise SystemExit("icon_mip.svg mudou durante a geração. Execute o comando novamente.")
    print("Favicons, ícone hicolor e prévia sincronizados com icon_mip.svg.")


if __name__ == "__main__":
    main()
