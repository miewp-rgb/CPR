import React from 'react';
import {
  Activity,
  Cloud,
  CloudOff,
  FilePlus2,
  LayoutDashboard,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type ActivePage = 'dashboard' | 'record';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onNewRecord: () => void;
  isOnline: boolean;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  activeCaseCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  onNewRecord,
  isOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  pendingSyncCount,
  isSyncing,
  onSyncNow,
  activeCaseCount,
}) => {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-[252px] lg:shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0 h-screen select-none no-print">
      {/* Brand Lockup — matching Image 3 */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white shadow-sm shrink-0">
          <Activity className="w-5 h-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-slate-900 tracking-tight truncate">
            CPR Command
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            Resuscitation &amp; Work List
          </div>
        </div>
      </div>

      {/* Primary Workspace Nav */}
      <div className="px-3.5 pt-2 flex-1 overflow-y-auto">
        <div className="px-2.5 pb-2 text-[11px] font-semibold tracking-wider text-slate-400">
          WORKSPACE
        </div>

        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors min-h-[44px] ${
              activePage === 'dashboard'
                ? 'bg-sky-50 text-sky-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 whitespace-nowrap">
              <LayoutDashboard
                className={`w-[18px] h-[18px] ${
                  activePage === 'dashboard' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              CPR Dashboard
            </span>
            {activeCaseCount > 0 && (
              <span className="text-xs font-mono-tabular font-semibold text-red-600">
                {activeCaseCount} Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('record')}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors min-h-[44px] ${
              activePage === 'record'
                ? 'bg-sky-50 text-sky-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 whitespace-nowrap">
              <FilePlus2
                className={`w-[18px] h-[18px] ${
                  activePage === 'record' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              CPR Record
            </span>
          </button>
        </nav>

        <div className="mt-5 px-1">
          <button
            type="button"
            onClick={onNewRecord}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 shadow-xs transition min-h-[44px]"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>+ บันทึก CPR ใหม่</span>
          </button>
        </div>
      </div>

      {/* Bottom Offline & Sync Card */}
      <div className="p-3.5 space-y-2.5 border-t border-slate-100">
        <div
          className={`rounded-2xl p-3.5 border text-xs ${
            isOnline
              ? 'bg-emerald-50/60 border-emerald-200/80 text-slate-700'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2 font-semibold">
            <span className="flex items-center gap-1.5">
              {isOnline ? (
                <Cloud className="w-4 h-4 text-teal-600 shrink-0" />
              ) : (
                <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              {isOnline ? 'ออนไลน์ · ซิงค์อัตโนมัติ' : 'โหมดออฟไลน์'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="font-mono-tabular text-amber-700 font-bold">
                รอซิงค์ {pendingSyncCount}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
            {isOnline
              ? 'บันทึกข้อมูลเรียลไทม์และสำรองลงเครื่องทุกการแตะ'
              : 'บันทึกในเครื่องได้ทันที ระบบจะซิงค์เมื่อเน็ตกลับมา'}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            {pendingSyncCount > 0 && isOnline && (
              <button
                type="button"
                onClick={onSyncNow}
                disabled={isSyncing}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-teal-700 disabled:opacity-60 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ทันที'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSimulatedOffline}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition"
              title="สลับโหมดทดสอบออฟไลน์"
            >
              <WifiOff className="w-3 h-3" />
              <span>{simulatedOffline ? 'กลับออนไลน์' : 'ทดสอบออฟไลน์'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <PWAInstallButton />
        </div>
      </div>
    </aside>
  );
};
