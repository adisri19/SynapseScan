'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '../../lib/store';
import { PageHeader } from '../../components/layout/page-header';
import { MetricsGrid } from '../../components/dashboard/metrics-grid';
import { ComplexityChart } from '../../components/dashboard/complexity-chart';
import { DebtDonutChart } from '../../components/dashboard/debt-donut-chart';
import { DebtTrendsChart } from '../../components/dashboard/debt-trends-chart';
import { ErrorBoundary } from '../../components/error-boundary';
import { DashboardData } from '../../lib/types';
import { generateAuditReport } from '../../lib/generate-report';
import { fetchAllAiNarratives } from '../../lib/ai-report-narratives';
import { ExportModal } from '../../components/ui/export-modal';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = searchParams.get('runId');

  const { tenantName, currentRunId, setCurrentRunId, dashboardData, setDashboardData } = useAppStore();
  const [loading, setLoading] = useState(!dashboardData || (runId !== null && runId !== currentRunId));
  const [error, setError] = useState<string | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState('');

  const handleExportReport = async () => {
    if (!runId || !dashboardData) return;
    setIsExporting(true);
    try {
      setExportStep('Fetching AI narratives...');
      const narratives = await fetchAllAiNarratives(runId, dashboardData);

      setExportStep('Building cover page...');
      await new Promise(r => setTimeout(r, 400));

      setExportStep('Rendering charts...');
      await new Promise(r => setTimeout(r, 400));

      setExportStep('Generating PDF...');
      await generateAuditReport(dashboardData, narratives);

      setExportStep('Done!');
    } catch (err) {
      console.error('Export failed:', err);
      setExportStep('Export failed. Check console.');
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  useEffect(() => {
    if (!runId) {
      setError('No analysis run target identified. Please ingestion-setup a repository first.');
      setLoading(false);
      return;
    }

    // Skip fetch if state is already loaded with matching runId
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
          throw new Error(result.error || 'Failed to fetch dashboard data');
        }

        setCurrentRunId(result.data.run.id);
        setDashboardData(result.data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard.');
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
            <div key={i} className="h-32 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          <div className="lg:col-span-2 h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl relative">
          <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-[#10B981] to-transparent blur-sm" />
          <h2 className="text-2xl font-bold font-mono text-emerald-400 mb-4">No Run Selected</h2>
          <p className="text-slate-400 mb-6 text-sm">
            {error || 'Select or set up a repository to initiate code analysis.'}
          </p>
          <button
            onClick={() => router.push('/ingestion')}
            className="px-6 py-3 bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 transition duration-150 rounded-lg font-semibold font-sans text-sm shadow-md"
          >
            Setup Repository
          </button>
        </div>
      </div>
    );
  }

  const { run, files, historicalRuns } = dashboardData;
  const highRiskFiles = files.filter(f => f.score === 'F' || f.score === 'D').length;

  const headerActions = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/ingestion')}
        className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold rounded-lg px-4 py-2 text-xs transition-colors"
      >
        <svg
          className="w-4 h-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Run Full Repos Audit</span>
      </button>
      <button
        onClick={handleExportReport}
        className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-slate-800/40 text-slate-300 border border-[#1F2937] font-semibold rounded-lg px-4 py-2 text-xs transition-colors"
      >
        <svg
          className="w-4 h-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Export Audit Report</span>
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <PageHeader
        tenantName={tenantName}
        title="Code Audit Dashboard"
        subtitle={`System metrics overview for repository: ${dashboardData.repository.owner}/${dashboardData.repository.name}`}
        actions={headerActions}
      />

      <div className="p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto pb-12">
        <ErrorBoundary>
          {/* Metrics stat grid */}
          <MetricsGrid
            overallScore={run.overallScore}
            totalLoc={run.totalLoc}
            duplicationRate={run.duplicationRate}
            avgComplexity={run.avgComplexity}
            estimatedDebtHours={run.estimatedDebtHours}
            highRiskFilesCount={highRiskFiles}
            runId={run.id}
          />

          {/* Two-column layout with Complexity and Donut Category plot */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 items-start">
            <div className="lg:col-span-3">
              <ComplexityChart files={files} />
            </div>
            <div className="lg:col-span-2">
              <DebtDonutChart categories={run.debtCategories} overallScore={run.overallScore} />
            </div>
          </div>

          {/* Trends history Composed chart */}
          <div className="w-full">
            <DebtTrendsChart historicalRuns={historicalRuns} />
          </div>
        </ErrorBoundary>
      </div>

      <ExportModal isOpen={isExporting} currentStep={exportStep} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 flex flex-col space-y-6">
        <div className="h-8 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
          <div className="lg:col-span-2 h-[450px] bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
