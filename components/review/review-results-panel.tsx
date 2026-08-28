import React, { useState } from 'react';
import { FileMetric, ReviewFilters } from '../../lib/types';
import { GradeBadge } from '../ui/grade-badge';
import { ReviewStatusTag } from '../ui/review-status-tag';

interface ReviewResultsPanelProps {
  files: FileMetric[];
  filters: ReviewFilters;
}

export function ReviewResultsPanel({ files, filters }: ReviewResultsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileMetric | null>(null);

  // Apply search filtering client-side
  const filteredFiles = files.filter((file) => {
    // Search Term filter
    if (searchTerm && !file.filePath.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Review Status filter
    if (filters.status !== 'All Statuses' && file.reviewStatus !== filters.status) {
      return false;
    }

    // Severity grade filter
    if (filters.severity !== 'All Levels' && file.score !== filters.severity) {
      return false;
    }

    // Module path filter
    if (filters.module !== 'All Modules') {
      const isMatch = file.filePath.startsWith(filters.module) || file.filePath.includes(`/${filters.module}`);
      if (!isMatch) return false;
    }

    return true;
  });

  const handleSelectFile = (file: FileMetric) => {
    setSelectedFile(file);
  };

  const getAnnotatedIssues = (file: FileMetric) => {
    const issues = [];
    if (file.maxNestingDepth >= 5) {
      issues.push(`Deep block nesting detected inside this module (reaches max depth: ${file.maxNestingDepth}).`);
    }
    if (file.outdatedPatternsCount > 0) {
      issues.push(`Identified ${file.outdatedPatternsCount} occurrences of deprecated syntax patterns (var declarations, excessive logging, callback trees).`);
    }
    if (file.linesOfCode > 400) {
      issues.push(`High Lines of Code footprint (${file.linesOfCode} lines). Sub-dividing into granular utilities highly advised.`);
    }
    if (issues.length === 0) {
      issues.push('No critical tech-debt indicators identified. Codebase structure matches quality guidelines.');
    }
    return issues;
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-6 h-[600px]">
      {/* LEFT: File results table panel (flex-1) */}
      <div className="flex-1 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col h-full overflow-hidden">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-[#1F2937] flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search file path, component name..."
            className="flex-1 bg-[#0B0F17] border border-[#1F2937] text-white placeholder-slate-600 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        {/* Scrollable List Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
          {filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 font-sans">
              <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No matching repository files identified. Try resetting the criteria.</span>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.id || file.filePath}
                onClick={() => handleSelectFile(file)}
                className={`p-4 flex items-center justify-between cursor-pointer transition duration-150 ${
                  selectedFile?.filePath === file.filePath
                    ? 'bg-slate-800/40 border-l-2 border-emerald-500'
                    : 'hover:bg-slate-800/20'
                }`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-white text-xs font-mono font-medium truncate" title={file.filePath}>
                    {file.filePath}
                  </h4>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-slate-500">
                    <span>LOC: {file.linesOfCode}</span>
                    <span>•</span>
                    <span>Depth: {file.maxNestingDepth}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <ReviewStatusTag status={file.reviewStatus} />
                  <GradeBadge grade={file.score} size="sm" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Selected File Details Inspector panel */}
      <div className="w-full xl:w-96 bg-[#111827] border border-[#1F2937] rounded-xl flex flex-col h-full overflow-hidden shadow-lg">
        {selectedFile ? (
          <div className="flex-col h-full flex overflow-hidden">
            {/* Header file details */}
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-white font-mono text-xs font-semibold truncate leading-tight" title={selectedFile.filePath}>
                {selectedFile.filePath.split('/').pop()}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-1 break-all truncate" title={selectedFile.filePath}>
                Path: {selectedFile.filePath}
              </p>
            </div>

            {/* Scrollable details view */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              {/* Scorecard KPIs */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#0B0F17] border border-slate-800/80 p-3 rounded-lg">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-slate-500">Grade</span>
                  <span className="block mt-1"><GradeBadge grade={selectedFile.score} size="sm" /></span>
                </div>
                <div className="bg-[#0B0F17] border border-slate-800/80 p-3 rounded-lg">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-slate-500">Score</span>
                  <span className="block text-sm font-bold font-mono text-white mt-1.5">
                    {selectedFile.priorityScore.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Recommended Remediation Action */}
              <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg p-4">
                <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#F59E0B]">
                  Recommended Action
                </span>
                <p className="text-slate-300 text-xs font-sans font-medium mt-1">
                  {selectedFile.recommendedAction}
                </p>
              </div>

              {/* Annotation Breakdown list */}
              <div className="space-y-2">
                <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Debt Annotations
                </span>
                <ul className="space-y-2.5 text-xs text-slate-400 font-sans list-none">
                  {getAnnotatedIssues(selectedFile).map((issue, idx) => (
                    <li key={idx} className="flex gap-2 items-start leading-relaxed border-b border-slate-800/40 pb-2">
                      <span className="text-[#10B981] font-bold shrink-0 font-mono">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 font-sans">
            <div className="w-12 h-12 bg-slate-800/30 border border-slate-700/20 text-slate-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h4 className="text-slate-300 font-semibold text-sm">Select File to Inspect</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Click on any codebase file from the table list to run direct debt audits and annotations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
export default ReviewResultsPanel;
