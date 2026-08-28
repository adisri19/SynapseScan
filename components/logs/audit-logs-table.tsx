import React, { useState } from 'react';
import { StatusBadge } from '../ui/status-badge';
import { LogInspectorModal } from './log-inspector-modal';

interface AuditLogEntry {
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

interface AuditLogsTableProps {
  logs: AuditLogEntry[];
}

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  const [selectedLog, setSelectedFileLog] = useState<AuditLogEntry | null>(null);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB'); // formatted as 29/08/2026, 01:03:39 as specified
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-[#0B0F17] border-b border-[#1F2937] text-slate-400 font-mono">
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px]">Run Date / Time</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px]">Repository / Branch</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px] text-center">Status</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px] text-center">Analyzed Files</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px] text-center">Error Count</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px]">Triggered By</th>
              <th className="py-3 px-4 uppercase tracking-widest font-bold text-[10px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-sans text-slate-300">
            {logs.map((log, idx) => (
              <tr
                key={log.runId}
                className={`${idx % 2 === 1 ? 'bg-[#0B0F17]/40' : ''} hover:bg-slate-800/40 transition duration-150`}
              >
                <td className="py-4 px-4 font-mono text-slate-400">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="py-4 px-4 font-mono font-medium text-white truncate max-w-[200px]" title={`${log.owner}/${log.name}`}>
                  {log.owner}/{log.name} <span className="text-slate-500 font-normal">/ main</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <StatusBadge status={log.status} />
                </td>
                <td className="py-4 px-4 text-center font-mono font-semibold text-white">
                  {log.analyzedFilesCount}
                </td>
                <td className={`py-4 px-4 text-center font-mono ${log.errorCount > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                  {log.errorCount}
                </td>
                <td className="py-4 px-4 text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="truncate max-w-[120px]" title={log.triggeredBy}>{log.triggeredBy}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => setSelectedFileLog(log)}
                    className="text-[#10B981] hover:underline font-mono font-semibold hover:text-emerald-300 transition duration-150 text-xs shrink-0 cursor-pointer"
                  >
                    Inspect Run →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <LogInspectorModal
          log={selectedLog}
          onClose={() => setSelectedFileLog(null)}
        />
      )}
    </div>
  );
}
export default AuditLogsTable;
