import React, { useState } from 'react';

export function ParserSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [nestingDepth, setNestingDepth] = useState(6);
  const [sensitivity, setSensitivity] = useState('medium');
  const [enableOutdated, setEnableOutdated] = useState(true);
  const [maxFileSize, setMaxFileSize] = useState(1000);

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-md">
      {/* Accordion Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-800/20 transition duration-150"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="text-white font-semibold font-sans">AST Parser Settings &amp; Thresholds</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-6 border-t border-[#1F2937] bg-[#0B0F17]/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max Nesting Depth */}
            <div className="space-y-2">
              <label className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
                Max Nesting Depth Threshold
              </label>
              <input
                type="number"
                value={nestingDepth}
                onChange={(e) => setNestingDepth(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none font-mono"
              />
              <p className="text-slate-500 text-[11px] leading-normal font-sans">
                Flag files where maximum brace nesting `{}` exceeds this level. Default is 6.
              </p>
            </div>

            {/* Duplication Sensitivity */}
            <div className="space-y-2">
              <label className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
                Duplication Sensitivity
              </label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none"
              >
                <option value="low">Low (10 line window)</option>
                <option value="medium">Medium (5 line window)</option>
                <option value="high">High (3 line window)</option>
              </select>
              <p className="text-slate-500 text-[11px] leading-normal font-sans">
                Selects minimum identical line chunk size evaluated for duplication rate.
              </p>
            </div>

            {/* Outdated Pattern Flagging */}
            <div className="flex items-center justify-between p-4 bg-[#0B0F17] border border-[#1F2937] rounded-lg">
              <div className="space-y-0.5 pr-4">
                <span className="block text-white text-xs font-semibold uppercase tracking-wider">
                  Outdated Pattern Detection
                </span>
                <span className="block text-slate-500 text-[11px] leading-normal">
                  Scans and logs `var` syntax, nested callback blocks, and `console.log`.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnableOutdated(!enableOutdated)}
                className={`w-11 h-6 min-w-[44px] rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                  enableOutdated ? 'bg-[#10B981]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    enableOutdated ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Max File Size */}
            <div className="space-y-2">
              <label className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
                Max File Size (KB)
              </label>
              <input
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(parseInt(e.target.value) || 0)}
                min="100"
                className="w-full bg-[#0B0F17] border border-[#1F2937] text-slate-300 rounded-lg px-3 py-2 text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none font-mono"
              />
              <p className="text-slate-500 text-[11px] leading-normal font-sans">
                Do not download or parse codebase files exceeding this size. Helps prevent timeouts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ParserSettings;
