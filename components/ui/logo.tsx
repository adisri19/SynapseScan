import React from 'react';

interface LogoMarkProps {
  className?: string;
  /** Adds a slow breathing pulse on the waveform. Off by default. */
  animated?: boolean;
}

/** Brand mark: code brackets enclosing a pulse waveform. */
export function LogoMark({ className = 'w-6 h-6', animated = false }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M11 7 4.5 16 11 25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M21 7l6.5 9L21 25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M11.5 16h2.2l1.8-4.2 2.4 8.4 1.6-4.2h2.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'logo-pulse' : undefined}
      />
    </svg>
  );
}
export default LogoMark;
