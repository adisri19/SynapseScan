'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../lib/store';
import { BRAND } from '../lib/constants';
import { GitHubUrlForm } from '../components/ingestion/github-url-form';
import { ProgressStepper } from '../components/ingestion/progress-stepper';

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
      {/* Dynamic blurred background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#10B981]/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl" />

      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-xl w-full p-8 md:p-10 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/4 w-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#10B981] to-transparent" />

        {/* Brand Logo & title details */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl flex items-center justify-center text-[#10B981] mb-4">
            <span className="font-mono font-bold text-[#10B981] text-lg">&lt;/&gt;</span>
          </div>
          <span className="text-[#10B981] text-[10px] font-mono uppercase font-bold tracking-widest leading-none">
            {BRAND.tagline}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-3">
            {BRAND.name}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-sm leading-relaxed">
            Run real-time AST scans, code complexity analytics, duplication rates, and debt remediation tracking for public GitHub repositories.
          </p>
        </div>

        <div className="border-t border-[#1F2937] pt-6 space-y-6">
          <GitHubUrlForm 
            onSubmit={handleRunAudit}
            isLoading={isLoading}
            error={error}
          />

          {/* Animated loading percentage stepper overlay/container */}
          <ProgressStepper isAnalyzing={isLoading} />
        </div>

        {/* Footer powered wordmark */}
        <div className="mt-8 pt-4 border-t border-slate-800/40 text-center">
          <span className="text-slate-600 text-[10px] font-mono tracking-widest uppercase block">
            {BRAND.footerText}
          </span>
        </div>
      </div>
    </main>
  );
}
