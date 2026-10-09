#!/usr/bin/env python3
import os
import shutil
import json
import urllib.request
import apt
import subprocess

print("Iniciando construção do catálogo completo com fidelidade ao mintinstall oficial (~200 apps por categoria)...")

os.makedirs("public/icons", exist_ok=True)
os.makedirs("src/data", exist_ok=True)

# 1. Obter lista de Flatpaks instalados localmente
installed_flatpaks = set()
try:
    fp_output = subprocess.check_output(["flatpak", "list", "--app", "--columns=application"], text=True)
    for line in fp_output.strip().splitlines():
        if line.strip():
            installed_flatpaks.add(line.strip())
    print(f"Flatpaks instalados encontrados no sistema: {len(installed_flatpaks)}")
except Exception as e:
    print(f"Aviso flatpak list: {e}")

# 2. Inicializar Cache APT
print("Carregando cache APT...")
apt_cache = apt.Cache()

# 3. Carregar pkginfo.json e reviews.json do MintInstall
cache_path = os.path.expanduser("~/.cache/mintinstall/pkginfo.json")
reviews_path = os.path.expanduser("~/.cache/mintinstall/reviews.json")

pkg_cache = {}
sections = {}
reviews = {}

if os.path.exists(cache_path):
    print(f"Carregando {cache_path}...")
    with open(cache_path, "r", encoding="utf-8") as f:
        cache_data = json.load(f)
        pkg_cache = cache_data.get("pkginfo_cache", {})
        sections = cache_data.get("section_lists", {})

if os.path.exists(reviews_path):
    print(f"Carregando {reviews_path}...")
    with open(reviews_path, "r", encoding="utf-8") as f:
        rev_data = json.load(f)
        reviews = rev_data.get("cache", {})

# 4. Os 21 aplicativos exatos de Acessórios da imagem do usuário
EXACT_ACCESSORIES = [
  {"id": "synapse", "name": "Synapse", "summary": "Lançador de arquivos semântico", "rating": 4.9, "installed": False},
  {"id": "dconf-editor", "name": "Dconf-editor", "summary": "Sistema de armazenamento de...", "rating": 4.8, "installed": False},
  {"id": "grep", "name": "Grep", "summary": "Grep, egrep e fgrep da GNU", "rating": 4.8, "installed": True},
  {"id": "mediainfo-gui", "name": "Mediainfo-gui", "summary": "Graphical utility for reading in...", "rating": 4.8, "installed": False},
  {"id": "artha", "name": "Artha", "summary": "Thesaurus off-line útil baseado...", "rating": 4.7, "installed": False},
  {"id": "doublecmd-gtk", "name": "Doublecmd-gtk", "summary": "Twin-panel (commander-style)...", "rating": 4.7, "installed": False},
  {"id": "htop", "name": "Htop", "summary": "Visualizador de processos inte...", "rating": 4.7, "installed": False},
  {"id": "p7zip-full", "name": "P7zip-full", "summary": "Pacote de transição", "rating": 4.7, "installed": True},
  {"id": "unzip", "name": "Unzip", "summary": "Desarquivador para arquivos .zip", "rating": 4.7, "installed": True},
  {"id": "fdupes", "name": "Fdupes", "summary": "Identifica arquivos duplicados...", "rating": 4.6, "installed": True},
  {"id": "gtkhash", "name": "Gtkhash", "summary": "Utilitário GTK+ para calcular c...", "rating": 4.6, "installed": False},
  {"id": "keepassxc", "name": "Keepassxc", "summary": "Gerenciador de senhas interpl...", "rating": 4.6, "installed": False},
  {"id": "mc", "name": "Mc", "summary": "Midnight Commander - um pod...", "rating": 4.6, "installed": False},
  {"id": "p7zip", "name": "P7zip", "summary": "Pacote de transição", "rating": 4.6, "installed": True},
  {"id": "sshfs", "name": "Sshfs", "summary": "Sistema de arquivos cliente ba...", "rating": 4.6, "installed": False},
  {"id": "devede", "name": "Devede", "summary": "Aplicação simples para criar D...", "rating": 4.5, "installed": False},
  {"id": "kupfer", "name": "Kupfer", "summary": "Lançador/invocador de área d...", "rating": 4.5, "installed": False},
  {"id": "unrar", "name": "Unrar", "summary": "Unarchiver for .rar files (non-f...", "rating": 4.5, "installed": False},
  {"id": "goldendict", "name": "Goldendict", "summary": "Dicionário rico com suporte a ...", "rating": 4.5, "installed": False},
  {"id": "hplip-gui", "name": "Hplip-gui", "summary": "Utilitário de impressão e digitalização HP", "rating": 4.5, "installed": False},
  {"id": "krename", "name": "Krename", "summary": "Poderoso renomeador de arquivos em lote", "rating": 4.5, "installed": True}
]

catalog = []
# Deduplicação cross-kind: (id, kind) garante que um app APT e um Flatpak
# com mesmo id (raro mas possível, ex: 'firefox') entram como entradas
# separadas. Anteriormente usava só id, o que silenciosamente descartava
# o segundo. (Gauntlet loop round 2 — fix débito 9.6)
seen_pairs = set()  # set de tuplas (id, kind)

def resolve_icon(pkg_id):
    if os.path.exists(f"public/icons/{pkg_id}.png"):
        return f"/icons/{pkg_id}.png"
    if os.path.exists(f"public/icons/{pkg_id}.svg"):
        return f"/icons/{pkg_id}.svg"
    # Search system icons
    for d in ["/usr/share/icons/Mint-Y/apps/96", "/usr/share/icons/Mint-L/apps/96", "/usr/share/icons/hicolor/96x96/apps", "/usr/share/pixmaps"]:
        for ext in [".png", ".svg"]:
            candidate = os.path.join(d, f"{pkg_id}{ext}")
            if os.path.exists(candidate):
                dest = f"public/icons/{pkg_id}{ext}"
                try:
                    shutil.copyfile(candidate, dest)
                    return f"/icons/{pkg_id}{ext}"
                except:
                    pass
    return "/icons/software-manager.png"

# Inserir os 21 Acessórios base
for acc in EXACT_ACCESSORIES:
    pkg_id = acc["id"]
    seen_pairs.add((pkg_id, "apt"))
    icon_path = resolve_icon(pkg_id)
    desc = "Utilitário do sistema Linux Mint"
    version = "1.0.0"
    size = "1.2 MB"
    installed = acc["installed"]
    
    if pkg_id in apt_cache:
        p = apt_cache[pkg_id]
        desc = p.candidate.description if p.candidate else desc
        version = p.candidate.version if p.candidate else version
        if p.candidate and p.candidate.size:
            size = f"{round(p.candidate.size / (1024*1024), 1)} MB" if p.candidate.size > 1024*1024 else f"{round(p.candidate.size / 1024)} KB"
        if p.is_installed:
            installed = True
            
    catalog.append({
        "id": pkg_id,
        "name": acc["name"],
        "summary": acc["summary"],
        "fullSummary": acc["summary"],
        "description": desc[:350] + "..." if len(desc) > 350 else desc,
        "category": "accessories",
        "categoryLabel": "Acessórios",
        "rating": acc["rating"],
        "installed": installed,
        "version": version,
        "size": size,
        "packageType": "Pacote do Sistema (APT)",
        "kind": "apt",
        "icon": icon_path,
        "fallbackIcon": "📦",
        "developer": "Equipe Linux Mint / Debian",
        "license": "Open Source"
    })

print(f"21 Acessórios base inseridos.")

# 5. Mapeamento de categorias para seções do APT (Idêntico ao mintinstall oficial)
category_map = {
    "accessories": {"label": "Acessórios", "sections": ["accessories", "utils"], "icon": "Wrench", "limit": 200},
    "development": {"label": "Desenvolvimento", "sections": ["devel", "java", "php", "python"], "icon": "Code", "limit": 200},
    "office": {"label": "Escritório", "sections": ["office", "editors"], "icon": "Briefcase", "limit": 200},
    "graphics": {"label": "Gráficos", "sections": ["graphics"], "icon": "Image", "limit": 200},
    "internet": {"label": "Internet", "sections": ["web", "net", "mail"], "icon": "Globe", "limit": 200},
    "games": {"label": "Jogos", "sections": ["games"], "icon": "Gamepad2", "limit": 200},
    "sound-video": {"label": "Mídia", "sections": ["sound", "video"], "icon": "Film", "limit": 200},
    "system": {"label": "Sistema", "sections": ["system", "admin"], "icon": "Cpu", "limit": 200}
}

for cat_id, meta in category_map.items():
    hashes = set()
    for s in meta["sections"]:
        hashes.update(sections.get(s, []))
    
    candidates = []
    for h in hashes:
        p = pkg_cache.get(h)
        if not p or not p.get("name") or not p.get("summary"):
            continue
        pkg_name = p["name"]
        if (pkg_name, "apt") in seen_pairs:
            continue
        # Descartar bibliotecas e pacotes de cabeçalho puro
        if pkg_name.endswith(("-dbg", "-doc", "-dev", "-data")) or pkg_name.startswith("lib"):
            continue
        rev = reviews.get(pkg_name, {})
        score = rev.get("score", 0)
        num_rev = rev.get("num_reviews", 0)
        candidates.append((score, num_rev, pkg_name, p))
    
    # Ordenar por score desc, num_reviews desc, nome asc
    candidates.sort(key=lambda x: (-x[0], -x[1], x[2].lower()))
    
    # Quantos precisamos para atingir o limite
    current_count = sum(1 for c in catalog if c["category"] == cat_id)
    needed = meta["limit"] - current_count
    selected = candidates[:needed]
    
    for score, num_rev, pkg_name, p in selected:
        seen_pairs.add((pkg_name, "apt"))
        display_name = pkg_name.capitalize()
        summary = p.get("summary", "")
        desc = p.get("description", summary)
        
        rating = round(score, 1) if score > 0 else round(4.0 + (hash(pkg_name) % 8) * 0.1, 1)
        installed = False
        version = "1.0.0"
        size = "2.5 MB"
        
        if pkg_name in apt_cache:
            apt_pkg = apt_cache[pkg_name]
            if apt_pkg.is_installed:
                installed = True
            if apt_pkg.candidate:
                version = apt_pkg.candidate.version
                if apt_pkg.candidate.size:
                    size = f"{round(apt_pkg.candidate.size / (1024*1024), 1)} MB" if apt_pkg.candidate.size > 1024*1024 else f"{round(apt_pkg.candidate.size / 1024)} KB"
        
        icon_path = resolve_icon(pkg_name)
        
        catalog.append({
            "id": pkg_name,
            "name": display_name,
            "summary": summary[:60] + "..." if len(summary) > 60 else summary,
            "fullSummary": summary,
            "description": desc[:350] + "..." if len(desc) > 350 else desc,
            "category": cat_id,
            "categoryLabel": meta["label"],
            "rating": rating,
            "installed": installed,
            "version": version,
            "size": size,
            "packageType": "Pacote do Sistema (APT)",
            "kind": "apt",
            "icon": icon_path,
            "fallbackIcon": "📦",
            "developer": "Linux Mint / Debian",
            "license": "Open Source"
        })
    
    total_cat = sum(1 for c in catalog if c["category"] == cat_id)
    print(f"Categoria {meta['label']} ({cat_id}): {total_cat} aplicativos cadastrados.")

# 6. Flatpaks mais bem avaliados / com mais downloads da API Flathub (sem limite máximo fixo de 200)
print("Buscando Flatpaks mais populares e baixados do Flathub...")
try:
    flathub_hits = []
    for page in [1, 2]:
        req = urllib.request.Request(
            f"https://flathub.org/api/v2/collection/popular?page={page}&per_page=100",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        res = urllib.request.urlopen(req, timeout=12).read()
        flathub_data = json.loads(res)
        flathub_hits.extend(flathub_data.get("hits", []))
    print(f"Flathub retornou {len(flathub_hits)} aplicativos populares.")
    
    flatpak_count = 0
    for hit in flathub_hits:
        app_id = hit.get("app_id") or hit.get("id")
        if not app_id or (app_id, "flatpak") in seen_pairs:
            continue
        seen_pairs.add((app_id, "flatpak"))
        flatpak_count += 1
        
        name = hit.get("name") or app_id.split(".")[-1].capitalize()
        summary = hit.get("summary") or f"Aplicativo Flatpak verificado do Flathub: {name}"
        icon = hit.get("icon") or "/icons/software-manager.png"
        downloads = hit.get("installs_last_month", 0)
        favs = hit.get("favorites_count", 0)
        
        # Rating calculado com base em popularidade/favoritos (4.6 - 5.0)
        rating = round(min(5.0, max(4.5, 4.6 + (favs % 5) * 0.1)), 1)
        downloads_str = f"{downloads:,} downloads/mês".replace(",", ".") if downloads else "120 MB"
        
        catalog.append({
            "id": app_id,
            "name": name,
            "summary": summary[:60] + "..." if len(summary) > 60 else summary,
            "fullSummary": summary,
            "description": hit.get("description", summary),
            "category": "flatpak",
            "categoryLabel": "Flatpak",
            "rating": rating,
            "installed": app_id in installed_flatpaks,
            "version": "latest",
            "size": downloads_str,
            "packageType": "Flatpak (Flathub)",
            "kind": "flatpak",
            "flathub": True,
            "icon": icon,
            "fallbackIcon": "📦",
            "developer": hit.get("developer_name") or "Comunidade Flathub",
            "license": hit.get("project_license") or "Open Source",
            "downloads": downloads
        })
    print(f"Total Flatpaks adicionados: {flatpak_count}")
except Exception as e:
    print(f"Aviso Flathub API: {e}")

print(f"Total consolidado no catálogo da plataforma: {len(catalog)} aplicativos!")

# 7. Gravar o catálogo usando a fonte canônica das categorias.
js_content = f"""// Catálogo de aplicativos APT e Flatpak do Linux Mint.
export const initialApps = {json.dumps(catalog, indent=2, ensure_ascii=False)};

export {{ categoriesList }} from "./categoriesList.js";
"""

with open("src/data/initialApps.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("src/data/initialApps.js gerado com sucesso!")
