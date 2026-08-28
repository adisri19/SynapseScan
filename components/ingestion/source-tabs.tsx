import React from 'react';

interface SourceTabsProps {
  activeTab: 'github' | 'gitlab' | 'webhook';
  setActiveTab: (tab: 'github' | 'gitlab' | 'webhook') => void;
}

export function SourceTabs({ activeTab, setActiveTab }: SourceTabsProps) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-1 inline-flex gap-1">
      {/* GitHub Tab */}
      <button
        type="button"
        onClick={() => setActiveTab('github')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 flex items-center gap-2 focus:outline-none ${
          activeTab === 'github'
            ? 'bg-[#10B981] text-white'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>GitHub URL</span>
      </button>

      {/* GitLab Tab */}
      <button
        type="button"
        onClick={() => setActiveTab('gitlab')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 flex items-center gap-2 focus:outline-none ${
          activeTab === 'gitlab'
            ? 'bg-[#10B981] text-white'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>GitLab URL</span>
      </button>

      {/* Webhook Tab */}
      <button
        type="button"
        onClick={() => setActiveTab('webhook')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 flex items-center gap-2 focus:outline-none ${
          activeTab === 'webhook'
            ? 'bg-[#10B981] text-white'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>CI/CD Webhook</span>
      </button>
    </div>
  );
}
export default SourceTabs;
