import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={28} className="text-error-400" />
          </div>

          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-[#71717a] text-sm mb-6 leading-relaxed">
            An unexpected error occurred. You can refresh the page or return to the homepage.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="text-left mb-6 p-4 bg-[#151520] rounded-xl border border-[#2a2a3c] text-xs text-[#71717a] font-mono overflow-auto max-h-40">
              <summary className="cursor-pointer text-error-400 mb-2 font-semibold">
                Error details (dev only)
              </summary>
              {this.state.error.toString()}
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2.5 bg-[#1c1c2e] border border-[#2a2a3c] text-[#e4e4e7] rounded-xl text-sm font-medium hover:bg-[#2a2a3c] transition-all flex items-center gap-2"
            >
              <Home size={14} />
              Homepage
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2.5 bg-brand-400 text-[#0a0a0f] rounded-xl text-sm font-semibold hover:bg-brand-500 transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Refresh page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
