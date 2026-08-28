import React from 'react';
import { ReviewFilters } from '../../lib/types';

interface ReviewFilterPanelProps {
  filters: ReviewFilters;
  onChange: (filters: Partial<ReviewFilters>) => void;
  uniqueModules: string[];
}

export function ReviewFilterPanel({ filters, onChange, uniqueModules }: ReviewFilterPanelProps) {
  const handleReset = () => {
    onChange({
      status: 'All Statuses',
      severity: 'All Levels',
      module: 'All Modules',
      startDate: '',
      endDate: ''
    });
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-5 shadow-lg shrink-0">
      {/* Search filters title header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="text-slate-400 text-xs font-mono font-bold uppercase tracking-widest">
          Search Filters
        </span>
      </div>

      {/* Review Status selector */}
      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          Review Status
        </label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
          className="bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-emerald-500"
        >
          <option value="All Statuses">All Statuses</option>
          <option value="passed">Passed</option>
          <option value="flagged">Flagged</option>
          <option value="needs_refactor">Needs Refactor</option>
        </select>
      </div>

      {/* Severity Selector */}
      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          Severity Level
        </label>
        <select
          value={filters.severity}
          onChange={(e) => onChange({ severity: e.target.value })}
          className="bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-emerald-500"
        >
          <option value="All Levels">All Levels</option>
          <option value="A">Clean (A)</option>
          <option value="B">Minor (B)</option>
          <option value="C">Moderate (C)</option>
          <option value="D">Major (D)</option>
          <option value="F">Critical (F)</option>
        </select>
      </div>

      {/* Module prefix directories selector */}
      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          Module / Directory
        </label>
        <select
          value={filters.module}
          onChange={(e) => onChange({ module: e.target.value })}
          className="bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-emerald-500 truncate"
        >
          <option value="All Modules">All Modules</option>
          {uniqueModules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Start and end Dates inputs */}
      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          Start Date
        </label>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className="bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-emerald-500 font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
          End Date
        </label>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
          className="bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-emerald-500 font-mono"
        />
      </div>

      {/* Reset panel button */}
      <button
        onClick={handleReset}
        className="w-full mt-2 bg-[#1F2937] hover:bg-slate-700 active:bg-slate-800 text-slate-300 py-2.5 rounded-lg text-sm transition duration-150 font-semibold border border-slate-700/30"
      >
        Reset Filters
      </button>
    </div>
  );
}
export default ReviewFilterPanel;
