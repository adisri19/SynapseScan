'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../lib/store';
import { BRAND } from '../lib/constants';
import { GitHubUrlForm } from '../components/ingestion/github-url-form';
import { ProgressStepper } from '../components/ingestion/progress-stepper';
import { LogoMark } from '../components/ui/logo';

export default function Home() {
  const router = useRouter();
  const { setCurrentRunId, setDashboardData } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async (repoUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          repoUrl,
          triggeredBy: 'Enterprise Administrator'
        }),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text || 'An error occurred on the server.' };
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze repository');
      }

      if (result.success && result.data) {
        setCurrentRunId(result.data.run.id);
        setDashboardData(result.data);
        router.push(`/dashboard?runId=${result.data.run.id}`);
      } else {
        throw new Error('Analysis completed but run details were missing.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Layer 1 — drifting aurora */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="aurora-a absolute top-1/4 left-1/4 w-[38rem] h-[38rem] rounded-full bg-[#10B981]/10 blur-3xl" />
        <div className="aurora-b absolute bottom-1/4 right-1/4 w-[34rem] h-[34rem] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Layer 2 — grid floor */}
      <div className="grid-floor absolute inset-0 pointer-events-none" />

      {/* Layer 3 — content */}
      <div className="relative w-full max-w-xl">
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-[#1F2937] rounded-2xl w-full p-8 md:p-10 shadow-2xl relative overflow-hidden rise-in">
          <div className="absolute top-0 left-1/4 w-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#10B981] to-transparent" />

          {/* Brand */}
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="relative mb-4">
              <div className="logo-halo absolute inset-0 rounded-xl bg-[#10B981]/20 blur-lg" />
              <div className="relative w-14 h-14 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl flex items-center justify-center text-[#10B981]">
                <LogoMark className="w-8 h-8" animated />
              </div>
            </div>

            <span className="text-[#10B981] text-[10px] font-mono uppercase font-bold tracking-widest leading-none">
              {BRAND.tagline}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              {BRAND.name}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-sm leading-relaxed">
              Run real-time AST scans, code complexity analytics, duplication rates, and debt
              remediation tracking for public GitHub repositories.
            </p>
          </div>

          {/* Capability strip */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { k: 'AST', v: 'Deep parse' },
              { k: 'AI', v: 'Groq audit' },
              { k: 'CI', v: 'Webhooks' },
            ].map((item) => (
              <div
                key={item.k}
                className="bg-[#0B0F17]/60 border border-[#1F2937] rounded-lg px-2 py-2.5 text-center transition duration-200 hover:border-[#10B981]/40 hover:bg-[#10B981]/5"
              >
                <span className="block text-[#10B981] font-mono text-[11px] font-bold tracking-wider">
                  {item.k}
                </span>
                <span className="block text-slate-500 text-[9px] font-sans mt-0.5">{item.v}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1F2937] pt-6 space-y-6">
            <GitHubUrlForm onSubmit={handleRunAudit} isLoading={isLoading} error={error} />
            <ProgressStepper isAnalyzing={isLoading} />
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/40 text-center">
            <span className="text-slate-600 text-[10px] font-mono tracking-widest uppercase inline-flex items-center gap-2">
              <span className="status-dot w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              {BRAND.footerText}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
