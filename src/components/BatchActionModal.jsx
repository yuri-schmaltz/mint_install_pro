import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Check,
  Loader2,
  Package,
  Download,
  Trash2,
  Play,
  Terminal,
  FileText
} from 'lucide-react';
import { executeBatch } from '../services/packageManager';
import { debugLog } from '../services/debugLog';

export default function BatchActionModal({
  actionType, // 'install' | 'uninstall' | 'mixed'
  targetApps,
  onClose,
  onComplete,
  confirmBeforeStart = false
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [appStatuses, setAppStatuses] = useState(() =>
    targetApps.map(app => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
      status: 'pending',
      action: app.batchAction || (app.installed ? 'uninstall' : 'install')
    }))
  );
  const [logs, setLogs] = useState([]);
  const [isFinished, setIsFinished] = useState(false);

  const [confirmed, setConfirmed] = useState(!confirmBeforeStart);
  const queueRef = useRef(targetApps);
  const actionRef = useRef(actionType);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!confirmed) return undefined;
    let isCancelled = false;
    const targetApps = queueRef.current;
    debugLog('info', 'BatchActionModal', 'mount, iniciando processQueue', { total: targetApps.length, type: actionRef.current });
    const processQueue = async () => {
      try {
        setLogs(prev => [...prev, `[SISTEMA] Iniciando fila de operações em lote (${targetApps.length} pacotes)...`]);

        const successfullyInstalled = [];
        const successfullyUninstalled = [];

        await executeBatch(targetApps, (msg) => {
          if (!isCancelled) setLogs(prev => [...prev, msg]);
        }, ({ index, status, result }) => {
          if (isCancelled) return;
          const currentApp = targetApps[index];
          const currentAction = currentApp.batchAction || (currentApp.installed ? 'uninstall' : 'install');
          setCurrentIndex(index);
          if (status === 'processing') {
            debugLog('debug', 'BatchActionModal', `processando ${currentApp.id}`, { i: index, action: currentAction });
            setAppStatuses(prev => prev.map((item, idx) => idx === index ? { ...item, status } : item));
            return;
          }
          if (result?.success === true && !result.simulated) {
            (currentAction === 'install' ? successfullyInstalled : successfullyUninstalled).push(currentApp.id);
            setLogs(prev => [...prev, `[SUCESSO] ${currentApp.name} ${currentAction === 'install' ? 'instalado' : 'removido'} no sistema!`]);
          } else {
            setLogs(prev => [...prev, `[AVISO] ${currentApp.name}: ${result?.output || 'Operação falhou.'}`]);
          }
          setAppStatuses(prev => prev.map((item, idx) => idx === index
            ? { ...item, status: result?.success === true && !result.simulated ? 'done' : 'error' } : item));
        });

        if (!isCancelled) {
          setLogs(prev => [...prev, `[SISTEMA] Fila finalizada: ${successfullyInstalled.length + successfullyUninstalled.length} sucesso(s), ${targetApps.length - successfullyInstalled.length - successfullyUninstalled.length} falha(s).`]);
          setIsFinished(true);
          debugLog('info', 'BatchActionModal', 'queue completa', {
            installed: successfullyInstalled.length,
            uninstalled: successfullyUninstalled.length
          });
          onCompleteRef.current({ installedIds: successfullyInstalled, uninstalledIds: successfullyUninstalled });
        }
      } catch (fatalErr) {
        // Última rede de segurança: se algo muito errado acontecer (ex: bug
        // no setState que causa loop infinito), pelo menos o modal fica em
        // estado de erro visível ao usuário em vez de tela cinza.
        debugLog('error', 'BatchActionModal', 'FATAL na fila', {
          msg: String(fatalErr.message || fatalErr),
          stack: String(fatalErr.stack || '').slice(0, 800)
        });
        // console.error removido: debugLog('error', ...) já espelha no console
        // em dev, evitando ruído duplicado. Em prod, persiste no localStorage.
        if (!isCancelled) {
          setLogs(prev => [...prev, `[ERRO FATAL] ${String(fatalErr.message || fatalErr)}`]);
          setIsFinished(true);
        }
      }
    };

    // Deferred start lets StrictMode clean up its probe without issuing an operation.
    const timer = setTimeout(processQueue, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [confirmed]);

  const total = targetApps.length;
  const completedCount = appStatuses.filter(s => s.status === 'done').length;
  const failedCount = appStatuses.filter(s => s.status === 'error').length;
  const processedCount = completedCount + failedCount;
  const progressPercent = total > 0 ? Math.round((processedCount / total) * 100) : 0;

  // Determina a cor da barra: instalação (verde), desinstalação (rosa), mista usa verde (ação predominante no Mint)
  const progressBarColor =
    actionType === 'uninstall'
      ? 'bg-rose-500'
      : 'bg-[#87cf3e]';

  const handleExportLogs = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logContent = [
        `==================================================`,
        `Mint Install Pro - Registro de Operações em Lote`,
        `Data: ${new Date().toLocaleString()}`,
        `Tipo: ${actionType}`,
        `Total de Aplicativos: ${total}`,
        `Concluídos com Sucesso: ${completedCount}/${total}`,
        `Falhas: ${failedCount}`,
        `==================================================\n`,
        ...logs
      ].join('\n');

      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mint-install-pro-batch-${timestamp}.log`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      debugLog('info', 'BatchActionModal', 'log exportado pelo usuário', {
        lines: logs.length
      });
    } catch (err) {
      debugLog('error', 'BatchActionModal', 'falha ao exportar log', {
        error: String(err)
      });
    }
  };

  if (!confirmed) return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Confirmar operações em lote">
      <div className="bg-[#2a2d32] border border-[#3b3f46] rounded-lg p-6 max-w-xl text-white space-y-4">
        <h3 className="font-bold">Confirmar operações em lote</h3>
        <p>{appStatuses.filter(a => a.action === 'install').length} para instalar e {appStatuses.filter(a => a.action === 'uninstall').length} para remover.</p>
        <ul className="max-h-48 overflow-y-auto text-sm">{appStatuses.map(a => <li key={a.id}>{a.action === 'install' ? 'Instalar' : 'Remover'}: {a.name}</li>)}</ul>
        <p className="text-xs text-[#a4a9b2]">O lote solicita uma única autorização administrativa quando necessária. Flatpaks serão instalados para seu usuário. A remoção inclui as instalações do usuário e do sistema.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2">Cancelar</button>
          <button onClick={() => setConfirmed(true)} className="px-4 py-2 rounded bg-[#87cf3e] text-black">Confirmar e executar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#2a2d32] border border-[#3b3f46] rounded-lg max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#e0e0e0]">

        {/* Header */}
        <div className="px-5 py-3.5 bg-[#202326] border-b border-[#1b1c1e] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {actionType === 'install' ? (
              <div className="p-1 rounded bg-[#87cf3e]/20 text-[#87cf3e]">
                <Download className="w-4 h-4" />
              </div>
            ) : actionType === 'uninstall' ? (
              <div className="p-1 rounded bg-rose-500/20 text-rose-400">
                <Trash2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1 rounded bg-[#87cf3e]/20 text-[#87cf3e]">
                <Play className="w-4 h-4 fill-current" />
              </div>
            )}
            <h3 className="text-sm font-bold text-white">
              {actionType === 'install'
                ? 'Instalação em Lote'
                : actionType === 'uninstall'
                  ? 'Desinstalação em Lote'
                  : 'Execução de Ações em Lote'} ({targetApps.length} {targetApps.length === 1 ? 'aplicativo' : 'aplicativos'})
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#a4a9b2]">
                {isFinished
                  ? `Operação finalizada: ${completedCount} sucesso(s), ${failedCount} falha(s).`
                  : `Processando item ${Math.min(currentIndex + 1, total)} de ${total}...`}
              </span>
              <span className="font-semibold text-white font-mono">
                {progressPercent}% ({processedCount}/{total})
              </span>
            </div>
            <div className="w-full bg-[#1b1c1e] rounded-full h-2.5 overflow-hidden border border-[#35393f]">
              <div
                className={`h-full transition-all duration-300 rounded-full ${progressBarColor}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Apps List Status */}
          <div className="bg-[#202226] border border-[#32363c] rounded-md divide-y divide-[#2a2d33] max-h-48 overflow-y-auto">
            {appStatuses.map((app) => (
              <div key={app.id} className="p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#2e3136] flex items-center justify-center flex-shrink-0">
                    {app.icon ? (
                      <img src={app.icon} alt={app.name} className="w-5 h-5 object-contain" />
                    ) : (
                      <Package className="w-4 h-4 text-[#8e95a0]" />
                    )}
                  </div>
                  <span className="text-white font-medium truncate">{app.name}</span>
                </div>

                <div>
                  {app.status === 'pending' && (
                    <span className="text-[#7d828a] text-[11px]">Aguardando...</span>
                  )}
                  {app.status === 'processing' && (
                    <span className="inline-flex items-center text-[#87cf3e] text-[11px] font-medium">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      {app.action === 'install' ? 'Instalando' : 'Removendo'}
                    </span>
                  )}
                  {app.status === 'error' && <span className="text-rose-400">Falhou</span>}
                  {app.status === 'done' && (
                    <span className="inline-flex items-center text-[#55b335] text-[11px] font-semibold">
                      <Check className="w-3.5 h-3.5 mr-0.5 stroke-[3]" />
                      {app.action === 'install' ? 'Instalado' : 'Removido'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Terminal / Live Logs */}
          <div>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-[#8e95a0] mb-1 uppercase tracking-wider">
              <Terminal className="w-3 h-3" />
              <span>Saída do Processo (Registro da operação)</span>
            </div>
            <div className="bg-[#161719] border border-[#2b2e33] rounded p-2.5 font-mono text-[11px] text-[#a0a5ad] h-24 overflow-y-auto space-y-0.5">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-[#6ea730]">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#202326] border-t border-[#1b1c1e] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-[#7d828a]">
              {isFinished ? (failedCount ? 'Revise as falhas no registro.' : 'Operações concluídas.') : 'Não feche esta janela durante a execução.'}
            </span>
            {isFinished && (
              <button
                type="button"
                onClick={handleExportLogs}
                className="inline-flex items-center space-x-1.5 text-xs text-[#a4a9b2] hover:text-white px-2 py-1 rounded bg-[#2c2f35] hover:bg-[#383c44] border border-[#3b3f46] transition-colors"
                title="Exportar registros da execução para arquivo .log"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Salvar Log</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={!isFinished}
            className={`px-5 py-1.5 rounded text-xs font-semibold transition-all ${
              isFinished
                ? 'bg-[#87cf3e] hover:bg-[#97df4e] text-[#132802] shadow-md cursor-pointer'
                : 'bg-[#35393f] text-[#7d828a] cursor-not-allowed opacity-50'
            }`}
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
}

BatchActionModal.propTypes = {
  actionType: PropTypes.oneOf(['install', 'uninstall', 'mixed']).isRequired,
  targetApps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    installed: PropTypes.bool,
    batchAction: PropTypes.string
  })).isRequired,
  onClose: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired
};
