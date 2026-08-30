'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '../../lib/store';
import { BRAND } from '../../lib/constants';
import { LogoMark } from '../ui/logo';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, currentRunId } = useAppStore();

  const handleLogout = () => {
    router.push('/');
  };

  const navItems = [
    {
      label: 'Dashboard',
      path: `/dashboard${currentRunId ? `?runId=${currentRunId}` : ''}`,
      activeMatch: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      label: 'Review Console',
      path: `/review${currentRunId ? `?runId=${currentRunId}` : ''}`,
      activeMatch: '/review',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: 'Ingestion Pipeline',
      path: '/ingestion',
      activeMatch: '/ingestion',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    {
      label: 'Audit Logs',
      path: '/logs',
      activeMatch: '/logs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    }
  ];

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-60';

  return (
    <aside className={`h-screen bg-[#0B0F17] border-r border-[#1F2937] flex flex-col justify-between shrink-0 overflow-x-hidden ${sidebarWidth} transition-[width] duration-200 ease-out z-30`}>
      {/* Top Section */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1F2937]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 min-w-[36px] bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg flex items-center justify-center text-[#10B981]">
              <LogoMark className="w-5 h-5" />
            </div>
            <div
              className={`flex flex-col select-none whitespace-nowrap transition-opacity duration-150 ${
                sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'
              }`}
              aria-hidden={sidebarCollapsed}
            >
              <span className="text-white font-bold text-sm leading-none">{BRAND.name}</span>
              <span className="text-[#10B981] font-mono text-[10px] uppercase font-bold tracking-widest mt-0.5">{BRAND.tagline}</span>
            </div>
          </div>
          
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 rounded border border-[#1F2937] hover:bg-slate-800/40 text-slate-400 flex items-center justify-center transition focus:outline-none"
          >
            {sidebarCollapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.activeMatch);
            const activeClass = isActive 
              ? 'bg-[#10B981]/10 text-[#10B981] border-l-2 border-[#10B981]' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50';

            return (
              <Link
                key={item.label}
                href={item.path}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm transition duration-150 ${sidebarCollapsed ? 'justify-center' : ''} ${activeClass}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="min-w-[20px]">{item.icon}</div>
                <span
                  className={`font-medium whitespace-nowrap transition-opacity duration-150 ${
                    sidebarCollapsed ? 'opacity-0' : 'opacity-100 delay-100'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-[#1F2937] space-y-3">
        <div className="flex items-center gap-3 px-2 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
            CP
          </div>
          <div
            className={`flex flex-col overflow-hidden transition-opacity duration-150 ${
              sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'
            }`}
            aria-hidden={sidebarCollapsed}
          >
            <span className="text-slate-300 text-xs font-semibold truncate">{BRAND.userEmail}</span>
            <span className="text-slate-500 text-[10px] font-mono leading-none">{BRAND.userOrg}</span>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg text-sm transition duration-150 font-medium ${sidebarCollapsed ? 'justify-center' : ''}`}
          title={sidebarCollapsed ? 'Logout' : undefined}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span
            className={`font-semibold whitespace-nowrap transition-opacity duration-150 ${
              sidebarCollapsed ? 'opacity-0' : 'opacity-100 delay-100'
            }`}
          >
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
export default Sidebar;
