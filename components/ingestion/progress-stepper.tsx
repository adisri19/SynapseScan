import React, { useEffect, useState } from 'react';

interface ProgressStepperProps {
  isAnalyzing: boolean;
}

export function ProgressStepper({ isAnalyzing }: ProgressStepperProps) {
  const steps = [
    { label: 'Cloning Repository', percentage: 15 },
    { label: 'Fetching File Tree', percentage: 35 },
    { label: 'Downloading Files', percentage: 55 },
    { label: 'Calculating Metrics', percentage: 75 },
    { label: 'Scoring & Grading', percentage: 90 },
    { label: 'Finalizing Run', percentage: 100 }
  ];

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStep(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 4500); // Progress sequentially over ~27 seconds

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isAnalyzing) return null;

  const currentPercent = steps[currentStep].percentage;

  return (
    <div className="bg-[#111827] border border-[#10B981]/20 rounded-xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-slate-800" />
      <div 
        className="absolute top-0 left-0 h-0.5 bg-[#10B981] transition-all duration-500 ease-out" 
        style={{ width: `${currentPercent}%` }}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 mb-5 gap-3">
        <div>
          <h3 className="text-white font-bold font-sans">Analysis Pipeline Running</h3>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">
            Step: <span className="text-[#10B981] font-bold">{steps[currentStep].label}</span> ({currentPercent}%)
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/20 text-[#10B981] text-xs font-mono font-bold">
          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Ingestion Session Active
        </div>
      </div>

      {/* Stepper Steps (Vertical list) */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;

          let icon = (
            <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-600 text-xs font-mono">
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
              <div className="w-5 h-5 rounded-full bg-slate-900 border border-[#10B981] flex items-center justify-center text-[#10B981] text-xs font-bold font-mono status-dot">
                •
              </div>
            );
          }

          return (
            <div key={step.label} className="flex items-center gap-4">
              <div className="shrink-0">{icon}</div>
              <span className={`text-sm font-sans font-medium ${
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
