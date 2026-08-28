'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tech Debt Platform uncaught render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent blur-sm" />
            
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold font-mono text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-6 text-sm">
              An unexpected error occurred while rendering the dashboard metrics or visuals.
            </p>
            
            <div className="bg-[#0B0F17] border border-[#1F2937] rounded-xl p-4 text-left font-mono text-xs text-red-400 overflow-x-auto max-h-40 mb-6">
              {this.state.error?.toString()}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#1F2937] hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700/50 transition duration-150 py-3 rounded-xl font-semibold text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
