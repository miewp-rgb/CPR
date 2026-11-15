export type CprWorkflowStatus =
  | 'ACTIVE_CPR'
  | 'POST_ROSC_FOLLOWUP'
  | 'PENDING_REVIEW'
  | 'COMPLETED';

export type CprOutcome = 'ROSC' | 'DEAD' | 'ONGOING' | 'REFER';

export type ServiceGroup = 'ER' | 'ICU' | 'IPD' | 'OR' | 'OPD';

export type CprEventType =
  | 'START'
  | 'CYCLE'
  | 'ADRENALINE'
  | 'MEDICINE'
  | 'RHYTHM'
  | 'DEFIB'
  | 'ETT'
  | 'FLUID'
  | 'BLOOD'
  | 'PROCEDURE'
  | 'ROSC'
  | 'STOP'
  | 'NOTE';

export interface CprEvent {
  id: string;
  elapsedSeconds: number;
  timestamp: string;
  type: CprEventType;
  title: string;
  detail: string;
  meta?: string;
}

export interface CprTeam {
  leader: string[];
  airway: string[];
  compressor: string[];
  medication: string[];
  monitor: string[];
  recorder: string[];
}

export type SyncState = 'synced' | 'pending' | 'error';

export interface CprRecord {
  id: string;
  clientId: string;
  an: string;
  hn: string;
  patientName: string;
  department: string;
  serviceGroup: ServiceGroup;
  startTime: string; // ISO string
  endTime: string | null; // ISO string or null if active
  durationSeconds: number;
  isRunning: boolean;
  status: CprWorkflowStatus;
  outcome: CprOutcome;
  cycles: number;
  medicineCount: number;
  defibCount: number;
  events: CprEvent[];
  initialAssessment: string[];
  causes: string[];
  clinicalNote: string;
  team: CprTeam;
  dueAt: string | null; // ISO deadline for next follow-up / completion SLA
  lastCycleAtSec: number; // elapsed seconds when last cycle was marked
  lastAdrenalineAtSec: number | null; // elapsed seconds when last adrenaline was given
  updatedAt: string; // ISO string
  syncState?: SyncState;
}

export interface PatientDirectoryItem {
  hn: string;
  an: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  ward: string;
  serviceGroup: ServiceGroup;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertKind =
  | 'STATUS_CHANGE'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'SYNCED'
  | 'CYCLE_DUE'
  | 'ADRENALINE_DUE';

export interface WorkAlert {
  id: string;
  caseId: string;
  hn: string;
  patientName: string;
  department: string;
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface SyncQueueItem {
  id: string; // record id or clientId
  operation: 'upsert' | 'delete';
  record?: CprRecord;
  queuedAt: string;
}
