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
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={24} className="text-red-500" />
          </div>

          <h1 className="text-xl font-bold text-[#1C1917] mb-2">Something went wrong</h1>
          <p className="text-[#78716C] text-sm mb-6 leading-relaxed">
            An unexpected error occurred. You can refresh the page or return to the homepage.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="text-left mb-6 p-4 bg-white border border-[#E8E3DB] text-xs text-[#78716C] font-mono overflow-auto max-h-40">
              <summary className="cursor-pointer text-red-500 mb-2 font-semibold">
                Error details (dev only)
              </summary>
              {this.state.error.toString()}
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2.5 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[#78716C] hover:text-[#1C1917] text-sm font-medium transition-all flex items-center gap-2"
            >
              <Home size={14} />
              Homepage
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2.5 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold transition-colors flex items-center gap-2"
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
