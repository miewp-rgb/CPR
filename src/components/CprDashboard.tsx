import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Edit3,
  Eye,
  FileCode2,
  FilePlus2,
  HeartOff,
  HeartPulse,
  Printer,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import type { CprOutcome, CprRecord, CprTeam, CprWorkflowStatus, ServiceGroup } from '../types/cpr';
import { SERVICE_GROUPS, TEAM_ROLES, WORKFLOW_STATUS_META } from '../data/cprConstants';
import {
  exportCasesToCsv,
  formatDurationHMS,
  formatShortDateTime,
} from '../lib/formatters';
import { exportInteractiveHtml } from '../lib/exportInteractiveHtml';

interface CprDashboardProps {
  cases: CprRecord[];
  isLoading: boolean;
  nowMs: number;
  isOnline: boolean;
  pendingSyncCount: number;
  onNewRecord: () => void;
  onOpenRecord: (record: CprRecord, mode?: 'edit' | 'view') => void;
  onViewPdf: (record: CprRecord) => void;
  onDeleteRecord: (id: string) => void;
}

type WorkTab = 'all' | 'urgent' | 'temp' | 'completed';

export const CprDashboard: React.FC<CprDashboardProps> = ({
  cases,
  isLoading,
  nowMs,
  isOnline,
  pendingSyncCount,
  onNewRecord,
  onOpenRecord,
  onViewPdf,
  onDeleteRecord,
}) => {
  const [searchAll, setSearchAll] = useState('');
  const [searchIdHn, setSearchIdHn] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | ServiceGroup>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CprWorkflowStatus>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | CprOutcome>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [workTab, setWorkTab] = useState<WorkTab>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const workListRef = useRef<HTMLDivElement | null>(null);

  const getTeamEntries = (team: CprTeam) =>
    TEAM_ROLES.map((role) => ({
      key: role.key,
      shortLabel: role.shortLabel,
      names: team?.[role.key] || [],
    })).filter((entry) => entry.names.length > 0);

  const jumpToWorkList = (nextOutcome: 'ALL' | CprOutcome, nextTab: WorkTab = 'all') => {
    setOutcomeFilter(nextOutcome);
    setWorkTab(nextTab);
    window.setTimeout(() => {
      workListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const getLiveDuration = (c: CprRecord) => {
    if (!c.isRunning) return c.durationSeconds;
    const elapsedSinceUpdate = Math.max(
      0,
      Math.floor((nowMs - new Date(c.updatedAt).getTime()) / 1000)
    );
    return c.durationSeconds + elapsedSinceUpdate;
  };

  // Global filtered cases (for KPIs, Charts, and Table)
  const filteredCases = useMemo(() => {
    const q = searchAll.trim().toLowerCase();
    const idHn = searchIdHn.trim().toLowerCase();

    return cases.filter((c) => {
      if (serviceFilter !== 'ALL' && c.serviceGroup !== serviceFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      if (q) {
        const teamNames = Object.values(c.team || {}).flat();
        const hay = [
          c.id,
          c.an,
          c.hn,
          c.patientName,
          c.department,
          c.clinicalNote,
          c.outcome,
          ...c.causes,
          ...c.initialAssessment,
          ...teamNames,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (idHn) {
        const matchIdHn =
          c.id.toLowerCase().includes(idHn) ||
          c.hn.toLowerCase().includes(idHn) ||
          c.an.toLowerCase().includes(idHn);
        if (!matchIdHn) return false;
      }

      if (fromDate) {
        const startDay = new Date(c.startTime).toISOString().slice(0, 10);
        if (startDay < fromDate) return false;
      }
      if (toDate) {
        const startDay = new Date(c.startTime).toISOString().slice(0, 10);
        if (startDay > toDate) return false;
      }

      return true;
    });
  }, [cases, searchAll, searchIdHn, serviceFilter, statusFilter, fromDate, toDate]);

  // Tab & Outcome scoped work list rows
  const workListRows = useMemo(() => {
    return filteredCases.filter((c) => {
      if (outcomeFilter !== 'ALL' && c.outcome !== outcomeFilter) return false;
      if (workTab === 'urgent') {
        return c.status === 'ACTIVE_CPR' || c.status === 'POST_ROSC_FOLLOWUP';
      }
      if (workTab === 'temp') {
        return c.status === 'PENDING_REVIEW';
      }
      if (workTab === 'completed') {
        return c.status === 'COMPLETED';
      }
      return true;
    });
  }, [filteredCases, workTab, outcomeFilter]);

  // KPI computations
  const kpis = useMemo(() => {
    const total = filteredCases.length;
    const activeCount = filteredCases.filter((c) => c.status === 'ACTIVE_CPR').length;
    const pendingOrFollowupCount = filteredCases.filter(
      (c) => c.status === 'PENDING_REVIEW' || c.status === 'POST_ROSC_FOLLOWUP'
    ).length;

    const roscCases = filteredCases.filter((c) => c.outcome === 'ROSC').length;
    const deadCases = filteredCases.filter((c) => c.outcome === 'DEAD').length;
    const finalizedCases = roscCases + deadCases;
    const roscRate = finalizedCases > 0 ? Math.round((roscCases / finalizedCases) * 100) : 0;
    const deadRate = finalizedCases > 0 ? Math.round((deadCases / finalizedCases) * 100) : 0;

    const avgDuration =
      total > 0
        ? Math.round(filteredCases.reduce((acc, c) => acc + c.durationSeconds, 0) / total)
        : 0;
    const avgCycles =
      total > 0
        ? (filteredCases.reduce((acc, c) => acc + c.cycles, 0) / total).toFixed(1)
        : '0.0';

    return {
      total,
      activeCount,
      pendingOrFollowupCount,
      roscCases,
      deadCases,
      finalizedCases,
      roscRate,
      deadRate,
      avgDuration,
      avgCycles,
    };
  }, [filteredCases]);

  // Grouped chart data by department/service group (matching Image 3's dual-bar aesthetic)
  const deptChartData = useMemo(() => {
    const groups = SERVICE_GROUPS.map((g) => {
      const items = filteredCases.filter((c) => c.serviceGroup === g.value);
      const total = items.length;
      const rosc = items.filter((c) => c.outcome === 'ROSC').length;
      const avgCycles =
        total > 0 ? Math.round(items.reduce((s, c) => s + c.cycles, 0) / total) : 0;
      return {
        key: g.value,
        label: `${g.label} (${g.description})`,
        shortLabel: g.label,
        total,
        rosc,
        avgCycles,
      };
    });
    const maxVal = Math.max(4, ...groups.map((g) => g.total));
    return { groups, maxVal };
  }, [filteredCases]);

  // Service group workload distribution (matching Image 3 right panel)
  const distributionData = useMemo(() => {
    const total = Math.max(1, filteredCases.length);
    return SERVICE_GROUPS.map((g, idx) => {
      const count = filteredCases.filter((c) => c.serviceGroup === g.value).length;
      const pct = Math.round((count / total) * 100);
      return {
        group: g.value,
        description: g.description,
        count,
        pct,
        colorClass: idx % 2 === 0 ? 'bg-[#68A8DF]' : 'bg-[#56C2A7]',
      };
    });
  }, [filteredCases]);

  const tabCounts = useMemo(() => {
    const base =
      outcomeFilter === 'ALL'
        ? filteredCases
        : filteredCases.filter((c) => c.outcome === outcomeFilter);
    return {
      all: base.length,
      urgent: base.filter(
        (c) => c.status === 'ACTIVE_CPR' || c.status === 'POST_ROSC_FOLLOWUP'
      ).length,
      temp: base.filter((c) => c.status === 'PENDING_REVIEW').length,
      completed: base.filter((c) => c.status === 'COMPLETED').length,
    };
  }, [filteredCases, outcomeFilter]);

  return (
    <div className="space-y-5">
      {/* Top Page Header — matching Image 3 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            CPR Management / Work list CPR
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Work list CPR
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            CPR work list แบบ Realtime ติดตามสถานะผู้ป่วย รายชื่อทีม และสรุปผล ROSC / DEAD แยกตามกลุ่มบริการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
          <button
            type="button"
            onClick={() => exportCasesToCsv(workListRows)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition min-h-[42px] whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => exportInteractiveHtml({ cases: workListRows })}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition min-h-[42px] whitespace-nowrap"
          >
            <FileCode2 className="w-4 h-4 text-teal-700" />
            <span>Export HTML (Interactive)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition min-h-[42px] whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>พิมพ์รายงาน</span>
          </button>

          <button
            type="button"
            onClick={onNewRecord}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition min-h-[42px] whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>+ บันทึก CPR ใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter Bar Card — matching Image 3 */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ค้นหาทั่วไป (ชื่อ / AN / Note / สาเหตุ)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchAll}
                onChange={(e) => setSearchAll(e.target.value)}
                placeholder="ค้นหาชื่อผู้ป่วย, สาเหตุ, Note..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ID / HN / AN
            </label>
            <input
              type="text"
              value={searchIdHn}
              onChange={(e) => setSearchIdHn(e.target.value)}
              placeholder="เช่น 1131000 หรือ 405"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono-tabular text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              กลุ่มบริการ
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as 'ALL' | ServiceGroup)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
            >
              <option value="ALL">ทุกกลุ่มบริการ</option>
              {SERVICE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label} — {g.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              สถานะงาน
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | CprWorkflowStatus)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="ACTIVE_CPR">กำลังทำ CPR</option>
              <option value="POST_ROSC_FOLLOWUP">ติดตาม Post-ROSC</option>
              <option value="PENDING_REVIEW">รอสรุปผล (Temp)</option>
              <option value="COMPLETED">บันทึกสมบูรณ์</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-mono-tabular text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-mono-tabular text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[40px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5 KPI Summary Cards — Clickable ROSC & DEAD cards linking directly to patient list */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => jumpToWorkList('ALL', 'all')}
          className={`text-left rounded-2xl bg-white border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-sky-300 transition ${
            outcomeFilter === 'ALL' && workTab === 'all'
              ? 'border-sky-400 ring-2 ring-sky-500/15'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-slate-500">เคส CPR ทั้งหมด</div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-slate-900">
                {kpis.total}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {kpis.activeCount > 0 ? (
                  <span className="font-semibold text-red-600">
                    กำลัง CPR {kpis.activeCount} เคส
                  </span>
                ) : (
                  'คลิกเพื่อดูทั้งหมด'
                )}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Separate Clickable ROSC Summary Card */}
        <button
          type="button"
          onClick={() => jumpToWorkList('ROSC', 'all')}
          className={`text-left rounded-2xl bg-white border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-teal-400 transition group ${
            outcomeFilter === 'ROSC'
              ? 'border-teal-500 ring-2 ring-teal-500/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-slate-500">จำนวนผู้ป่วย ROSC</div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-teal-600">
                {kpis.roscCases}
              </div>
              <div className="mt-1 text-xs text-teal-700 font-medium inline-flex items-center gap-1">
                <span className="font-mono-tabular">{kpis.roscRate}%</span>
                <span>· ดูรายชื่อ</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-teal-600 flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Separate Clickable DEAD Summary Card */}
        <button
          type="button"
          onClick={() => jumpToWorkList('DEAD', 'all')}
          className={`text-left rounded-2xl bg-white border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-red-300 transition group ${
            outcomeFilter === 'DEAD'
              ? 'border-red-400 ring-2 ring-red-500/15'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-slate-500">จำนวนผู้ป่วย DEAD</div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-red-600">
                {kpis.deadCases}
              </div>
              <div className="mt-1 text-xs text-red-600 font-medium inline-flex items-center gap-1">
                <span className="font-mono-tabular">{kpis.deadRate}%</span>
                <span>· ดูรายชื่อ</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <HeartOff className="w-4 h-4" />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => jumpToWorkList('ALL', 'temp')}
          className={`text-left rounded-2xl bg-white border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-amber-300 transition ${
            workTab === 'temp'
              ? 'border-amber-400 ring-2 ring-amber-500/15'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-slate-500">รอสรุปผล / Post-ROSC</div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-amber-600">
                {kpis.pendingOrFollowupCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 inline-flex items-center gap-1">
                <span>ดูรายชื่อเคสรอสรุป</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
        </button>

        <div className="col-span-2 md:col-span-1 rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-slate-500">เวลาเฉลี่ยต่อเคส</div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono-tabular text-slate-900">
                {formatDurationHMS(kpis.avgDuration)}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono-tabular">
                เฉลี่ย {kpis.avgCycles} Cycles / เคส
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Visual Analytics — matching Image 3's Bar Chart + Service Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                จำนวนเคส CPR เทียบผลลัพธ์ ROSC รายกลุ่มบริการ
              </h2>
              <p className="text-xs text-slate-500">
                เปรียบเทียบจำนวนผู้ป่วยทั้งหมดกับผู้ป่วยที่กลับมามีชีพจร (ROSC)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#68A8DF]" />
                เคสทั้งหมด
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#56C2A7]" />
                ROSC
              </span>
            </div>
          </div>

          <div className="mt-5 h-52 flex flex-col justify-end">
            <div className="relative flex-1 flex items-end justify-around gap-3 pt-4 border-b border-slate-200">
              {/* Subtle horizontal gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3].map((line) => (
                  <div key={line} className="border-t border-slate-100 w-full" />
                ))}
              </div>

              {deptChartData.groups.map((item) => {
                const totalPct = Math.round((item.total / deptChartData.maxVal) * 100);
                const roscPct = Math.round((item.rosc / deptChartData.maxVal) * 100);
                const isHovered = hoveredDept === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setHoveredDept(item.key)}
                    onMouseLeave={() => setHoveredDept(null)}
                    onClick={() =>
                      setServiceFilter((prev) => (prev === item.key ? 'ALL' : item.key))
                    }
                    className="relative z-10 flex-1 flex flex-col items-center h-full justify-end group focus:outline-none"
                    title={`${item.label}: ทั้งหมด ${item.total} เคส · ROSC ${item.rosc} เคส`}
                  >
                    {isHovered && (
                      <div className="absolute -top-2 bg-slate-900 text-white text-[10px] font-mono-tabular px-2 py-1 rounded-lg shadow-md whitespace-nowrap">
                        {item.shortLabel}: {item.total} เคส / ROSC {item.rosc}
                      </div>
                    )}
                    <div className="w-full max-w-[54px] flex items-end justify-center gap-1.5 h-[145px]">
                      <div
                        style={{ height: `${Math.max(item.total > 0 ? 10 : 3, totalPct)}%` }}
                        className="w-5 sm:w-6 rounded-t-md bg-[#68A8DF] group-hover:bg-blue-500 transition-all duration-200"
                      />
                      <div
                        style={{ height: `${Math.max(item.rosc > 0 ? 10 : 3, roscPct)}%` }}
                        className="w-5 sm:w-6 rounded-t-md bg-[#56C2A7] group-hover:bg-teal-500 transition-all duration-200"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="pt-2.5 flex justify-around gap-3">
              {deptChartData.groups.map((item) => (
                <div key={item.key} className="flex-1 text-center">
                  <div
                    className={`text-xs font-semibold ${
                      serviceFilter === item.key ? 'text-blue-600' : 'text-slate-600'
                    }`}
                  >
                    {item.shortLabel}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-400">
                    {item.total} เคส
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              สัดส่วนเคส CPR ตามกลุ่มบริการ
            </h2>
            <p className="text-xs text-slate-500">
              Service distribution · แตะเพื่อกรอง Work List ตามแผนก
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {distributionData.map((row) => (
              <button
                key={row.group}
                type="button"
                onClick={() =>
                  setServiceFilter((prev) => (prev === row.group ? 'ALL' : row.group))
                }
                className="w-full text-left group focus:outline-none"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span
                    className={`font-semibold ${
                      serviceFilter === row.group ? 'text-blue-600' : 'text-slate-800'
                    }`}
                  >
                    {row.group}{' '}
                    <span className="font-normal text-slate-500">· {row.description}</span>
                  </span>
                  <span className="font-mono-tabular text-slate-600">
                    {row.count} เคส · {row.pct}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${row.pct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${row.colorClass}`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Systematic Real-Time Work List */}
      <div
        id="cpr-worklist"
        ref={workListRef}
        className="scroll-mt-16 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden"
      >
        <div className="p-4 sm:px-5 sm:py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                CPR work list แบบ Realtime
              </h2>
              <span className="text-xs font-mono-tabular text-slate-500">
                · {workListRows.length} รายการ
              </span>
              {outcomeFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('ALL')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    outcomeFilter === 'ROSC'
                      ? 'bg-emerald-50 border-emerald-200 text-teal-800 hover:bg-emerald-100'
                      : outcomeFilter === 'DEAD'
                        ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <span>เฉพาะ Outcome: {outcomeFilter}</span>
                  <span className="text-[11px] opacity-80">× ล้างตัวกรอง</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงสถานะปัจจุบัน เวลาที่เดินจริง รายชื่อ Team ที่ร่วมทำ CPR และสถานะการซิงค์ข้อมูล
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 no-print">
            {(
              [
                { key: 'all', label: `ทั้งหมด (${tabCounts.all})` },
                { key: 'urgent', label: `กำลังทำ / Post-ROSC (${tabCounts.urgent})` },
                { key: 'temp', label: `Temp / รอสรุป (${tabCounts.temp})` },
                { key: 'completed', label: `เสร็จสิ้น (${tabCounts.completed})` },
              ] as { key: WorkTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setWorkTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px] ${
                  workTab === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connectivity / Pending Sync strip if offline or pending */}
        {(!isOnline || pendingSyncCount > 0) && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
            <span className="flex items-center gap-2 font-medium">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              {!isOnline
                ? 'กำลังแสดงข้อมูลจากหน่วยความจำออฟไลน์ในเครื่อง (IndexedDB)'
                : `มีข้อมูลรอซิงค์ขึ้นเซิร์ฟเวอร์ ${pendingSyncCount} รายการ`}
            </span>
          </div>
        )}

        {isLoading && cases.length === 0 ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : workListRows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-semibold text-slate-700">
              ไม่พบรายการ CPR ตามเงื่อนไขที่เลือก
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ลองล้างตัวกรองหรือกดปุ่มบันทึก CPR ใหม่เพื่อเริ่มต้นบันทึกเหตุการณ์
            </p>
            <button
              type="button"
              onClick={onNewRecord}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700 transition min-h-[42px]"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>+ บันทึก CPR ใหม่</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop / Wide Tablet High-Density Table */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="py-3 pl-5 pr-3">ID / AN / HN</th>
                    <th className="py-3 px-3">Patient &amp; หน่วยงาน</th>
                    <th className="py-3 px-3">Start / End</th>
                    <th className="py-3 px-3 text-right">Duration</th>
                    <th className="py-3 px-3">สถานะปัจจุบัน</th>
                    <th className="py-3 px-3">Outcome</th>
                    <th className="py-3 px-3 text-right">Cycle / Med / Defib</th>
                    <th className="py-3 px-3">Assessment &amp; Causes</th>
                    <th className="py-3 px-3">Team ที่ร่วมทำ CPR</th>
                    <th className="py-3 px-3">Clinical Note</th>
                    <th className="py-3 pl-3 pr-5 text-right no-print">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {workListRows.map((c) => {
                    const liveDuration = getLiveDuration(c);
                    const statusMeta = WORKFLOW_STATUS_META[c.status];
                    const isUrgentRow = c.status === 'ACTIVE_CPR';
                    const teamEntries = getTeamEntries(c.team);

                    return (
                      <tr
                        key={c.clientId || c.id}
                        className={`transition-colors hover:bg-slate-50/90 ${
                          isUrgentRow ? 'bg-amber-50/35' : 'bg-white'
                        }`}
                      >
                        <td className="py-3 pl-5 pr-3 align-top font-mono-tabular whitespace-nowrap">
                          <div className="font-bold text-slate-900">#{c.id}</div>
                          <div className="text-[11px] text-slate-500">AN {c.an || '—'}</div>
                          <div className="text-[11px] text-slate-500">HN {c.hn || '—'}</div>
                        </td>

                        <td className="py-3 px-3 align-top min-w-[180px]">
                          <div className="font-semibold text-slate-900">
                            {c.patientName || 'ผู้ป่วยไม่ระบุชื่อ'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {c.serviceGroup} · {c.department}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top font-mono-tabular text-[11px] text-slate-600 whitespace-nowrap">
                          <div>{formatShortDateTime(c.startTime)}</div>
                          <div className="text-slate-400">
                            {c.endTime ? formatShortDateTime(c.endTime) : 'กำลังดำเนินการ...'}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono-tabular whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              c.isRunning ? 'text-red-600' : 'text-slate-900'
                            }`}
                          >
                            {formatDurationHMS(liveDuration)}
                          </span>
                        </td>

                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className={`font-semibold ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-1">
                            {c.syncState === 'pending' ? (
                              <span className="text-amber-600 font-medium">รอซิงค์ออฟไลน์</span>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                <span>ซิงค์แล้ว</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top font-mono-tabular font-bold whitespace-nowrap">
                          <span
                            className={
                              c.outcome === 'ROSC'
                                ? 'text-teal-600'
                                : c.outcome === 'DEAD'
                                  ? 'text-slate-600'
                                  : c.outcome === 'ONGOING'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                            }
                          >
                            {c.outcome}
                          </span>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                          <span>{c.cycles}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span>{c.medicineCount}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span>{c.defibCount}</span>
                        </td>

                        <td className="py-3 px-3 align-top max-w-[200px]">
                          <div className="text-[11px] text-slate-700 truncate">
                            {c.initialAssessment.length > 0
                              ? c.initialAssessment.join(', ')
                              : '—'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                            {c.causes.length > 0 ? c.causes.join(', ') : 'ยังไม่ระบุสาเหตุ'}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top min-w-[200px] max-w-[240px]">
                          {teamEntries.length === 0 ? (
                            <span className="text-[11px] text-slate-400">—</span>
                          ) : (
                            <div className="space-y-0.5 text-[11px] leading-snug">
                              {teamEntries.map((entry) => (
                                <div key={entry.key} className="truncate">
                                  <span className="font-semibold text-slate-700">
                                    {entry.shortLabel}:
                                  </span>{' '}
                                  <span className="text-slate-600">{entry.names.join(', ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top max-w-[180px]">
                          <div className="text-[11px] text-slate-600 line-clamp-2">
                            {c.clinicalNote || '—'}
                          </div>
                        </td>

                        <td className="py-3 pl-3 pr-5 align-top text-right whitespace-nowrap no-print">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onViewPdf(c)}
                              className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="ดูสรุป CPR (PDF)"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenRecord(c, 'edit')}
                              className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition"
                              title="เปิดบันทึก / แก้ไข CPR"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {confirmDeleteId === c.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteRecord(c.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
                              >
                                ยืนยันลบ
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Touch-Optimized Work List Cards */}
            <div className="xl:hidden divide-y divide-slate-100">
              {workListRows.map((c) => {
                const liveDuration = getLiveDuration(c);
                const statusMeta = WORKFLOW_STATUS_META[c.status];
                const teamEntries = getTeamEntries(c.team);

                return (
                  <div
                    key={c.clientId || c.id}
                    className={`p-4 space-y-3 ${
                      c.status === 'ACTIVE_CPR' ? 'bg-amber-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono-tabular text-slate-500">
                          #{c.id} · HN {c.hn || '—'} · AN {c.an || '—'}
                        </div>
                        <h3 className="mt-0.5 text-sm font-bold text-slate-900 truncate">
                          {c.patientName || 'ผู้ป่วยไม่ระบุชื่อ'}
                        </h3>
                        <div className="text-xs text-slate-500">
                          {c.serviceGroup} · {c.department}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-base font-bold font-mono-tabular ${
                            c.isRunning ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {formatDurationHMS(liveDuration)}
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            c.outcome === 'ROSC'
                              ? 'text-teal-600'
                              : c.outcome === 'ONGOING'
                                ? 'text-red-600'
                                : 'text-slate-600'
                          }`}
                        >
                          {c.outcome}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="font-mono-tabular text-slate-600">
                        Cycle {c.cycles} · Med {c.medicineCount} · Defib {c.defibCount}
                      </div>
                    </div>

                    {teamEntries.length > 0 && (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 space-y-0.5">
                        <div className="font-semibold text-slate-700 inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-sky-600" />
                          <span>Team ที่ร่วมทำ CPR</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                          {teamEntries.map((entry) => (
                            <div key={entry.key} className="truncate">
                              <span className="font-medium text-slate-700">
                                {entry.shortLabel}:
                              </span>{' '}
                              {entry.names.join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {c.clinicalNote && (
                      <p className="text-xs text-slate-600 line-clamp-2">{c.clinicalNote}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        {c.syncState === 'pending' ? (
                          <>
                            <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-amber-700 font-medium">รอซิงค์ออฟไลน์</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-teal-600" />
                            <span>ซิงค์แล้ว</span>
                          </>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewPdf(c)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-semibold min-h-[44px] transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenRecord(c, 'edit')}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold min-h-[44px] transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>เปิดบันทึก CPR</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
