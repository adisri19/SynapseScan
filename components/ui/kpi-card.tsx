import React from 'react';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBgClass: string; // e.g. 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  cta?: {
    label: string;
    onClick: () => void;
  };
}

export function KpiCard({ label, value, icon, iconBgClass, cta }: KpiCardProps) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden group">
      <div className="flex justify-between items-start">
        <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${iconBgClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <span className="text-white text-3xl font-bold font-mono tracking-tight">{value}</span>
      </div>
      {cta ? (
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex">
          <button
            onClick={cta.onClick}
            className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition duration-150 inline-flex items-center gap-1 cursor-pointer"
          >
            {cta.label}
          </button>
        </div>
      ) : (
        <div className="mt-4 h-[17px]" />
      )}
    </div>
  );
}
export default KpiCard;
