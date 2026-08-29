'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import { useAppStore } from '../../lib/store';
import { PageHeader } from '../../components/layout/page-header';
import { AuditLogsTable } from '../../components/logs/audit-logs-table';
import { ErrorBoundary } from '../../components/error-boundary';

interface LogEntry {
  runId: string;
  repoUrl: string;
  owner: string;
  name: string;
  status: 'done' | 'failed' | 'in_progress' | 'queued';
  analyzedFilesCount: number;
  errorCount: number;
  triggeredBy: string;
  createdAt: string;
  completedAt: string | null;
}

function LogsContent() {
  const { tenantName } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/logs');
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = { error: text || 'An error occurred on the server.' };
        }

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch ingestion log registry');
        }

        setLogs(result.data || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load pipeline audit log registry.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 flex flex-col space-y-6">
        <div className="h-8 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="h-96 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl relative">
          <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-[#10B981] to-transparent blur-sm" />
          <h2 className="text-2xl font-bold font-mono text-emerald-400 mb-4">Registry Load Failed</h2>
          <p className="text-slate-400 mb-6 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 transition duration-150 rounded-lg font-semibold font-sans text-sm shadow-md"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <PageHeader
        tenantName={tenantName}
        title="Ingestion Batches Log"
        subtitle="Historical registry of pipeline analysis runs including file counts, statuses, and operators."
      />

      <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto pb-12">
        <ErrorBoundary>
          {/* Section Indicator */}
          <div className="space-y-1">
            <span className="text-[#10B981] text-xs font-mono font-bold uppercase tracking-widest block">
              Pipeline Registry
            </span>
            <h3 className="text-white text-lg font-bold font-sans">
              Recent Run Ingestions ({logs.length})
            </h3>
          </div>

          {/* Audit Logs Table */}
          {logs.length === 0 ? (
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-12 text-center text-slate-500 font-sans shadow-lg">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h4 className="text-slate-300 font-semibold text-sm">No Audit Runs Documented</h4>
              <p className="text-xs text-slate-500 mt-1">Configure your repository to kickstart automated AST scans.</p>
            </div>
          ) : (
            <AuditLogsTable logs={logs} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 flex flex-col space-y-6">
        <div className="h-8 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="h-96 bg-[#111827] border border-[#1F2937]/50 rounded-xl animate-pulse" />
      </div>
    }>
      <LogsContent />
    </Suspense>
  );
}
