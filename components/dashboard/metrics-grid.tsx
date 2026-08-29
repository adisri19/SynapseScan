import React from 'react';
import { useRouter } from 'next/navigation';
import { KpiCard } from '../ui/kpi-card';

interface MetricsGridProps {
  overallScore: 'A' | 'B' | 'C' | 'D' | 'F';
  totalLoc: number;
  duplicationRate: number;
  avgComplexity: number;
  estimatedDebtHours: number;
  highRiskFilesCount: number;
  runId: string;
}

export function MetricsGrid({
  overallScore,
  totalLoc,
  duplicationRate,
  avgComplexity,
  estimatedDebtHours,
  highRiskFilesCount,
  runId
}: MetricsGridProps) {
  const router = useRouter();

  const scoreColors = {
    A: 'text-emerald-400',
    B: 'text-green-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-500'
  };

  const scoreColor = scoreColors[overallScore] || 'text-white';

  // Financial Cost calculation ($100/hr developer rate)
  const estimatedCost = estimatedDebtHours * 100;

  return (
    <div className="space-y-6 w-full">
      {/* Financial Cost of Technical Debt Banner (Highly visible, styled red/amber warning) */}
      <div className="bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 rounded-xl p-5 shadow-xl relative overflow-hidden transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Pulsing red left border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 status-dot" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 min-w-0">
          <div className="w-11 h-11 min-w-[44px] rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg shadow-red-950/20">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest block leading-none">
              Financial Liability Exposure
            </span>
            <h3 className="text-white text-base md:text-lg font-bold font-sans tracking-tight mt-1.5 leading-snug">
              Estimated Cost of Technical Debt: <span className="text-red-500 font-mono font-black">${estimatedCost.toLocaleString()}</span>
            </h3>
            <p className="text-slate-400 text-xs mt-1 leading-normal max-w-xl">
              Calculated dynamically at a <span className="text-slate-300 font-mono font-bold">$100/hr</span> standard industry developer rate across your <span className="text-slate-300 font-mono font-bold">{estimatedDebtHours} hours</span> of outstanding code debt.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/review?runId=${runId}`)}
          className="bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold px-4 py-2.5 rounded-lg border border-red-500/20 transition shrink-0 self-start md:self-auto cursor-pointer"
        >
          View Debt Hotspots →
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Code Quality Score */}
        <KpiCard
          label="Code Quality Score"
          value={<span className={scoreColor}>{overallScore}</span>}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          iconBgClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          cta={{
            label: 'Go to Review →',
            onClick: () => router.push(`/review?runId=${runId}`)
          }}
        />

        {/* High Risk Files */}
        <KpiCard
          label="High Risk Files"
          value={highRiskFilesCount}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          iconBgClass="bg-amber-500/10 border-amber-500/20 text-amber-400"
          cta={{
            label: 'Inspect Issues →',
            onClick: () => router.push(`/review?runId=${runId}&severity=critical`)
          }}
        />

        {/* Estimated Debt Hours */}
        <KpiCard
          label="Estimated Debt Hours"
          value={`${estimatedDebtHours} hrs`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          iconBgClass="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          cta={{
            label: 'View Full Report →',
            onClick: () => router.push(`/review?runId=${runId}`)
          }}
        />

        {/* LOC & Duplication */}
        <KpiCard
          label="Volume &amp; Duplication"
          value={
            <div className="flex flex-col">
              <span className="text-white text-xl leading-snug">{new Intl.NumberFormat().format(totalLoc)} LOC</span>
              <span className={`text-xs font-semibold leading-none ${duplicationRate > 20 ? 'text-red-500' : duplicationRate > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                Dup Rate: {duplicationRate.toFixed(1)}%
              </span>
            </div>
          }
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
          iconBgClass="bg-slate-500/10 border-slate-500/20 text-slate-400"
          cta={{
            label: 'View Audited Data →',
            onClick: () => router.push(`/logs`)
          }}
        />
      </div>
    </div>
  );
}
export default MetricsGrid;
