import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Check, Star } from 'lucide-react';

function AppCard({
  app,
  onClick, 
  isSelected = false, 
  onToggleSelect,
  compact = false
}) {
  const [imgError, setImgError] = useState(false);

  const isInstalled = !!app.installed;
  const removalBlocked = isInstalled && !!app.removalProtection;
  const isStagedForUninstall = isInstalled && isSelected;
  const isStagedForInstall = !isInstalled && isSelected;

  // Determine card background and border styling
  let cardClass = 'border-[#2e3238] bg-[#2a2d33] hover:bg-[#32363e]';

  if (isStagedForUninstall) {
    // Marcado para desinstalação (desmarcado o checkbox): fundo vermelho/laranja
    cardClass = 'bg-gradient-to-r from-[#332220] via-[#3a2522] to-[#332220] border-[#663830] ring-1 ring-amber-600/40 hover:bg-[#3d2724] hover:border-amber-500/60';
  } else if (isStagedForInstall) {
    // Marcado para instalação
    cardClass = 'bg-[#2b3a2e] border-[#87cf3e] ring-1 ring-[#87cf3e]';
  }

  // O checkbox aparece marcado se:
  // - Está instalado e NÃO foi desmarcado para remoção
  // - OU não está instalado e foi marcado para instalação
  const isCheckboxChecked = (isInstalled && !isSelected) || isStagedForInstall;

  return (
    <div
      onClick={() => onClick(app)}
      onKeyDown={(e) => {
        // Espaço/Enter abre detalhes. Resolve débito #15 (keyboard nav).
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(app);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${app.name}. ${app.fullSummary || app.summary || ''}${isInstalled ? ' Instalado' : ''}${removalBlocked ? '. Componente protegido do sistema' : ''}`}
      className={`gtk-card group relative flex items-center ${
        compact ? 'p-2 sm:p-2.5 h-[62px]' : 'p-2.5 sm:p-3 h-[74px]'
      } rounded-md cursor-pointer select-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#87cf3e] focus:ring-offset-1 focus:ring-offset-[#26292d] ${cardClass}`}
      title={
        isStagedForUninstall
          ? `${app.name}: Desmarcado para desinstalação em lote`
          : `${app.name}: ${app.fullSummary || app.summary}${isInstalled ? ' (Instalado)' : ''}`
      }
    >
      {/* Checkbox: Resolve o check verde de app instalado e a desmarcação para desinstalação */}
      {onToggleSelect && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (!removalBlocked) onToggleSelect(app.id);
          }}
          aria-disabled={removalBlocked || undefined}
          className={`mr-2.5 flex items-center justify-center p-0.5 z-10 ${removalBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          title={
            removalBlocked
              ? `Remoção bloqueada: ${app.removalProtection}`
              : isStagedForUninstall
              ? "Desmarcado para desinstalação (clique para cancelar remoção)"
              : isStagedForInstall
                ? "Marcado para instalação (clique para cancelar)"
                : isInstalled
                  ? "Instalado no sistema (clique para desmarcar e desinstalar)"
                  : "Não instalado (clique para marcar e instalar)"
          }
        >
          <div className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all ${
            isStagedForUninstall
              ? 'border-amber-500/70 bg-amber-950/40 text-amber-400 hover:border-amber-400'
              : isStagedForInstall
                ? 'bg-[#87cf3e] border-[#87cf3e] text-[#132802]'
                : isInstalled
                  ? 'border-[#87cf3e] bg-[#87cf3e]/25 text-[#87cf3e] hover:bg-[#87cf3e]/35'
                  : 'border-[#555a64] bg-[#22252a] hover:border-[#87cf3e]'
          }`}>
            {isCheckboxChecked && (
              <Check className={`w-3.5 h-3.5 stroke-[3] ${isStagedForInstall ? 'text-[#132802]' : 'text-[#87cf3e]'}`} />
            )}
          </div>
        </div>
      )}

      {/* App Icon */}
      <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center mr-2.5 rounded bg-black/15 overflow-hidden">
        {!imgError && app.icon ? (
          <img
            src={app.icon}
            alt={app.name}
            onError={() => setImgError(true)}
            className="w-10 h-10 object-contain drop-shadow-sm transition-transform duration-150 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 flex items-center justify-center text-lg bg-[#2a2d32] text-[#87cf3e] font-bold rounded">
            {app.fallbackIcon || app.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* App Info (Name and Summary) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13px] font-semibold text-[#f0f0f0] truncate min-w-0 leading-tight group-hover:text-white">
              {app.name}
            </h3>
            {isInstalled && !removalBlocked && !isStagedForUninstall && (
              <span className="flex-shrink-0 text-[10px] font-medium text-[#87cf3e]/80">•</span>
            )}
          </div>
          {removalBlocked ? (
            <span title={app.removalProtection} className="flex-shrink-0 text-[10px] font-semibold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/40">
              Protegido
            </span>
          ) : isStagedForUninstall ? (
            <span className="flex-shrink-0 text-[9.5px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/50 shadow-xs whitespace-nowrap">
              Desinstalar
            </span>
          ) : isStagedForInstall ? (
            <span className="flex-shrink-0 text-[9.5px] font-bold text-[#87cf3e] bg-[#132802]/70 px-1.5 py-0.5 rounded border border-[#87cf3e]/50 shadow-xs whitespace-nowrap">
              Instalar
            </span>
          ) : null}
        </div>
        <p className="text-[11.5px] text-[#9ca3af] truncate pr-8 mt-1 leading-tight font-normal">
          {app.summary}
        </p>
      </div>

      {/* Bottom-Right: Rating and Star */}
      <div className="absolute bottom-2 right-3 flex items-center space-x-1 text-[#b3b8c2]">
        <span className="text-[11px] font-medium tracking-tight">
          {app.rating ? app.rating.toFixed(1) : '4.5'}
        </span>
        <Star className="w-3 h-3 fill-[#c4c8d0] text-[#c4c8d0]" />
      </div>
    </div>
  );
}

export default React.memo(AppCard);

AppCard.propTypes = {
  app: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    summary: PropTypes.string,
    fullSummary: PropTypes.string,
    rating: PropTypes.number,
    installed: PropTypes.bool,
    icon: PropTypes.string,
    fallbackIcon: PropTypes.string,
    isFlatpak: PropTypes.bool,
    isApt: PropTypes.bool,
    packageType: PropTypes.string
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  isSelected: PropTypes.bool,
  onToggleSelect: PropTypes.func,
  compact: PropTypes.bool
};

