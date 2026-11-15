import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Check,
  Cloud,
  CloudOff,
  HeartPulse,
  Monitor,
  Pause,
  Play,
  Plus,
  Search,
  Square,
  Stethoscope,
  Syringe,
  Timer as TimerIcon,
  Trash2,
  UserCheck,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import type {
  CprEvent,
  CprEventType,
  CprOutcome,
  CprRecord,
  CprTeam,
  CprWorkflowStatus,
  PatientDirectoryItem,
  ServiceGroup,
} from '../types/cpr';
import {
  BLOOD_OPTIONS,
  CAUSES_OPTIONS,
  DEFIB_JOULES_OPTIONS,
  DEPARTMENTS_BY_GROUP,
  EMPTY_TEAM,
  ETT_SIZE_OPTIONS,
  FLUID_OPTIONS,
  INITIAL_ASSESSMENT_OPTIONS,
  MEDICINE_OPTIONS,
  PATIENT_DIRECTORY,
  PROCEDURE_OPTIONS,
  RHYTHM_OPTIONS,
  SERVICE_GROUPS,
  STAFF_DIRECTORY,
  TEAM_ROLES,
} from '../data/cprConstants';
import { formatDurationHMS, formatTimeOnly, formatTimerSeconds } from '../lib/formatters';
import {
  cancelCprSpeech,
  playTestSoundChime,
  playTwoMinuteCycleAlarm,
  unlockCprAudio,
} from '../lib/cprAudio';

interface CprRecordViewProps {
  initialRecord: CprRecord | null;
  isOnline: boolean;
  onSaveRecord: (record: CprRecord) => Promise<CprRecord>;
  onCancel: () => void;
  onSavedShowPdf?: (record: CprRecord) => void;
}

export function createBlankCprRecord(): CprRecord {
  const nowIso = new Date().toISOString();
  return {
    id: `local-${Date.now().toString().slice(-4)}`,
    clientId: `cpr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    an: '',
    hn: '',
    patientName: '',
    department: 'ER Resuscitation Room',
    serviceGroup: 'ER',
    startTime: nowIso,
    endTime: null,
    durationSeconds: 0,
    isRunning: false,
    status: 'ACTIVE_CPR',
    outcome: 'ONGOING',
    cycles: 0,
    medicineCount: 0,
    defibCount: 0,
    events: [],
    initialAssessment: [],
    causes: [],
    clinicalNote: '',
    team: { ...EMPTY_TEAM },
    dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    lastCycleAtSec: 0,
    lastAdrenalineAtSec: null,
    updatedAt: nowIso,
    syncState: 'pending',
  };
}

export const CprRecordView: React.FC<CprRecordViewProps> = ({
  initialRecord,
  isOnline,
  onSaveRecord,
  onCancel,
  onSavedShowPdf,
}) => {
  const [draft, setDraft] = useState<CprRecord>(() =>
    initialRecord ? structuredClone(initialRecord) : createBlankCprRecord()
  );
  const [patientQuery, setPatientQuery] = useState(
    initialRecord?.hn || initialRecord?.patientName || ''
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [recentTapLabel, setRecentTapLabel] = useState<string | null>(null);
  const [customNoteEvent, setCustomNoteEvent] = useState('');
  const [activeTeamRole, setActiveTeamRole] = useState<keyof CprTeam | null>(null);
  const [customStaffName, setCustomStaffName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cycleElapsedSeconds, setCycleElapsedSeconds] = useState<number>(() => {
    if (!initialRecord) return 0;
    return Math.min(120, Math.max(0, initialRecord.durationSeconds - initialRecord.lastCycleAtSec));
  });
  const [isCyclePaused, setIsCyclePaused] = useState<boolean>(false);
  const [cyclePauseReason, setCyclePauseReason] = useState<'MANUAL' | 'CHECK_RHYTHM' | null>(null);
  const [twoMinAlertInfo, setTwoMinAlertInfo] = useState<{
    cycleNumber: number;
  } | null>(null);
  const alertedThisCycleRef = useRef<boolean>(false);

  // Sync if user switches to a different case from Dashboard
  useEffect(() => {
    cancelCprSpeech();
    alertedThisCycleRef.current = false;
    setTwoMinAlertInfo(null);
    setIsCyclePaused(false);
    setCyclePauseReason(null);
    if (initialRecord) {
      setDraft(structuredClone(initialRecord));
      setPatientQuery(initialRecord.hn || initialRecord.patientName || '');
      setCycleElapsedSeconds(
        Math.min(120, Math.max(0, initialRecord.durationSeconds - initialRecord.lastCycleAtSec))
      );
    } else {
      const blank = createBlankCprRecord();
      setDraft(blank);
      setPatientQuery('');
      setCycleElapsedSeconds(0);
    }
  }, [initialRecord]);

  // 1-second main CPR duration tick when running
  useEffect(() => {
    if (!draft.isRunning) return;
    const timer = window.setInterval(() => {
      setDraft((prev) => {
        if (!prev.isRunning) return prev;
        return {
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
          updatedAt: new Date().toISOString(),
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [draft.isRunning]);

  // 1-second Time Cycle tick (pauses automatically when isCyclePaused is true or main timer paused)
  useEffect(() => {
    if (!draft.isRunning || isCyclePaused) return;
    const cycleTimer = window.setInterval(() => {
      setCycleElapsedSeconds((prev) => {
        if (prev >= 120) return 120;
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(cycleTimer);
  }, [draft.isRunning, isCyclePaused]);

  // Clinical 2-min Time Cycle and 3-5 min Adrenaline interval display
  const cycleRemainingSec = Math.max(0, 120 - cycleElapsedSeconds);
  const isCycleDue = cycleElapsedSeconds >= 120;
  const isCycleSoon =
    draft.isRunning && !isCyclePaused && cycleElapsedSeconds >= 105 && cycleElapsedSeconds < 120;

  const secondsSinceLastAdrenaline =
    draft.lastAdrenalineAtSec !== null
      ? Math.max(0, draft.durationSeconds - draft.lastAdrenalineAtSec)
      : draft.durationSeconds;
  const isAdrenalineDue = draft.isRunning && secondsSinceLastAdrenaline >= 180;
  const isAdrenalineSoon =
    draft.isRunning && secondsSinceLastAdrenaline >= 150 && secondsSinceLastAdrenaline < 180;

  // When Time Cycle reaches 2 minutes (120s): pause Time Cycle + speak "2 minutes check rhythm" + show banner
  useEffect(() => {
    if (cycleElapsedSeconds < 120) {
      alertedThisCycleRef.current = false;
      return;
    }

    if (!draft.isRunning || alertedThisCycleRef.current) return;

    alertedThisCycleRef.current = true;
    setIsCyclePaused(true);
    setCyclePauseReason('CHECK_RHYTHM');
    setTwoMinAlertInfo({
      cycleNumber: draft.cycles + 1,
    });

    if (soundEnabled) {
      playTwoMinuteCycleAlarm();
    }
  }, [draft.isRunning, draft.cycles, cycleElapsedSeconds, soundEnabled]);

  // Repeat "2 minutes check rhythm" every 15s while waiting at 2-minute check rhythm alert
  const hasTwoMinAlert = twoMinAlertInfo !== null;
  useEffect(() => {
    if (!hasTwoMinAlert || !draft.isRunning || !soundEnabled) return;
    const repeatTimer = window.setInterval(() => {
      playTwoMinuteCycleAlarm();
    }, 15_000);
    return () => {
      window.clearInterval(repeatTimer);
      cancelCprSpeech();
    };
  }, [hasTwoMinAlert, draft.isRunning, soundEnabled]);

  useEffect(() => {
    return () => {
      cancelCprSpeech();
    };
  }, []);

  // Auto-persist active local draft to localStorage so accidental close never loses taps
  useEffect(() => {
    try {
      localStorage.setItem('cpr_command_active_draft_v1', JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  const patientSuggestions = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return PATIENT_DIRECTORY.slice(0, 6);
    return PATIENT_DIRECTORY.filter(
      (p) =>
        p.hn.toLowerCase().includes(q) ||
        p.an.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.ward.toLowerCase().includes(q)
    );
  }, [patientQuery]);

  const flashTap = (label: string) => {
    setRecentTapLabel(label);
    window.setTimeout(() => {
      setRecentTapLabel((cur) => (cur === label ? null : cur));
    }, 1200);
  };

  const addEvent = (
    type: CprEventType,
    title: string,
    detail: string,
    extraPatch?: Partial<CprRecord>
  ) => {
    unlockCprAudio();
    const isCycleReset = type === 'CYCLE' || type === 'RHYTHM';
    const completedTwoMinCycle = cycleElapsedSeconds >= 120;
    if (isCycleReset) {
      cancelCprSpeech();
      alertedThisCycleRef.current = false;
      setCycleElapsedSeconds(0);
      setIsCyclePaused(false);
      setCyclePauseReason(null);
      setTwoMinAlertInfo(null);
    }

    const nowIso = new Date().toISOString();
    setDraft((prev) => {
      const event: CprEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        elapsedSeconds: prev.durationSeconds,
        timestamp: nowIso,
        type,
        title,
        detail,
      };

      const isMed = type === 'MEDICINE' || type === 'ADRENALINE';
      const isDefib = type === 'DEFIB';
      const shouldIncrementCycle =
        type === 'CYCLE' || (type === 'RHYTHM' && completedTwoMinCycle);

      return {
        ...prev,
        events: [event, ...prev.events],
        medicineCount: prev.medicineCount + (isMed ? 1 : 0),
        defibCount: prev.defibCount + (isDefib ? 1 : 0),
        cycles: shouldIncrementCycle ? prev.cycles + 1 : prev.cycles,
        lastCycleAtSec: isCycleReset ? prev.durationSeconds : prev.lastCycleAtSec,
        lastAdrenalineAtSec:
          type === 'ADRENALINE' ? prev.durationSeconds : prev.lastAdrenalineAtSec,
        updatedAt: nowIso,
        syncState: 'pending',
        ...extraPatch,
      };
    });
    flashTap(detail);
  };

  const handleStartTimer = () => {
    unlockCprAudio();
    cancelCprSpeech();
    const nowIso = new Date().toISOString();
    const shouldStartNewCycle = cycleElapsedSeconds >= 120;

    if (shouldStartNewCycle) {
      alertedThisCycleRef.current = false;
      setCycleElapsedSeconds(0);
      setIsCyclePaused(false);
      setCyclePauseReason(null);
      setTwoMinAlertInfo(null);
    }

    setDraft((prev) => {
      const hasStart = prev.events.some((e) => e.type === 'START');
      const startEvent: CprEvent | null = hasStart
        ? null
        : {
            id: `ev-start-${Date.now()}`,
            elapsedSeconds: prev.durationSeconds,
            timestamp: nowIso,
            type: 'START',
            title: 'START CPR',
            detail: 'เริ่มปฏิบัติการช่วยฟื้นคืนชีพ (CPR Started)',
          };

      return {
        ...prev,
        startTime: prev.events.length === 0 && prev.durationSeconds === 0 ? nowIso : prev.startTime,
        endTime: null,
        isRunning: true,
        status: 'ACTIVE_CPR',
        outcome: prev.outcome === 'DEAD' ? 'ONGOING' : prev.outcome,
        cycles: shouldStartNewCycle ? prev.cycles + 1 : prev.cycles,
        lastCycleAtSec: shouldStartNewCycle ? prev.durationSeconds : prev.lastCycleAtSec,
        events: startEvent ? [startEvent, ...prev.events] : prev.events,
        updatedAt: nowIso,
        syncState: 'pending',
      };
    });
    flashTap(shouldStartNewCycle ? 'เริ่มนับ Cycle ถัดไป' : 'เริ่มจับเวลา CPR');
  };

  const handlePauseMainTimer = () => {
    cancelCprSpeech();
    setDraft((p) => ({ ...p, isRunning: false }));
    flashTap('หยุดเวลาชั่วคราว (Pause)');
  };

  const handlePauseTimeCycle = () => {
    cancelCprSpeech();
    setIsCyclePaused(true);
    setCyclePauseReason('MANUAL');
    flashTap('Pause Time Cycle');
  };

  const handleStartTimeCycle = () => {
    unlockCprAudio();
    cancelCprSpeech();
    const completedCycle = cycleElapsedSeconds >= 120;

    if (completedCycle) {
      addEvent(
        'CYCLE',
        'CYCLE ASSESSMENT',
        `ครบรอบ Cycle #${draft.cycles + 1} · ประเมิน Rhythm & เริ่มนับรอบใหม่`
      );
      if (!draft.isRunning) {
        setDraft((prev) => ({ ...prev, isRunning: true, endTime: null, status: 'ACTIVE_CPR' }));
      }
      return;
    }

    // Mid-cycle resume: continue counting from paused second without resetting
    setIsCyclePaused(false);
    setCyclePauseReason(null);
    setTwoMinAlertInfo(null);
    if (!draft.isRunning) {
      handleStartTimer();
      return;
    }
    flashTap('Start นับต่อ Time Cycle');
  };

  const handleStopTimer = () => {
    cancelCprSpeech();
    setTwoMinAlertInfo(null);
    const nowIso = new Date().toISOString();
    setDraft((prev) => {
      const stopEvent: CprEvent = {
        id: `ev-stop-${Date.now()}`,
        elapsedSeconds: prev.durationSeconds,
        timestamp: nowIso,
        type: 'STOP',
        title: 'STOP CPR',
        detail: `หยุดจับเวลา CPR ที่ ${formatTimerSeconds(prev.durationSeconds)}`,
      };
      return {
        ...prev,
        isRunning: false,
        endTime: nowIso,
        events: [stopEvent, ...prev.events],
        updatedAt: nowIso,
        syncState: 'pending',
      };
    });
    flashTap('หยุดเวลา CPR');
  };

  const handleMarkRosc = () => {
    const nowIso = new Date().toISOString();
    setDraft((prev) => {
      const roscEvent: CprEvent = {
        id: `ev-rosc-${Date.now()}`,
        elapsedSeconds: prev.durationSeconds,
        timestamp: nowIso,
        type: 'ROSC',
        title: 'ROSC ACHIEVED',
        detail: `กลับมามีชีพจร (ROSC) ที่เวลา ${formatTimerSeconds(prev.durationSeconds)}`,
      };
      return {
        ...prev,
        isRunning: false,
        endTime: nowIso,
        outcome: 'ROSC',
        status: 'POST_ROSC_FOLLOWUP',
        dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        events: [roscEvent, ...prev.events],
        updatedAt: nowIso,
        syncState: 'pending',
      };
    });
    flashTap('บันทึก ROSC สำเร็จ');
  };

  const handleSelectPatient = (p: PatientDirectoryItem) => {
    setDraft((prev) => ({
      ...prev,
      hn: p.hn,
      an: p.an,
      patientName: p.name,
      department: p.ward,
      serviceGroup: p.serviceGroup,
      updatedAt: new Date().toISOString(),
    }));
    setPatientQuery(`${p.hn} · ${p.name}`);
    setShowPatientDropdown(false);
  };

  const handleUpdateEventDetail = (eventId: string, detail: string) => {
    setDraft((prev) => ({
      ...prev,
      events: prev.events.map((ev) => (ev.id === eventId ? { ...ev, detail } : ev)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    setDraft((prev) => {
      const target = prev.events.find((e) => e.id === eventId);
      const nextEvents = prev.events.filter((e) => e.id !== eventId);
      return {
        ...prev,
        events: nextEvents,
        medicineCount:
          target && (target.type === 'MEDICINE' || target.type === 'ADRENALINE')
            ? Math.max(0, prev.medicineCount - 1)
            : prev.medicineCount,
        defibCount:
          target && target.type === 'DEFIB' ? Math.max(0, prev.defibCount - 1) : prev.defibCount,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const toggleCheckbox = (field: 'initialAssessment' | 'causes', value: string) => {
    setDraft((prev) => {
      const list = prev[field];
      const exists = list.includes(value);
      return {
        ...prev,
        [field]: exists ? list.filter((item) => item !== value) : [...list, value],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleAddTeamMember = (roleKey: keyof CprTeam, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDraft((prev) => {
      const current = prev.team[roleKey];
      if (current.includes(trimmed)) return prev;
      return {
        ...prev,
        team: {
          ...prev.team,
          [roleKey]: [...current, trimmed],
        },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleRemoveTeamMember = (roleKey: keyof CprTeam, name: string) => {
    setDraft((prev) => ({
      ...prev,
      team: {
        ...prev.team,
        [roleKey]: prev.team[roleKey].filter((n) => n !== name),
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSave = async (asTemp: boolean) => {
    setIsSaving(true);
    try {
      const nextStatus: CprWorkflowStatus = asTemp
        ? 'PENDING_REVIEW'
        : draft.outcome === 'ROSC' && draft.status === 'ACTIVE_CPR'
          ? 'POST_ROSC_FOLLOWUP'
          : draft.outcome === 'DEAD' || draft.outcome === 'REFER'
            ? 'COMPLETED'
            : draft.status;

      const payload: CprRecord = {
        ...draft,
        status: nextStatus,
        isRunning: asTemp ? false : draft.isRunning,
        endTime:
          nextStatus === 'COMPLETED' && !draft.endTime
            ? new Date().toISOString()
            : draft.endTime,
        dueAt:
          nextStatus === 'COMPLETED'
            ? null
            : nextStatus === 'PENDING_REVIEW'
              ? new Date(Date.now() + 30 * 60_000).toISOString()
              : draft.dueAt || new Date(Date.now() + 15 * 60_000).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await onSaveRecord(payload);
      setDraft(saved);
      try {
        localStorage.removeItem('cpr_command_active_draft_v1');
      } catch {
        // ignore
      }
      if (!asTemp && onSavedShowPdf) {
        onSavedShowPdf(saved);
      } else {
        setSaveFeedback(
          isOnline
            ? 'บันทึกและซิงค์ขึ้นเซิร์ฟเวอร์เรียบร้อย'
            : 'บันทึกออฟไลน์ลงเครื่องเรียบร้อย (รอซิงค์อัตโนมัติ)'
        );
        window.setTimeout(() => setSaveFeedback(null), 3500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const roleIcon = (key: keyof CprTeam) => {
    switch (key) {
      case 'leader':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'airway':
        return <Wind className="w-4 h-4 text-sky-600" />;
      case 'compressor':
        return <Activity className="w-4 h-4 text-teal-600" />;
      case 'medication':
        return <Syringe className="w-4 h-4 text-indigo-600" />;
      case 'monitor':
        return <Monitor className="w-4 h-4 text-red-600" />;
      case 'recorder':
        return <TimerIcon className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Breadcrumb & Quick Feedback Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับ Dashboard</span>
          </button>
          <div>
            <div className="text-[11px] font-medium text-slate-500">
              CPR Management / CPR Record #{draft.id}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              บันทึกการช่วยฟื้นคืนชีพ (CPR Record)
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {recentTapLabel && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
              <Check className="w-3.5 h-3.5" />
              บันทึก: {recentTapLabel}
            </span>
          )}
          {saveFeedback && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
              <Check className="w-3.5 h-3.5" />
              {saveFeedback}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border ${
              isOnline
                ? 'bg-white border-slate-200 text-slate-600'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {isOnline ? (
              <Cloud className="w-3.5 h-3.5 text-teal-600" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{isOnline ? 'ออนไลน์ · พร้อมซิงค์' : 'ออฟไลน์ · บันทึกลงเครื่อง'}</span>
          </span>
        </div>
      </div>

      {/* Prominent On-Screen 2-Minute CPR Cycle Alert Banner */}
      {twoMinAlertInfo && (
        <div
          role="alert"
          aria-live="assertive"
          className="sticky top-3 z-40 rounded-2xl bg-red-600 text-white border-2 border-red-200 shadow-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6 text-white animate-bounce" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-bold tracking-tight">
                    2 minutes check rhythm — Time Cycle หยุดรอชั่วคราว
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-0.5 text-[11px] font-mono-tabular font-bold whitespace-nowrap shrink-0">
                    {soundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>เสียงอ่าน: 2 minutes check rhythm</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>ปิดเสียงอยู่</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-red-50 mt-0.5 font-mono-tabular">
                  ครบ Cycle #{twoMinAlertInfo.cycleNumber} (2:00) · เวลา CPR รวม{' '}
                  <strong>{formatTimerSeconds(draft.durationSeconds)}</strong> · กด Start เพื่อนับรอบถัดไป
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                cancelCprSpeech();
                setTwoMinAlertInfo(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 hover:bg-red-800 border border-red-400/60 px-3.5 py-2 text-xs font-semibold text-white min-h-[44px] whitespace-nowrap shrink-0 transition"
            >
              <X className="w-4 h-4" />
              <span>ปิดแถบแจ้งเตือน</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleStartTimeCycle}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 px-4 py-2.5 text-xs sm:text-sm font-bold shadow-sm min-h-[44px] whitespace-nowrap shrink-0 active:scale-[0.98] transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start นับต่อ (เริ่ม Cycle ใหม่)</span>
            </button>

            <span className="text-[11px] font-semibold text-red-100 px-1 whitespace-nowrap">
              หรือบันทึก Rhythm ทันที:
            </span>

            {(['VF', 'pVT', 'PEA', 'Asystole'] as const).map((rhythm) => (
              <button
                key={rhythm}
                type="button"
                onClick={() => addEvent('RHYTHM', 'RHYTHM', `Rhythm: ${rhythm}`)}
                className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 px-3.5 py-2 text-xs font-bold text-white min-h-[44px] whitespace-nowrap shrink-0 active:scale-[0.97] transition"
              >
                {rhythm}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Row: Patient Search & Summary Card (matching Image 2 top row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Patient Lookup & Info */}
        <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3.5">
          <div className="relative">
            <label className="block text-xs font-semibold text-blue-700 mb-1.5">
              HN / ชื่อผู้ป่วย (ค้นหาได้แม้ขณะออฟไลน์)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={patientQuery}
                  onFocus={() => setShowPatientDropdown(true)}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  placeholder="พิมพ์ HN, AN หรือชื่อผู้ป่วย..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 min-h-[44px]"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPatientDropdown((v) => !v)}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 text-xs font-semibold whitespace-nowrap min-h-[44px] transition"
              >
                ค้นหา
              </button>
            </div>

            {showPatientDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>เลือกรายชื่อผู้ป่วย ({patientSuggestions.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowPatientDropdown(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    ปิด
                  </button>
                </div>
                {patientSuggestions.map((p) => (
                  <button
                    key={p.hn}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-sky-50 flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] font-mono-tabular text-slate-500">
                        HN {p.hn} · AN {p.an}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-sky-700 shrink-0">
                      {p.serviceGroup} · {p.ward}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">HN</label>
              <input
                type="text"
                value={draft.hn}
                onChange={(e) => setDraft((p) => ({ ...p, hn: e.target.value }))}
                placeholder="113xxxx"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono-tabular text-slate-900 min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">AN</label>
              <input
                type="text"
                value={draft.an}
                onChange={(e) => setDraft((p) => ({ ...p, an: e.target.value }))}
                placeholder="E69xxxx"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono-tabular text-slate-900 min-h-[40px]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                ชื่อ-สกุลผู้ป่วย
              </label>
              <input
                type="text"
                value={draft.patientName}
                onChange={(e) => setDraft((p) => ({ ...p, patientName: e.target.value }))}
                placeholder="ระบุชื่อผู้ป่วย"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 min-h-[40px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                กลุ่มบริการ
              </label>
              <select
                value={draft.serviceGroup}
                onChange={(e) => {
                  const sg = e.target.value as ServiceGroup;
                  setDraft((p) => ({
                    ...p,
                    serviceGroup: sg,
                    department: DEPARTMENTS_BY_GROUP[sg][0],
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 min-h-[40px]"
              >
                {SERVICE_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label} — {g.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                หน่วยงาน / หอผู้ป่วย
              </label>
              <select
                value={draft.department}
                onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 min-h-[40px]"
              >
                {DEPARTMENTS_BY_GROUP[draft.serviceGroup].map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Card (matching Image 2 Summary box) */}
        <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Summary</h2>
              <p className="text-xs text-slate-500">สรุปการทำ CPR และผลลัพธ์</p>
            </div>

            <div className="space-y-1 text-xs font-mono-tabular">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-700 font-bold">START</span>
                <span className="text-slate-600">
                  Start time {formatTimeOnly(draft.startTime)}
                </span>
                <span className="text-red-600 font-bold">END</span>
                <span className="text-slate-600">
                  End time {draft.endTime ? formatTimeOnly(draft.endTime) : '00:00:00'}
                </span>
              </div>
              <div className="font-bold text-slate-900">
                Duration {formatDurationHMS(draft.durationSeconds)}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-slate-600">Outcome</span>
              <div className="flex flex-wrap gap-2">
                {(['ROSC', 'DEAD', 'ONGOING', 'REFER'] as CprOutcome[]).map((opt) => (
                  <label
                    key={opt}
                    className={`inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition min-h-[36px] ${
                      draft.outcome === opt
                        ? opt === 'ROSC'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : opt === 'DEAD'
                            ? 'bg-slate-100 border-slate-400 text-slate-900'
                            : 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cpr-outcome"
                      value={opt}
                      checked={draft.outcome === opt}
                      onChange={() =>
                        setDraft((p) => ({
                          ...p,
                          outcome: opt,
                          status:
                            opt === 'ROSC'
                              ? 'POST_ROSC_FOLLOWUP'
                              : opt === 'DEAD' || opt === 'REFER'
                                ? 'COMPLETED'
                                : 'ACTIVE_CPR',
                        }))
                      }
                      className="sr-only"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 py-3 px-3 text-center">
              <div className="text-[11px] font-medium text-slate-500">Cycles</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
                {draft.cycles}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 py-3 px-3 text-center">
              <div className="text-[11px] font-medium text-slate-500">Medicine</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
                {draft.medicineCount}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 py-3 px-3 text-center">
              <div className="text-[11px] font-medium text-slate-500">Defib</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
                {draft.defibCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: CPR Timer & Event Timeline (matching Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CPR Timer */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">CPR Timer</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  unlockCprAudio();
                  setSoundEnabled((v) => !v);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold min-h-[34px] whitespace-nowrap shrink-0 transition ${
                  soundEnabled
                    ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{soundEnabled ? 'เสียงเตือน 2 นาที: เปิด' : 'ปิดเสียงเตือน'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  unlockCprAudio();
                  playTestSoundChime();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 min-h-[34px] whitespace-nowrap shrink-0 transition"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>ทดสอบเสียง</span>
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-4xl sm:text-5xl font-bold font-mono-tabular text-blue-600 tracking-tight">
                {formatTimerSeconds(draft.durationSeconds)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono-tabular">
                Cycles: <strong className="text-slate-800">{draft.cycles}</strong> · Running:{' '}
                <strong className={draft.isRunning ? 'text-teal-600' : 'text-slate-700'}>
                  {draft.isRunning ? 'Yes' : 'No'}
                </strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {!draft.isRunning ? (
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 text-sm font-bold shadow-xs min-h-[48px] min-w-[112px] active:scale-[0.98] transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePauseMainTimer}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-sm font-bold shadow-xs min-h-[48px] min-w-[112px] active:scale-[0.98] transition"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStopTimer}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-sm font-bold shadow-xs min-h-[48px] min-w-[112px] active:scale-[0.98] transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          {/* 1-Tap Emergency Action Buttons: Adrenaline + Cycle + ROSC */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                addEvent(
                  'ADRENALINE',
                  'ADRENALINE',
                  'Epinephrine (Adrenaline) 1mg/ml IV Push'
                )
              }
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs sm:text-sm py-3 px-3 shadow-xs min-h-[48px] active:scale-[0.97] transition"
            >
              Adrenaline
            </button>

            <button
              type="button"
              onClick={() =>
                addEvent(
                  'CYCLE',
                  'CYCLE ASSESSMENT',
                  `ครบรอบ Cycle #${draft.cycles + 1} · ประเมิน Rhythm & เปลี่ยนผู้กด`
                )
              }
              className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm py-3 px-3 shadow-xs min-h-[48px] active:scale-[0.97] transition"
            >
              +1 Cycle
            </button>

            <button
              type="button"
              onClick={handleMarkRosc}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-3 px-3 shadow-xs min-h-[48px] active:scale-[0.97] transition flex items-center justify-center gap-1"
            >
              <HeartPulse className="w-4 h-4" />
              <span>ROSC</span>
            </button>
          </div>

          {/* Live Cycle & Adrenaline Protocol Countdown Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div
              className={`rounded-xl p-3 border space-y-2 ${
                isCycleDue
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : isCyclePaused
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : isCycleSoon
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-semibold flex items-center justify-between gap-2">
                <span>Time Cycle (2 นาที)</span>
                <span className="font-mono-tabular font-bold text-sm">
                  {isCycleDue
                    ? '00:00 (Check Rhythm)'
                    : formatTimerSeconds(cycleRemainingSec)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] opacity-85 font-mono-tabular">
                  {isCycleDue
                    ? 'Paused · ครบ 2 นาที'
                    : isCyclePaused || !draft.isRunning
                      ? `Paused · เดินไป ${formatTimerSeconds(cycleElapsedSeconds)}`
                      : `กำลังนับ · ${formatTimerSeconds(cycleElapsedSeconds)} / 02:00`}
                </span>
                {draft.isRunning && !isCyclePaused ? (
                  <button
                    type="button"
                    onClick={handlePauseTimeCycle}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 text-[11px] font-bold min-h-[34px] whitespace-nowrap shrink-0 transition"
                  >
                    <Pause className="w-3 h-3 fill-current" />
                    <span>Pause Cycle</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartTimeCycle}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 text-[11px] font-bold min-h-[34px] whitespace-nowrap shrink-0 transition"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isCycleDue ? 'Start รอบใหม่' : 'Start นับต่อ'}</span>
                  </button>
                )}
              </div>
            </div>

            <div
              className={`rounded-xl p-2.5 border ${
                isAdrenalineDue
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : isAdrenalineSoon
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="font-semibold flex items-center justify-between">
                <span>รอบ Adrenaline (3-5 นาที)</span>
                <span className="font-mono-tabular font-bold">
                  {formatTimerSeconds(secondsSinceLastAdrenaline)}
                </span>
              </div>
              <div className="text-[11px] mt-0.5 opacity-85">
                {isAdrenalineDue ? 'ครบกำหนดให้ Adrenaline 1 mg' : 'นับเวลาจากเข็มล่าสุด'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-xl bg-slate-50 py-2.5 px-2 text-center">
              <div className="text-[11px] text-slate-500">Total Time</div>
              <div className="mt-0.5 text-base font-bold font-mono-tabular text-slate-900">
                {formatTimerSeconds(draft.durationSeconds)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 py-2.5 px-2 text-center">
              <div className="text-[11px] text-slate-500">Medicines</div>
              <div className="mt-0.5 text-base font-bold font-mono-tabular text-slate-900">
                {draft.medicineCount}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 py-2.5 px-2 text-center">
              <div className="text-[11px] text-slate-500">Defib</div>
              <div className="mt-0.5 text-base font-bold font-mono-tabular text-slate-900">
                {draft.defibCount}
              </div>
            </div>
          </div>
        </div>

        {/* Event Timeline (matching Image 2 Event Timeline) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Event Timeline</h2>
              <p className="text-xs text-slate-500">บันทึกเหตุการณ์เรียงลำดับล่าสุดขึ้นก่อน</p>
            </div>
            <div className="text-xs font-mono-tabular font-semibold text-slate-700">
              Total events: {draft.events.length}
            </div>
          </div>

          {/* Quick custom event bar */}
          <div className="py-2.5 flex gap-2">
            <input
              type="text"
              value={customNoteEvent}
              onChange={(e) => setCustomNoteEvent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customNoteEvent.trim()) {
                  addEvent('NOTE', 'EVENT NOTE', customNoteEvent.trim());
                  setCustomNoteEvent('');
                }
              }}
              placeholder="พิมพ์เหตุการณ์เพิ่มเติม ณ เวลานี้ แล้วกด Enter..."
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 min-h-[40px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!customNoteEvent.trim()) return;
                addEvent('NOTE', 'EVENT NOTE', customNoteEvent.trim());
                setCustomNoteEvent('');
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 min-h-[40px] whitespace-nowrap"
            >
              + เพิ่มโน้ต
            </button>
          </div>

          <div className="flex-1 max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
            {draft.events.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                ยังไม่มีเหตุการณ์ — กดปุ่ม Start หรือแตะยา/Rhythm/Defib ด้านล่างเพื่อบันทึกทันที
              </div>
            ) : (
              draft.events.map((ev) => {
                const tagColor =
                  ev.type === 'ADRENALINE'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : ev.type === 'DEFIB'
                      ? 'text-red-700 bg-red-50 border-red-200'
                      : ev.type === 'BLOOD'
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : ev.type === 'FLUID'
                          ? 'text-cyan-700 bg-cyan-50 border-cyan-200'
                          : ev.type === 'ROSC'
                            ? 'text-teal-700 bg-teal-50 border-teal-200'
                            : 'text-sky-700 bg-sky-50 border-sky-200';

                return (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 p-3 bg-white flex items-start gap-3"
                  >
                    <div className="text-xs font-mono-tabular font-semibold text-slate-500 pt-1 shrink-0">
                      {formatTimerSeconds(ev.elapsedSeconds)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{ev.title}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono-tabular font-bold px-2 py-0.5 rounded-md border ${tagColor}`}
                          >
                            {ev.type.slice(0, 3)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            aria-label="ลบเหตุการณ์"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={ev.detail}
                        onChange={(e) => handleUpdateEventDetail(ev.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Third Row: Quick-Tap Clinical Buttons (Left) & Initial Assessment + Causes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Rapid Tap Interventions (Medicine, Rhythm, Defibrillator, ETT, Fluid, Procedure) */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Medicine */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Medicine</h3>
            <div className="flex flex-wrap gap-2">
              {MEDICINE_OPTIONS.map((med, i) => (
                <button
                  key={med}
                  type="button"
                  onClick={() => addEvent('MEDICINE', 'MEDICINE', med)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] active:scale-[0.97] transition text-left ${
                    i === 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-slate-200 bg-white text-slate-800 hover:bg-sky-50 hover:border-sky-300'
                  }`}
                >
                  {med}
                </button>
              ))}
            </div>
          </section>

          {/* Rhythm */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Rhythm</h3>
            <div className="flex flex-wrap gap-2">
              {RHYTHM_OPTIONS.map((rhythm) => (
                <button
                  key={rhythm}
                  type="button"
                  onClick={() => addEvent('RHYTHM', 'RHYTHM', `Rhythm: ${rhythm}`)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 px-3.5 py-2 text-xs font-bold text-slate-800 min-h-[44px] active:scale-[0.97] transition"
                >
                  {rhythm}
                </button>
              ))}
            </div>
          </section>

          {/* Defibrillator */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Defibrillator (Joules)</h3>
            <div className="flex flex-wrap gap-2">
              {DEFIB_JOULES_OPTIONS.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() =>
                    addEvent('DEFIB', 'DEFIBRILLATOR', `Defibrillation ${j} Joules`)
                  }
                  className="rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700 px-4 py-2 text-xs font-mono-tabular font-bold text-slate-800 min-h-[44px] min-w-[64px] active:scale-[0.97] transition"
                >
                  {j} J
                </button>
              ))}
            </div>
          </section>

          {/* ETT */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">ETT (Size)</h3>
            <div className="flex flex-wrap gap-2">
              {ETT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => addEvent('ETT', 'ETT INTUBATION', `ETT Size No. ${size}`)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 px-3.5 py-2 text-xs font-mono-tabular font-bold text-slate-800 min-h-[44px] min-w-[48px] active:scale-[0.97] transition"
                >
                  {size}
                </button>
              ))}
            </div>
          </section>

          {/* Fluid */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Fluid</h3>
            <div className="flex flex-wrap gap-2">
              {FLUID_OPTIONS.map((fluid) => (
                <button
                  key={fluid}
                  type="button"
                  onClick={() => addEvent('FLUID', 'IV FLUID', fluid)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 px-3.5 py-2 text-xs font-semibold text-slate-800 min-h-[44px] active:scale-[0.97] transition"
                >
                  {fluid}
                </button>
              ))}
            </div>
          </section>

          {/* Blood */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Blood</h3>
            <div className="flex flex-wrap gap-2">
              {BLOOD_OPTIONS.map((blood) => (
                <button
                  key={blood}
                  type="button"
                  onClick={() => addEvent('BLOOD', 'BLOOD', blood)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 px-3.5 py-2 text-xs font-semibold text-slate-800 min-h-[44px] active:scale-[0.97] transition"
                >
                  {blood}
                </button>
              ))}
            </div>
          </section>

          {/* Procedure */}
          <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Procedure</h3>
            <div className="flex flex-wrap gap-2">
              {PROCEDURE_OPTIONS.map((proc) => (
                <button
                  key={proc}
                  type="button"
                  onClick={() => addEvent('PROCEDURE', 'PROCEDURE', proc)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 px-4 py-2 text-xs font-semibold text-slate-800 min-h-[44px] active:scale-[0.97] transition"
                >
                  {proc}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Initial Assessment & Causes of Cardiac Arrest */}
        <div className="lg:col-span-7 space-y-4">
          <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Initial Assessment</h3>
            </div>
            <div className="space-y-2">
              {INITIAL_ASSESSMENT_OPTIONS.map((opt) => {
                const checked = draft.initialAssessment.includes(opt.label);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 border cursor-pointer transition min-h-[44px] ${
                      checked
                        ? 'bg-sky-50/70 border-sky-300 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheckbox('initialAssessment', opt.label)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Causes of Cardiac Arrest (5H / 5T)
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                เลือกแล้ว {draft.causes.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CAUSES_OPTIONS.map((cause) => {
                const checked = draft.causes.includes(cause);
                return (
                  <label
                    key={cause}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border cursor-pointer transition min-h-[44px] ${
                      checked
                        ? 'bg-sky-50/70 border-sky-300 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheckbox('causes', cause)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-medium">{cause}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Row: Clinical Note & Team (matching Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <label className="block text-xs font-bold text-slate-900 mb-2">Clinical Note</label>
          <textarea
            rows={5}
            value={draft.clinicalNote}
            onChange={(e) => setDraft((p) => ({ ...p, clinicalNote: e.target.value }))}
            placeholder="บันทึกรายละเอียดทางคลินิก การส่งต่อ หรือคำสั่งแพทย์เพิ่มเติม..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900">Team (ทีมช่วยฟื้นคืนชีพ)</h3>
            <span className="text-xs text-slate-500">แตะ + เพื่อระบุชื่อผู้ปฏิบัติงาน</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEAM_ROLES.map((role) => {
              const members = draft.team[role.key];
              return (
                <div
                  key={role.key}
                  className="rounded-xl border border-slate-200 p-3 bg-white space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
                      {roleIcon(role.key)}
                      {role.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTeamRole((cur) => (cur === role.key ? null : role.key))
                      }
                      className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
                      aria-label={`เพิ่มรายชื่อ ${role.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {members.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-800"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => handleRemoveTeamMember(role.key, name)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label={`ลบ ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {activeTeamRole === role.key && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customStaffName}
                          onChange={(e) => setCustomStaffName(e.target.value)}
                          placeholder="พิมพ์ชื่อบุคลากร..."
                          className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddTeamMember(role.key, customStaffName);
                            setCustomStaffName('');
                          }}
                          className="rounded-lg bg-blue-600 text-white px-2.5 py-1.5 text-xs font-semibold"
                        >
                          เพิ่ม
                        </button>
                      </div>
                      <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1">
                        {STAFF_DIRECTORY.map((staff) => (
                          <button
                            key={staff}
                            type="button"
                            onClick={() => handleAddTeamMember(role.key, staff)}
                            className="text-[11px] px-2 py-1 rounded-md bg-slate-50 hover:bg-sky-50 text-slate-700 border border-slate-200"
                          >
                            + {staff}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Save / Temp / Cancel Action Bar (matching Image 2) */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-6 py-2.5 text-sm font-semibold text-slate-700 min-h-[48px] transition"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave(true)}
          className="rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 text-sm font-semibold text-blue-700 min-h-[48px] transition disabled:opacity-60"
        >
          บันทึกชั่วคราว (Temp)
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave(false)}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-8 py-2.5 text-sm font-bold shadow-sm min-h-[48px] transition disabled:opacity-60"
        >
          {isSaving ? 'กำลังบันทึก...' : isOnline ? 'Save & Sync' : 'Save (Offline)'}
        </button>
      </div>
    </div>
  );
};
