import React from 'react';
import { BRAND } from '../../lib/constants';

interface ExportModalProps {
  isOpen: boolean;
  currentStep: string;
}

export function ExportModal({ isOpen, currentStep }: ExportModalProps) {
  if (!isOpen) return null;

  const steps = [
    { label: 'Fetching AI narratives', stepKey: 'Fetching AI narratives...' },
    { label: 'Building cover page', stepKey: 'Building cover page...' },
    { label: 'Rendering charts', stepKey: 'Rendering charts...' },
    { label: 'Assembling PDF sections', stepKey: 'Generating PDF...' },
    { label: 'Downloading file', stepKey: 'Done!' }
  ];

  // Find index of current step to mark preceding as completed
  const currentIdx = steps.findIndex(s => s.stepKey === currentStep);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 max-w-sm w-full relative shadow-2xl overflow-hidden flex flex-col items-center">
        {/* Top brand header details */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg flex items-center justify-center text-[#10B981]">
            <span className="font-mono font-bold text-xs">&lt;/&gt;</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">{BRAND.name}</span>
        </div>

        {/* Big pulsing central spinner */}
        <div className="w-16 h-16 bg-[#10B981]/5 border border-[#10B981]/20 rounded-full flex items-center justify-center mb-6">
          <svg className="animate-spin h-8 w-8 text-[#10B981]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        <h3 className="text-white font-bold text-lg font-sans text-center">Generating Audit Report</h3>
        <p className="text-slate-400 text-[11px] text-center mt-1 leading-normal max-w-[240px]">
          This may take 30–60 seconds while AI narratives are fetched and charts rendered.
        </p>

        {/* Current running step */}
        <div className="mt-5 mb-6 text-center">
          <span className="text-slate-500 text-[10px] font-mono uppercase font-semibold">Current Process</span>
          <span className="text-[#10B981] font-mono text-xs font-bold block mt-0.5 truncate max-w-[280px]">
            {currentStep || 'Initializing...'}
          </span>
        </div>

        {/* Steps checklists */}
        <div className="w-full space-y-3 pt-3 border-t border-slate-800/60 text-xs font-sans text-slate-400">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIdx || currentStep === 'Done!';
            const isActive = idx === currentIdx && currentStep !== 'Done!';

            let statusIcon = (
              <div className="w-4 h-4 rounded-full border border-slate-800 bg-[#0B0F17] flex items-center justify-center text-[9px] font-mono text-slate-600">
                {idx + 1}
              </div>
            );

            if (isCompleted) {
              statusIcon = (
                <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center text-white text-[9px]">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              );
            } else if (isActive) {
              statusIcon = (
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] status-dot" />
              );
            }

            return (
              <div key={step.label} className="flex items-center gap-3.5">
                <div className="w-4 h-4 flex items-center justify-center shrink-0">{statusIcon}</div>
                <span className={`font-medium ${isCompleted ? 'text-slate-500 line-through decoration-[#10B981]/20' : isActive ? 'text-[#10B981] font-bold' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default ExportModal;
