import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';

interface GitHubUrlFormProps {
  onSubmit: (repoUrl: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function GitHubUrlForm({ onSubmit, isLoading, error }: GitHubUrlFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const { tenantName } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl || isLoading) return;
    onSubmit(repoUrl);
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="repoUrl" className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-bold">
            GitHub Repository URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or owner/repo"
              required
              disabled={isLoading}
              className="flex-1 bg-[#0B0F17] border border-[#1F2937] text-white placeholder-slate-600 rounded-lg px-4 py-3 font-mono text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !repoUrl}
              className="bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 transition duration-150 px-6 py-3 rounded-lg font-semibold text-sm tracking-wide shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Run Repository Audit</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-500">
            <span>Format: <code className="text-slate-400">https://github.com/owner/repo</code> or <code className="text-slate-400">owner/repo</code>. Examples:</span>
            <button
              type="button"
              onClick={() => setRepoUrl('https://github.com/expressjs/express')}
              className="hover:text-[#10B981] underline cursor-pointer"
            >
              expressjs/express
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setRepoUrl('https://github.com/facebook/react')}
              className="hover:text-[#10B981] underline cursor-pointer"
            >
              facebook/react
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs font-mono text-center">
          {error}
        </div>
      )}
    </div>
  );
}
export default GitHubUrlForm;
