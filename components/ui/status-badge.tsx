import React from 'react';

interface StatusBadgeProps {
  status: 'done' | 'failed' | 'in_progress' | 'queued';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styleMap = {
    done: {
      bg: 'bg-[#10B981]/10',
      border: 'border-[#10B981]/30',
      text: 'text-[#10B981]',
      dot: 'bg-[#10B981]',
      label: 'DONE'
    },
    failed: {
      bg: 'bg-[#EF4444]/10',
      border: 'border-[#EF4444]/30',
      text: 'text-[#EF4444]',
      dot: 'bg-[#EF4444]',
      label: 'FAILED'
    },
    in_progress: {
      bg: 'bg-[#F59E0B]/10',
      border: 'border-[#F59E0B]/30',
      text: 'text-[#F59E0B]',
      dot: 'bg-[#F59E0B] animate-pulse',
      label: 'RUNNING'
    },
    queued: {
      bg: 'bg-slate-700/10',
      border: 'border-slate-700/30',
      text: 'text-slate-400',
      dot: 'bg-slate-500',
      label: 'QUEUED'
    }
  };

  const current = styleMap[status] || styleMap.queued;

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-semibold text-xs px-2.5 py-1 rounded-md border ${current.bg} ${current.border} ${current.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}
