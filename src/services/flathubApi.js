// Fallback único para ícones do Flathub quando a API não retorna `icon`
const FALLBACK_FLATPAK_ICON = '/icons/software-manager.png';

export async function searchFlathub(query, { signal } = {}) {
  if (!query || !query.trim()) return [];
  
  try {
    const response = await fetch('https://flathub.org/api/v2/search', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query.trim() })
    });

    if (!response.ok) {
      throw new Error(`Flathub API status: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || [];

    return hits.map(hit => {
      const appId = hit.app_id || hit.id;
      const cleanDesc = (hit.description || hit.summary || '')
        .replace(/<[^>]+>/g, '')
        .slice(0, 350);

      return {
        id: appId,
        name: hit.name || appId,
        summary: (hit.summary || 'Aplicativo Flatpak no Flathub').slice(0, 65),
        fullSummary: hit.summary || 'Aplicativo Flatpak no Flathub',
        description: cleanDesc,
        category: 'flatpak',
        categoryLabel: 'Flatpak',
        rating: 0,
        installed: false,
        version: 'stable',
        size: 'Não informado',
        packageType: 'Flatpak (Flathub)',
        icon: hit.icon || FALLBACK_FLATPAK_ICON,
        fallbackIcon: '📦',
        developer: hit.developer_name || 'Flathub Publisher',
        license: hit.project_license || 'Open Source',
        flathub: true,
        kind: 'flatpak',
        verified: hit.verification_verified === true
      };
    });
  } catch (err) {
    console.error('Erro na busca ao vivo do Flathub:', err);
    throw err;
  }
}
