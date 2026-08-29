'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '../../lib/store';
import { PageHeader } from '../../components/layout/page-header';
import { ReviewFilterPanel } from '../../components/review/review-filter-panel';
import { ReviewResultsPanel } from '../../components/review/review-results-panel';
import { ErrorBoundary } from '../../components/error-boundary';
import { DashboardData } from '../../lib/types';

function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = searchParams.get('runId');

  const { tenantName, currentRunId, setCurrentRunId, dashboardData, setDashboardData, reviewFilters, setReviewFilters } = useAppStore();
  const [loading, setLoading] = useState(!dashboardData || (runId !== null && runId !== currentRunId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setError('Please identify an active audit run. Configure a repository first.');
      setLoading(false);
      return;
    }

    if (dashboardData && runId === currentRunId) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/runs/${runId}`);
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = { error: text || 'An error occurred on the server.' };
        }

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch review console metrics');
        }

        setCurrentRunId(result.data.run.id);
        setDashboardData(result.data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load review workspace.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [runId, currentRunId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 flex flex-col space-y-6">
        <div className="h-8 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl relative">
          <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-[#10B981] to-transparent blur-sm" />
          <h2 className="text-2xl font-bold font-mono text-emerald-400 mb-4">No Active Ingestion</h2>
          <p className="text-slate-400 mb-6 text-sm">
            {error || 'No codebase details populated. Please set up a repository first.'}
          </p>
          <button
            onClick={() => router.push('/ingestion')}
            className="px-6 py-3 bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 transition duration-150 rounded-lg font-semibold font-sans text-sm shadow-md"
          >
            Configure Repository
          </button>
        </div>
      </div>
    );
  }

  const { files } = dashboardData;

  // Derive mini-metrics for top row console strip
  const totalFiles = files.length;
  const flaggedCount = files.filter(f => f.reviewStatus === 'flagged').length;
  const refactorCount = files.filter(f => f.reviewStatus === 'needs_refactor').length;
  const passedCount = files.filter(f => f.reviewStatus === 'passed').length;
  const passedVolumeLoc = files.filter(f => f.reviewStatus === 'passed').reduce((sum, f) => sum + f.linesOfCode, 0);

  // Extract unique module prefixes for filter dropdown
  const uniqueModules = Array.from(
    new Set(
      files
        .map(f => {
          const parts = f.filePath.split('/');
          return parts.length > 1 ? parts[0] : '';
        })
        .filter(m => m !== '')
    )
  ).sort();

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <PageHeader
        tenantName={tenantName}
        title="Review Console"
        subtitle={`Audit results and remediation inspector for: ${dashboardData.repository.owner}/${dashboardData.repository.name}`}
      />

      <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto pb-12">
        <ErrorBoundary>
          {/* Mini KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Pending Review</span>
              <span className="text-xl md:text-2xl font-bold font-mono text-white mt-1.5">{flaggedCount + refactorCount} files</span>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Flagged Issues</span>
              <span className="text-xl md:text-2xl font-bold font-mono text-amber-400 mt-1.5">{flaggedCount} critical</span>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Certified Passed</span>
              <span className="text-xl md:text-2xl font-bold font-mono text-emerald-400 mt-1.5">{passedCount} files</span>
            </div>
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Certified Volume</span>
              <span className="text-xl md:text-2xl font-bold font-mono text-slate-300 mt-1.5">
                {new Intl.NumberFormat().format(passedVolumeLoc)} LOC
              </span>
            </div>
          </div>

          {/* Main Content: Left Filter Panel + Right Results console list layout */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-72 shrink-0">
              <ReviewFilterPanel
                filters={reviewFilters}
                onChange={setReviewFilters}
                uniqueModules={uniqueModules}
              />
            </div>
            
            <ReviewResultsPanel
              files={files}
              filters={reviewFilters}
            />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 flex flex-col space-y-6">
        <div className="h-8 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
