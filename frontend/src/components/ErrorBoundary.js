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
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="rounded-lg w-14 h-14 bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={24} className="text-red-500" />
          </div>

          <h1 className="text-xl font-bold text-[#1D1D1F] mb-2">Something went wrong</h1>
          <p className="text-[#6E6E73] text-sm mb-6 leading-relaxed">
            An unexpected error occurred. You can refresh the page or return to the homepage.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="text-left mb-6 p-4 rounded-xl bg-white border border-[#D2D2D7] text-xs text-[#6E6E73] font-mono overflow-auto max-h-40">
              <summary className="cursor-pointer text-red-500 mb-2 font-semibold">
                Error details (dev only)
              </summary>
              {this.state.error.toString()}
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-xl px-4 py-2.5 border border-[#D2D2D7] hover:border-[#BFBFC4] text-[#6E6E73] hover:text-[#1D1D1F] text-sm font-medium transition-all flex items-center gap-2"
            >
              <Home size={14} />
              Homepage
            </button>
            <button
              onClick={this.handleReset}
              className="rounded-full px-4 py-2.5 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-sm font-semibold transition-colors flex items-center gap-2"
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
