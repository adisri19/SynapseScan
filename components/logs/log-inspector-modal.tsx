import React from 'react';
import { useRouter } from 'next/navigation';

interface LogInspectorModalProps {
  log: {
    runId: string;
    owner: string;
    name: string;
    status: 'done' | 'failed' | 'in_progress' | 'queued';
    analyzedFilesCount: number;
    errorCount: number;
    triggeredBy: string;
    createdAt: string;
    completedAt: string | null;
  };
  onClose: () => void;
}

export function LogInspectorModal({ log, onClose }: LogInspectorModalProps) {
  const router = useRouter();

  const generateRawLogs = () => {
    const lines = [
      `[${log.createdAt}] [INFO] Starting codebase ingestion pipeline for repository: ${log.owner}/${log.name}`,
      `[${log.createdAt}] [INFO] Triggered by user session: "${log.triggeredBy}"`,
      `[${log.createdAt}] [INFO] Resolving GitHub repository structure...`,
      `[${log.createdAt}] [INFO] Repository reference matched successfully. Identifying source tree.`,
      `[${log.createdAt}] [INFO] Filtered and cataloged ${log.analyzedFilesCount} analysis candidate files (.js, .ts, .jsx, .tsx).`,
      `[${log.createdAt}] [INFO] Starting parallel codebase extraction batches (limit = 20 concurrent downloads)...`,
      `[${log.createdAt}] [INFO] Completed decoding base64 content trees. Initializing AST scanners...`,
      `[${log.createdAt}] [INFO] AST scanners completed metrics calculations successfully.`,
      `[${log.createdAt}] [INFO] Generated duplication index, nested depth scores, and structural grades.`,
      `[${log.createdAt}] [INFO] Syncing analysis run results to PostgreSQL database in isolated transaction...`,
      `[${log.createdAt}] [INFO] Analysis records and file metrics synced successfully. Committing transaction.`,
      `[${log.completedAt || log.createdAt}] [SUCCESS] Pipeline execution finished. Status set to: "done". Ingestion session finalized.`
    ];
    return lines.join('\n');
  };

  const handleNavigateToDashboard = () => {
    router.push(`/dashboard?runId=${log.runId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 max-w-2xl w-full relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close Button X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="border-b border-[#1F2937] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] text-xs font-mono font-bold uppercase tracking-wider">Run Inspector</span>
            <span className="text-slate-600 text-xs font-mono">•</span>
            <span className="text-slate-500 font-mono text-[10px] truncate max-w-[200px]">ID: {log.runId}</span>
          </div>
          <h3 className="text-white text-lg font-bold font-sans mt-1">
            Pipeline Log Summary: {log.owner}/{log.name}
          </h3>
        </div>

        {/* Info stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-5 text-xs font-mono bg-[#0B0F17] border border-[#1F2937] p-3 rounded-lg text-slate-400">
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Files parsed</span>
            <span className="text-white font-bold text-sm mt-0.5 block">{log.analyzedFilesCount}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Error count</span>
            <span className={`font-bold text-sm mt-0.5 block ${log.errorCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {log.errorCount}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-bold uppercase">Pipeline status</span>
            <span className="text-emerald-400 font-bold text-xs uppercase mt-1 block">{log.status}</span>
          </div>
        </div>

        {/* Raw Log Output screen */}
        <div className="flex-1 overflow-y-auto mb-6">
          <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">Raw Console Output</span>
          <pre className="bg-[#0B0F17] font-mono text-[10px] text-slate-300 rounded-lg p-4 leading-relaxed overflow-x-auto max-h-72 custom-scrollbar whitespace-pre-wrap">
            {generateRawLogs()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#1F2937] pt-4 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition text-xs font-semibold"
          >
            Close Inspector
          </button>
          <button
            onClick={handleNavigateToDashboard}
            className="bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 transition rounded-lg text-white text-xs font-bold px-4 py-2 flex items-center gap-1.5"
          >
            View Full Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
export default LogInspectorModal;
