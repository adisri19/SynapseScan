import React from 'react';
import { FileMetric } from '../../lib/types';
import { GradeBadge } from '../ui/grade-badge';

interface WallOfFameShameProps {
  files: FileMetric[];
}

export function WallOfFameShame({ files }: WallOfFameShameProps) {
  // Sort files to find Wall of Fame (Best files: lowest priority score, highest grades)
  const wallOfFame = [...files]
    .sort((a, b) => a.priorityScore - b.priorityScore)
    .slice(0, 3);

  // Sort files to find Wall of Shame (Worst files: highest priority score, lowest grades)
  const wallOfShame = [...files]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Wall of Fame (Best Files) */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 md:p-6 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-bold font-sans text-sm">Codebase Wall of Fame</h4>
            <p className="text-slate-400 text-[10px] font-sans">Top 3 cleanest modules with minimal technical debt</p>
          </div>
        </div>

        <div className="space-y-3.5">
          {wallOfFame.map((file, idx) => {
            const filename = file.filePath.split('/').pop() || file.filePath;
            return (
              <div 
                key={file.id || file.filePath}
                className="flex items-center justify-between p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/20 rounded-lg transition duration-150"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className="font-mono text-xs font-bold text-emerald-400 shrink-0">#{idx + 1}</span>
                  <div className="min-w-0">
                    <span className="text-white text-xs font-mono font-medium truncate block" title={file.filePath}>
                      {filename}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate block mt-0.5" title={file.filePath}>
                      {file.filePath}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-slate-500">Score: {file.priorityScore.toFixed(0)}</span>
                  <GradeBadge grade={file.score} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wall of Shame (Worst Files) */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 md:p-6 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-bold font-sans text-sm">Codebase Wall of Shame</h4>
            <p className="text-slate-400 text-[10px] font-sans">Top 3 high-priority hotspots needing urgent refactoring</p>
          </div>
        </div>

        <div className="space-y-3.5">
          {wallOfShame.map((file, idx) => {
            const filename = file.filePath.split('/').pop() || file.filePath;
            return (
              <div 
                key={file.id || file.filePath}
                className="flex items-center justify-between p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-lg transition duration-150"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className="font-mono text-xs font-bold text-red-400 shrink-0">#{idx + 1}</span>
                  <div className="min-w-0">
                    <span className="text-white text-xs font-mono font-medium truncate block" title={file.filePath}>
                      {filename}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate block mt-0.5" title={file.filePath}>
                      {file.filePath}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-slate-500">Score: {file.priorityScore.toFixed(0)}</span>
                  <GradeBadge grade={file.score} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default WallOfFameShame;
