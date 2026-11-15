import React from 'react';
import { FilePlus2, LayoutDashboard } from 'lucide-react';
import type { ActivePage } from './Sidebar';

interface MobileBottomNavProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activePage,
  onNavigate,
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
    >
      <div className="grid grid-cols-2 h-14 items-center">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] transition-colors ${
            activePage === 'dashboard' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" strokeWidth={activePage === 'dashboard' ? 2.4 : 1.8} />
          <span className="text-[11px] font-semibold whitespace-nowrap">CPR Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('record')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] transition-colors ${
            activePage === 'record' ? 'text-teal-600' : 'text-slate-500'
          }`}
        >
          <FilePlus2 className="w-5 h-5" strokeWidth={activePage === 'record' ? 2.4 : 1.8} />
          <span className="text-[11px] font-semibold whitespace-nowrap">CPR Record</span>
        </button>
      </div>
    </nav>
  );
};
