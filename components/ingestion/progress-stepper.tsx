import React, { useEffect, useState } from 'react';

interface ProgressStepperProps {
  isAnalyzing: boolean;
}

export function ProgressStepper({ isAnalyzing }: ProgressStepperProps) {
  const steps = [
    { label: 'Connecting & Cloning Repository', threshold: 15 },
    { label: 'Fetching Repository Tree Structure', threshold: 35 },
    { label: 'Downloading & Reading Source Files', threshold: 55 },
    { label: 'Running AST & Complexity Analysis', threshold: 75 },
    { label: 'Calculating Code Debt & Duplication', threshold: 90 },
    { label: 'Finalizing Scorecard & Preparing Dashboard', threshold: 100 }
  ];

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setProgress(0);
      return;
    }

    // Smooth progress increment from 0 to 95% over ~20-25 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        // Fast at start, smoothly decelerates toward 95%
        const remaining = 95 - prev;
        const bump = Math.max(1, Math.min(5, Math.ceil(remaining / 10)));
        return Math.min(95, prev + bump);
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isAnalyzing) return null;

  // Determine current active step index based on progress
  let currentStepIdx = steps.findIndex(s => progress < s.threshold);
  if (currentStepIdx === -1) currentStepIdx = steps.length - 1;

  // SVG parameters for circular loader ring
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-[#111827] border border-[#10B981]/30 rounded-xl p-6 shadow-2xl relative overflow-hidden space-y-6">
      {/* Top linear progress bar with glowing animated gradient */}
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
        <div 
          className="h-full animate-shimmer transition-all duration-300 ease-out shadow-[0_0_12px_#10B981]" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header section with ring percentage indicator */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4 text-center sm:text-left">
          {/* Circular progress ring with centered percentage text */}
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-slate-800"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-[#10B981] transition-all duration-300 ease-out"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-white font-mono font-extrabold text-lg leading-none">
                {progress}%
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              <h3 className="text-white font-bold font-sans text-base">Analysis Pipeline Running</h3>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              Current stage: <span className="text-[#10B981] font-semibold">{steps[currentStepIdx].label}</span>
            </p>
            <p className="text-amber-400/90 text-[11px] font-sans mt-1.5 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Please keep this page open while analysis is completing.</span>
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-[#10B981]/10 px-3 py-1.5 rounded-full border border-[#10B981]/20 text-[#10B981] text-xs font-mono font-bold">
          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Active Scan
        </div>
      </div>

      {/* Stepper Steps (Vertical list) */}
      <div className="space-y-3.5">
        {steps.map((step, idx) => {
          const isCompleted = progress >= step.threshold;
          const isActive = idx === currentStepIdx && !isCompleted;

          let icon = (
            <div className="w-5 h-5 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-600 text-[10px] font-mono">
              {idx + 1}
            </div>
          );

          if (isCompleted) {
            icon = (
              <div className="w-5 h-5 rounded-full bg-[#10B981] flex items-center justify-center text-white text-xs shadow-md shadow-[#10B981]/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            );
          } else if (isActive) {
            icon = (
              <div className="w-5 h-5 rounded-full bg-slate-900 border border-[#10B981] flex items-center justify-center text-[#10B981] text-xs font-bold font-mono status-dot shadow-[0_0_8px_#10B981]">
                •
              </div>
            );
          }

          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className="shrink-0">{icon}</div>
              <span className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                isCompleted 
                  ? 'text-slate-300 line-through decoration-[#10B981]/40' 
                  : isActive 
                    ? 'text-[#10B981] font-bold' 
                    : 'text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default ProgressStepper;
