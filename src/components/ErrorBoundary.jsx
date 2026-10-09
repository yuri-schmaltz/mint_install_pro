// ErrorBoundary: captura exceções não-tratadas em qualquer filho da árvore
// React e renderiza uma tela GTK-style de erro com botão "Recarregar".
// Resolve débito #12 do gauntlet loop 1.3.2.

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { pushLastReactError } from '../services/debugLog';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro não-tratado:', error, errorInfo);
    // Persiste o erro em localStorage para diagnóstico após reiniciar.
    try {
      pushLastReactError(error, errorInfo?.componentStack);
    } catch (_) {
      // ignore — debugLog não pode quebrar ErrorBoundary
    }
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    // Tenta limpar caches conhecidos e recarregar
    try {
      localStorage.removeItem('mint_installed_map_v1');
      localStorage.removeItem('mint_apps_state_v5');
      localStorage.removeItem('mint_settings_v1');
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-full h-screen bg-[#26292d] flex items-center justify-center p-4">
        <div className="bg-[#2a2d32] border border-[#3c4149] rounded-lg max-w-md w-full p-6 text-center shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-rose-400" />
          </div>
          <h1 className="text-base font-bold text-white mb-2">
            Algo deu errado
          </h1>
          <p className="text-xs text-[#a4a9b2] leading-relaxed mb-4">
            O Mint Install Pro encontrou um erro inesperado.
            Você pode tentar recarregar a aplicação ou limpar os caches locais
            se o problema persistir.
          </p>
          {this.state.error && (
            <details className="text-left mb-4 text-[11px] text-[#7d828a] bg-[#202226] border border-[#32363c] rounded p-2.5 max-h-32 overflow-y-auto">
              <summary className="cursor-pointer text-[#a4a9b2] font-medium mb-1">
                Detalhes técnicos
              </summary>
              <code className="block whitespace-pre-wrap break-words font-mono text-[10px] text-rose-300">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack?.split('\n').slice(0, 5).join('\n')}
              </code>
            </details>
          )}
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={this.handleReload}
              className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#87cf3e] hover:bg-[#97df4e] text-[#132802] font-semibold text-xs transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recarregar</span>
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded bg-[#35393f] hover:bg-[#434850] text-[#e0e0e0] font-medium text-xs border border-[#444a53] transition-colors"
            >
              Limpar caches e recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {}; // sem props tipadas
