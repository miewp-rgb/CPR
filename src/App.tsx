import { useMemo, useState } from 'react';
import { Activity, Cloud, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useCprRealtime } from './hooks/useCprRealtime';
import { Sidebar, type ActivePage } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CprDashboard } from './components/CprDashboard';
import { CprRecordView } from './components/CprRecordView';
import { CprPdfSummaryModal } from './components/CprPdfSummaryModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import type { CprRecord } from './types/cpr';

export default function App() {
  const {
    cases,
    isLoading,
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    isSyncing,
    pendingSyncCount,
    nowMs,
    upsertCase,
    deleteCase,
    syncNow,
  } = useCprRealtime();

  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [selectedRecord, setSelectedRecord] = useState<CprRecord | null>(null);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState<CprRecord | null>(null);

  const activeCaseCount = useMemo(
    () => cases.filter((c) => c.status === 'ACTIVE_CPR').length,
    [cases]
  );

  const handleOpenNewRecord = () => {
    setSelectedRecord(null);
    setActivePage('record');
  };

  const handleOpenRecord = (record: CprRecord) => {
    setSelectedRecord(record);
    setActivePage('record');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          if (page === 'record' && activePage !== 'record') {
            setSelectedRecord(null);
          }
          setActivePage(page);
        }}
        onNewRecord={handleOpenNewRecord}
        isOnline={isOnline}
        simulatedOffline={simulatedOffline}
        onToggleSimulatedOffline={() => setSimulatedOffline((v) => !v)}
        pendingSyncCount={pendingSyncCount}
        isSyncing={isSyncing}
        onSyncNow={() => void syncNow()}
        activeCaseCount={activeCaseCount}
      />

      {/* Main Content Shell */}
      <div className={`flex-1 min-w-0 flex flex-col ${pdfPreviewRecord ? 'no-print' : ''}`}>
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 h-13 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white shrink-0">
              <Activity className="w-4 h-4" strokeWidth={2.4} />
            </div>
            <span className="lg:hidden text-sm font-bold text-slate-900 truncate">
              CPR Command
            </span>
            <span className="hidden lg:inline text-xs font-medium text-slate-500 whitespace-nowrap">
              {activePage === 'dashboard'
                ? 'Work list CPR · CPR work list แบบ Realtime'
                : `CPR Record · ${selectedRecord ? `เคส #${selectedRecord.id}` : 'บันทึกเคสใหม่'}`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (pendingSyncCount > 0 && isOnline) {
                  void syncNow();
                } else {
                  setSimulatedOffline((v) => !v);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition min-h-[36px] whitespace-nowrap ${
                !isOnline
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : pendingSyncCount > 0
                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={
                !isOnline
                  ? 'แตะเพื่อสลับกลับออนไลน์'
                  : pendingSyncCount > 0
                    ? 'แตะเพื่อซิงค์ข้อมูลทันที'
                    : 'แตะเพื่อทดสอบโหมดออฟไลน์'
              }
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              ) : isOnline ? (
                <Cloud className="w-3.5 h-3.5 text-teal-600" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="hidden sm:inline">
                {!isOnline
                  ? simulatedOffline
                    ? 'ออฟไลน์ (ทดสอบ)'
                    : 'ออฟไลน์'
                  : pendingSyncCount > 0
                    ? `รอซิงค์ ${pendingSyncCount}`
                    : 'ซิงค์เรียลไทม์'}
              </span>
              {pendingSyncCount > 0 && (
                <span className="sm:hidden font-mono-tabular">{pendingSyncCount}</span>
              )}
            </button>

            {simulatedOffline && (
              <button
                type="button"
                onClick={() => setSimulatedOffline(false)}
                className="lg:hidden inline-flex items-center gap-1 rounded-xl bg-teal-600 text-white px-2.5 py-1.5 text-xs font-semibold min-h-[36px]"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>กลับออนไลน์</span>
              </button>
            )}

            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {activePage === 'dashboard' ? (
            <CprDashboard
              cases={cases}
              isLoading={isLoading}
              nowMs={nowMs}
              isOnline={isOnline}
              pendingSyncCount={pendingSyncCount}
              onNewRecord={handleOpenNewRecord}
              onOpenRecord={handleOpenRecord}
              onViewPdf={(record) => setPdfPreviewRecord(record)}
              onDeleteRecord={(id) => void deleteCase(id)}
            />
          ) : (
            <CprRecordView
              initialRecord={selectedRecord}
              isOnline={isOnline}
              onSaveRecord={upsertCase}
              onCancel={() => {
                setSelectedRecord(null);
                setActivePage('dashboard');
              }}
              onSavedShowPdf={(saved) => setPdfPreviewRecord(saved)}
            />
          )}
        </main>
      </div>

      {/* Mobile & Tablet Thumb-Zone Bottom Navigation */}
      <MobileBottomNav
        activePage={activePage}
        onNavigate={(page) => {
          if (page === 'record' && activePage !== 'record') {
            setSelectedRecord(null);
          }
          setActivePage(page);
        }}
      />

      {/* A4 PDF Summary Preview Screen */}
      {pdfPreviewRecord && (
        <CprPdfSummaryModal
          record={pdfPreviewRecord}
          allCases={cases}
          isOnline={isOnline}
          onCloseEdit={() => {
            setSelectedRecord(pdfPreviewRecord);
            setActivePage('record');
            setPdfPreviewRecord(null);
          }}
          onGoToDashboard={() => {
            setPdfPreviewRecord(null);
            setSelectedRecord(null);
            setActivePage('dashboard');
          }}
        />
      )}
    </div>
  );
}
