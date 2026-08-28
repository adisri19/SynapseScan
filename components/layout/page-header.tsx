import React from 'react';
import { BRAND } from '../../lib/constants';

interface PageHeaderProps {
  tenantName?: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export function PageHeader({ tenantName = BRAND.tenantName, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2937] bg-[#0B0F17]">
      {/* LEFT: Tenant badge */}
      <div className="flex items-center gap-3 min-w-[180px]">
        <span className="flex items-center gap-2 bg-[#1F2937] border border-[#374151] rounded-md px-3 py-1.5 text-slate-300 text-sm font-medium whitespace-nowrap">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Tenant: <strong className="text-white ml-1">{tenantName}</strong>
        </span>
      </div>

      {/* CENTER: Title + subtitle */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-white font-bold text-2xl leading-tight">{title}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
      </div>

      {/* RIGHT: Actions + status pill */}
      <div className="flex items-center gap-3 min-w-[180px] justify-end">
        {actions}
        <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 status-dot" />
          Audit Engine Active
        </span>
      </div>
    </div>
  );
}
export default PageHeader;
