import React from 'react';

interface ReviewStatusTagProps {
  status: 'passed' | 'flagged' | 'needs_refactor';
}

export function ReviewStatusTag({ status }: ReviewStatusTagProps) {
  const styleMap = {
    passed: {
      bg: 'bg-[#10B981]/10',
      border: 'border-[#10B981]/30',
      text: 'text-[#10B981]',
      label: 'Passed'
    },
    flagged: {
      bg: 'bg-[#F59E0B]/10',
      border: 'border-[#F59E0B]/30',
      text: 'text-[#F59E0B]',
      label: 'Flagged'
    },
    needs_refactor: {
      bg: 'bg-[#6366F1]/10',
      border: 'border-[#6366F1]/30',
      text: 'text-[#6366F1]',
      label: 'Needs Refactor'
    }
  };

  const current = styleMap[status] || styleMap.passed;

  return (
    <span className={`inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 rounded-full border ${current.bg} ${current.border} ${current.text}`}>
      {current.label}
    </span>
  );
}
