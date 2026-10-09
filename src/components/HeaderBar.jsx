import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import appIcon from '../../icon_mip.svg';
import {
  ChevronLeft,
  Search,
  X,
  Menu,
  RefreshCw,
  Info,
  Settings,
  AlertTriangle
} from 'lucide-react';

// Versão injetada pelo Vite a partir de package.json. Default seguro para SSR/tests.
const APP_VERSION = import.meta.env?.VITE_APP_VERSION || 'desenvolvimento';

export default function HeaderBar({
  searchQuery,
  setSearchQuery,
  canGoBack,
  onBack,
  onOpenSettings,
  flatpakStatus = 'unknown'
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Esc fecha About modal (escopo local — não interfere com outros handlers do App)
  useEffect(() => {
    if (!showAbout) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowAbout(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAbout]);

  return (
    <header className="bg-[#202326] border-b border-[#1b1c1e] text-[#dcdcdc] px-3 py-2 flex items-center justify-between select-none relative z-30 shadow-md">
      {/* Left controls: Back, Search, Tasks */}
      <div className="flex items-center space-x-2 flex-1 max-w-md">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          title="Voltar"
          className={`p-1.5 rounded bg-[#2b2e33] border border-[#232528] hover:bg-[#383c42] active:bg-[#1e2023] transition-colors ${
            !canGoBack ? 'opacity-40 cursor-not-allowed' : 'opacity-100'
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-[#e0e0e0]" />
        </button>

        {/* Search input styled like MintInstall HeaderBar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-[#8c919a]" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar aplicativos..."
            aria-label="Pesquisar aplicativos"
            aria-keyshortcuts="Control+f Meta+f"
            title="Pesquisar aplicativos (Ctrl+F)"
            className="w-full pl-8 pr-7 py-1 text-xs rounded-full bg-[#18191c] border border-[#2b2e33] text-[#f0f0f0] placeholder-[#7d828a] focus:outline-none focus:border-[#87cf3e] focus:ring-1 focus:ring-[#87cf3e] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-[#7d828a] hover:text-[#f0f0f0]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right controls: Hamburger menu */}
      <div className="flex items-center space-x-2">
        {/* Flatpak availability warning (only shown when backend reports ENOENT) */}
        {flatpakStatus === 'missing' && (
          <div
            role="status"
            title="Flatpak não está instalado neste sistema. Instale o utilitário para gerenciar aplicativos Flatpak."
            className="hidden sm:flex items-center space-x-1.5 h-[26px] px-2.5 rounded-full bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[11px] font-medium select-none"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Flatpak ausente</span>
          </div>
        )}

        {/* Hamburger Menu button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            title="Menu do aplicativo"
            className="p-1.5 rounded hover:bg-[#35393f] text-[#cfd3d8] transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-52 bg-[#2a2d32] border border-[#1b1c1e] rounded shadow-xl py-1 z-50 text-xs text-[#e4e4e4]">
              <button
                onClick={() => { onOpenSettings(); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[#35393f] flex items-center space-x-2 text-white font-medium transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#87cf3e]" />
                <span>Preferências</span>
              </button>
              <div className="h-px bg-[#3b3f46] my-1" />
              <button
                onClick={() => { window.location.reload(); }}
                className="w-full text-left px-3 py-2 hover:bg-[#35393f] flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Cache APT</span>
              </button>
              <div className="h-px bg-[#3b3f46] my-1" />
              <button
                onClick={() => { setShowAbout(true); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[#35393f] flex items-center space-x-2"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Sobre o Gerenciador</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2d32] border border-[#3b3f46] rounded-lg max-w-sm w-full p-5 shadow-2xl text-center">
            <img src={appIcon} alt="Mint Install Pro" className="w-16 h-16 mx-auto mb-3 drop-shadow-md object-contain" />
            <h2 className="text-lg font-bold text-white">Gerenciador de Aplicativos</h2>
            <p className="text-xs text-[#87cf3e] font-semibold mt-0.5">Versão {APP_VERSION} (Clone Mint-Y Dark)</p>
            <p className="text-xs text-[#a4a9b2] mt-3 leading-relaxed">
              Réplica interativa e de alta fidelidade visual do Gerenciador de Aplicativos oficial do Linux Mint (mintinstall), com suporte a catálogo reativo de 1.800 aplicativos, integração nativa APT e Flathub.
            </p>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-5 px-5 py-1.5 rounded bg-[#87cf3e] hover:bg-[#97df4e] text-[#1a2e05] font-semibold text-xs transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

HeaderBar.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
  canGoBack: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
  onOpenSettings: PropTypes.func.isRequired,
  flatpakStatus: PropTypes.oneOf(['unknown', 'available', 'missing'])
};

