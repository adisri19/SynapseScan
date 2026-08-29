'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { ChatBot } from '../ai/chat-bot';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  if (isLandingPage) {
    return (
      <div className="flex-1 overflow-y-auto relative">
        {children}
        <ChatBot />
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 overflow-y-auto flex flex-col min-w-0 bg-[#0B0F17] relative">
        {children}
        <ChatBot />
      </div>
    </div>
  );
}
export default SidebarWrapper;
