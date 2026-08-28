import React from 'react';

interface GradeBadgeProps {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const styleMap = {
    A: {
      bg: 'bg-[#10B981]/10',
      border: 'border-[#10B981]/30',
      text: 'text-[#10B981]'
    },
    B: {
      bg: 'bg-[#22c55e]/10',
      border: 'border-[#22c55e]/30',
      text: 'text-[#22c55e]'
    },
    C: {
      bg: 'bg-[#eab308]/10',
      border: 'border-[#eab308]/30',
      text: 'text-[#eab308]'
    },
    D: {
      bg: 'bg-[#f97316]/10',
      border: 'border-[#f97316]/30',
      text: 'text-[#f97316]'
    },
    F: {
      bg: 'bg-[#ef4444]/10',
      border: 'border-[#ef4444]/30',
      text: 'text-[#ef4444]'
    }
  };

  const currentStyle = styleMap[grade] || styleMap.A;

  return (
    <span className={`inline-flex items-center justify-center font-mono font-bold rounded-full border ${sizeClasses[size]} ${currentStyle.bg} ${currentStyle.border} ${currentStyle.text}`}>
      {grade}
    </span>
  );
}
