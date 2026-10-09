#!/usr/bin/env python3
"""
Migracao do catalogo: injeta tag `kind` em cada app e gera o arquivo JSON
para code-split (carregamento lazy). Roda idempotentemente.

Uso: python3 scripts/migrate_catalog.py
"""
import json
import re
import os
import sys

INITIAL = "src/data/initialApps.js"
JSON_OUT = "public/data/catalog.json"

CATEGORIES_KIND = {
    "flatpak": "flatpak",
    "all": "apt",   # 'all' é categoria mista, default apt na tag
    "picks": "apt", # destaques são refs a apps APT
}


def detect_kind(obj, category):
    """Heurística determinística + override explícito."""
    if obj.get("kind") in ("apt", "flatpak"):
        return obj["kind"]
    pkg = (obj.get("packageType") or "").lower()
    if "flatpak" in pkg:
        return "flatpak"
    if "apt" in pkg or "sistema" in pkg:
        return "apt"
    if category == "flatpak" or obj.get("flathub"):
        return "flatpak"
    return CATEGORIES_KIND.get(category, "apt")


def main():
    if not os.path.exists(INITIAL):
        print(f"ERRO: {INITIAL} nao encontrado")
        sys.exit(1)

    with open(INITIAL, "r", encoding="utf-8") as f:
        src = f.read()

    # Extrai o array initialApps via regex robusta
    m = re.search(r"export const initialApps = (\[[\s\S]*?\]);", src)
    if not m:
        print("ERRO: nao consegui parsear initialApps")
        sys.exit(1)
    apps_json = m.group(1)

    apps = json.loads(apps_json)
    print(f"Carregados {len(apps)} apps do initialApps.js")

    # Injeta kind em cada um
    for app in apps:
        app["kind"] = detect_kind(app, app.get("category", ""))
        # Garante campo flathub consistente
        if app["kind"] == "flatpak" and "flathub" not in app:
            app["flathub"] = True
        if app["kind"] == "apt":
            app["flathub"] = False

    apt_count = sum(1 for a in apps if a["kind"] == "apt")
    fp_count = sum(1 for a in apps if a["kind"] == "flatpak")
    print(f"Apos migracao: {apt_count} APT + {fp_count} Flatpak = {len(apps)} total")

    # Re-serializa o initialApps.js com kind incluido, indent=2, asci-safe
    new_init = (
        "// Catálogo Completo da Plataforma Linux Mint com ~200 Apps por Categoria (Idêntico ao MintInstall Oficial)\n"
        "// Cada app possui o campo `kind` explícito: 'apt' | 'flatpak' (migração 1.3.1).\n"
        f"export const initialApps = {json.dumps(apps, indent=2, ensure_ascii=False)};\n\n"
    )

    with open(INITIAL, "w", encoding="utf-8") as f:
        f.write(new_init)
    # Re-exporta categoriesList do arquivo separado (code-split)
    with open(INITIAL, "a", encoding="utf-8") as f:
        f.write('\n// Re-exporta categoriesList de arquivo separado (code-split)\n')
        f.write('export { categoriesList } from "./categoriesList.js";\n')
    print(f"{INITIAL} reescrito com tag `kind` em todos os apps")

    # Gera JSON otimizado para code-split (vai para public/data/)
    os.makedirs("public/data", exist_ok=True)
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(apps, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = os.path.getsize(JSON_OUT) / (1024 * 1024)
    print(f"{JSON_OUT} gerado: {size_mb:.2f} MB (minificado, para fetch lazy)")


if __name__ == "__main__":
    main()
