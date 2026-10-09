import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Settings,
  Search,
  Boxes,
  Check,
  HardDrive,
  ChevronDown
} from 'lucide-react';
import { pushToast } from './Toast';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSaveSettings,
  onClearCache,
  installedApps = [],
  onImportApps = () => {}
}) {

  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'flatpak' | 'operations'
  const [localSettings, setLocalSettings] = useState(settings);
  const [savedToast, setSavedToast] = useState(false);
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onSaveSettings(updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-[#2a2d32] border border-[#3c4149] rounded-lg max-w-xl w-full h-[530px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#e0e0e0]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#202326] border-b border-[#1b1c1e] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1 rounded bg-[#87cf3e]/20 text-[#87cf3e]">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Preferências do Gerenciador</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35393f] text-[#9ca3af] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#32363c] bg-[#24272b] px-2 sm:px-4 text-xs font-medium w-full">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-colors text-center ${
              activeTab === 'search'
                ? 'border-[#87cf3e] text-white font-semibold bg-[#2a2e34]'
                : 'border-transparent text-[#9ca3af] hover:text-[#dcdcdc] hover:bg-[#282b30]'
            }`}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Pesquisa</span>
          </button>

          <button
            onClick={() => setActiveTab('flatpak')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-colors text-center ${
              activeTab === 'flatpak'
                ? 'border-[#87cf3e] text-white font-semibold bg-[#2a2e34]'
                : 'border-transparent text-[#9ca3af] hover:text-[#dcdcdc] hover:bg-[#282b30]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Flatpaks</span>
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-colors text-center ${
              activeTab === 'operations'
                ? 'border-[#87cf3e] text-white font-semibold bg-[#2a2e34]'
                : 'border-transparent text-[#9ca3af] hover:text-[#dcdcdc] hover:bg-[#282b30]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Operações & Lote</span>
          </button>

        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* 1. Opções de Pesquisa */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#87cf3e] mb-2">
                  Opções Gerais de Pesquisa
                </h3>
                <div className="bg-[#202226] border border-[#32363c] rounded-lg divide-y divide-[#2a2d33]">
                  
                  {/* Search in Summary */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium">Buscar no resumo dos pacotes</div>
                      <div className="text-[11px] text-[#8e95a0]">Localiza correspondências no sumário rápido de cada aplicativo</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.searchInSummary}
                      onChange={(e) => handleChange('searchInSummary', e.target.checked)}
                      className="w-4 h-4 rounded text-[#87cf3e] accent-[#87cf3e] cursor-pointer"
                    />
                  </label>

                  {/* Search in Description */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium">Buscar na descrição detalhada</div>
                      <div className="text-[11px] text-[#8e95a0]">Varre todo o texto de descrição dos aplicativos durante buscas</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.searchInDescription}
                      onChange={(e) => handleChange('searchInDescription', e.target.checked)}
                      className="w-4 h-4 rounded text-[#87cf3e] accent-[#87cf3e] cursor-pointer"
                    />
                  </label>

                  {/* Search in Category Only */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium">Limitar busca à categoria selecionada</div>
                      <div className="text-[11px] text-[#8e95a0]">Se desmarcado, a pesquisa procura em todo o catálogo global</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.searchInCategoryOnly}
                      onChange={(e) => handleChange('searchInCategoryOnly', e.target.checked)}
                      className="w-4 h-4 rounded text-[#87cf3e] accent-[#87cf3e] cursor-pointer"
                    />
                  </label>

                </div>
              </div>
            </div>
          )}

          {/* 2. Flatpaks */}
          {activeTab === 'flatpak' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
                  Gerenciamento de Flatpaks & Flathub
                </h3>
                <div className="bg-[#202226] border border-[#32363c] rounded-lg divide-y divide-[#2a2d33]">
                  
                  {/* Enable Live Search */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium">Busca online ao vivo no Flathub</div>
                      <div className="text-[11px] text-[#8e95a0]">Consulta a API oficial do Flathub em tempo real para novos pacotes</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enableFlathubLive}
                      onChange={(e) => handleChange('enableFlathubLive', e.target.checked)}
                      className="w-4 h-4 rounded text-sky-400 accent-sky-500 cursor-pointer"
                    />
                  </label>

                  {/* Allow Unverified Flatpaks */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium flex items-center space-x-1.5">
                        <span>Incluir resultados online não verificados</span>
                      </div>
                      <div className="text-[11px] text-[#8e95a0]">Exibe pacotes mantidos por terceiros não certificados pelos autores originais</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.allowUnverifiedFlatpaks}
                      onChange={(e) => handleChange('allowUnverifiedFlatpaks', e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </label>

                  {/* Multi-format preference */}
                  <div className="p-3.5 space-y-2">
                    <div className="text-white font-medium">Quando um aplicativo existir em múltiplos formatos (APT / Flatpak):</div>
                    <div className="relative">
                      <select
                        value={localSettings.packageTypePreference}
                        onChange={(e) => handleChange('packageTypePreference', e.target.value)}
                        className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-md bg-[#181a1d] hover:bg-[#202227] border border-[#3e444e] hover:border-[#4d5460] text-white font-medium focus:outline-none focus:border-[#87cf3e] focus:ring-1 focus:ring-[#87cf3e]/50 text-xs cursor-pointer transition-colors shadow-inner"
                      >
                        <option value="all" className="bg-[#181a1d] text-white py-1">Listar todos os formatos (Padrão)</option>
                        <option value="flatpak" className="bg-[#181a1d] text-white py-1">Apenas listar a versão Flatpak</option>
                        <option value="apt" className="bg-[#181a1d] text-white py-1">Apenas listar a versão do sistema (APT)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#a0a5ad]">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-500/30 text-[11.5px] text-sky-200/80 flex items-start space-x-2">
                <Boxes className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <span>Os aplicativos Flatpak são executados com isolamento de dependências e independem das versões das bibliotecas do sistema base.</span>
              </div>
            </div>
          )}

          {/* 3. Operações & Lote */}
          {activeTab === 'operations' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#87cf3e] mb-2">
                  Preferências de Execução de Pacotes
                </h3>
                <div className="bg-[#202226] border border-[#32363c] rounded-lg divide-y divide-[#2a2d33]">
                  
                  {/* Confirm Batch Actions */}
                  <label className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#25282e] transition-colors">
                    <div>
                      <div className="text-white font-medium">Confirmar operações em lote</div>
                      <div className="text-[11px] text-[#8e95a0]">Exibe diálogo com contagem de pacotes antes de iniciar instalações ou remoções massivas</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.confirmBatchAction}
                      onChange={(e) => handleChange('confirmBatchAction', e.target.checked)}
                      className="w-4 h-4 rounded text-[#87cf3e] accent-[#87cf3e] cursor-pointer"
                    />
                  </label>

                  {/* Cache clearing */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Cache da aplicação e índices</div>
                      <div className="text-[11px] text-[#8e95a0]">Limpa metadados e força recarregamento do estado do sistema</div>
                    </div>
                    <button
                      onClick={onClearCache}
                      className="px-3 py-1.5 rounded bg-[#2b2e34] hover:bg-[#383c44] text-[#e0e0e0] border border-[#383d47] font-medium text-xs transition-colors"
                    >
                      Limpar Cache
                    </button>
                  </div>

                  {/* Export/Import installed map (resolve débito #16) */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Backup de apps instalados</div>
                      <div className="text-[11px] text-[#8e95a0]">Exporta a lista de instalados. Importar prepara uma seleção para instalação.</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          try {
                            const map = Object.fromEntries(installedApps.map(app => [app.id, true]));
                            const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `mint-install-pro-installed-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            pushToast('Backup exportado com sucesso', 'success');
                          } catch (e) {
                            pushToast('Falha ao exportar backup', 'error');
                          }
                        }}
                        className="px-3 py-1.5 rounded bg-[#2b2e34] hover:bg-[#383c44] text-[#e0e0e0] border border-[#383d47] font-medium text-xs transition-colors"
                      >
                        Exportar
                      </button>
                      <label className="px-3 py-1.5 rounded bg-[#2b2e34] hover:bg-[#383c44] text-[#e0e0e0] border border-[#383d47] font-medium text-xs transition-colors cursor-pointer">
                        Importar
                        <input
                          type="file"
                          accept="application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              try {
                                const map = JSON.parse(ev.target.result);
                                if (typeof map !== 'object' || map === null || Array.isArray(map)) throw new Error('invalid');
                                // Sanitiza: só aceita id -> bool
                                const clean = {};
                                for (const [k, v] of Object.entries(map)) {
                                  if (typeof k === 'string' && typeof v === 'boolean') clean[k] = v;
                                }
                                onImportApps(Object.keys(clean).filter(id => clean[id]));
                              } catch (err) {
                                pushToast('Arquivo inválido', 'error');
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = ''; // reset pra permitir re-import do mesmo arquivo
                          }}
                        />
                      </label>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#202326] border-t border-[#1b1c1e] flex items-center justify-between">
          <div>
            {savedToast && (
              <span className="text-[11px] text-[#87cf3e] font-semibold flex items-center space-x-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Preferências salvas automaticamente!</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded bg-[#87cf3e] hover:bg-[#97df4e] text-[#132802] font-semibold text-xs transition-colors shadow-md"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

SettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
  onSaveSettings: PropTypes.func.isRequired,
  onClearCache: PropTypes.func.isRequired
};
