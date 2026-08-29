import React, { useState } from 'react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  const monthlyCompoundingCost = Math.round(estimatedCost * 0.15);

  return (
    <div className="space-y-6 w-full">
      {/* KPI Cards Grid - Extended to 5 columns for perfect modular sizing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
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

        {/* Debt Liability Budget (Compact card trigger) */}
        <KpiCard
          label="Remediation Budget"
          value={<span className="text-red-400">${estimatedCost.toLocaleString()}</span>}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          iconBgClass="bg-red-500/10 border-red-500/20 text-red-400 shadow-sm"
          cta={{
            label: 'Explain Cost Breakdown →',
            onClick: () => setIsModalOpen(true)
          }}
        />
      </div>

      {/* Interactive Modal explaining the technical debt math */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 max-w-md w-full relative shadow-2xl overflow-hidden flex flex-col">
            {/* Close cross */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-[#1F2937] pb-4 mb-4">
              <span className="text-red-400 text-xs font-mono font-bold uppercase tracking-wider">Financial Modeling</span>
              <h3 className="text-white text-lg font-bold font-sans mt-0.5">
                Technical Debt Budget Breakdown
              </h3>
            </div>

            <div className="space-y-4 text-sm font-sans text-slate-300 leading-relaxed">
              <div className="bg-[#0B0F17] border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block leading-none">
                  Calculated Liability
                </span>
                <span className="text-3xl font-mono font-black text-red-400 block mt-2">
                  ${estimatedCost.toLocaleString()}
                </span>
              </div>

              <div className="space-y-3 pt-2 text-xs md:text-sm">
                <p>
                  This codebase contains <strong className="text-white font-mono font-bold">{estimatedDebtHours} hours</strong> of outstanding technical debt based on calculated nesting layers, duplication overlaps, and syntax hot-spots.
                </p>
                <div className="flex justify-between items-center bg-[#0B0F17]/40 p-2.5 rounded-lg border border-slate-800/60 font-mono text-xs">
                  <span className="text-slate-500">Developer Blended Rate</span>
                  <span className="text-white font-bold">$100.00 / hr</span>
                </div>
                <div className="flex justify-between items-center bg-[#0B0F17]/40 p-2.5 rounded-lg border border-slate-800/60 font-mono text-xs">
                  <span className="text-slate-500">Monthly Compounding Cost (15%)</span>
                  <span className="text-red-400 font-bold">+${monthlyCompoundingCost.toLocaleString()} / mo</span>
                </div>
                <p className="text-slate-400 text-xs leading-normal pt-1">
                  Leaving this debt unresolved results in a <strong className="text-slate-300">15% compounding velocity drag</strong>, progressively slowing down your team&apos;s feature delivery rate. Refactoring now eliminates this liability immediately!
                </p>
              </div>
            </div>

            <div className="border-t border-[#1F2937] pt-4 mt-6 flex justify-end shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-lg transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MetricsGrid;
