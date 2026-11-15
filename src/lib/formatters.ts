import type { CprRecord } from '../types/cpr';

export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatShortDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTimeOnly(iso: string | null): string {
  if (!iso) return '00:00:00';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '00:00:00';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function getDueCountdownInfo(dueAt: string | null, nowMs: number): {
  state: 'none' | 'normal' | 'due_soon' | 'overdue';
  label: string;
  diffSeconds: number;
} {
  if (!dueAt) {
    return { state: 'none', label: 'ไม่มีกำหนดค้าง', diffSeconds: Infinity };
  }
  const diffSec = Math.floor((new Date(dueAt).getTime() - nowMs) / 1000);
  if (diffSec < 0) {
    const abs = Math.abs(diffSec);
    return {
      state: 'overdue',
      label: `เกินกำหนด ${formatTimerSeconds(abs)}`,
      diffSeconds: diffSec,
    };
  }
  if (diffSec <= 300) {
    return {
      state: 'due_soon',
      label: `ใกล้ครบกำหนด ${formatTimerSeconds(diffSec)}`,
      diffSeconds: diffSec,
    };
  }
  return {
    state: 'normal',
    label: `อีก ${Math.ceil(diffSec / 60)} นาที`,
    diffSeconds: diffSec,
  };
}

export function exportCasesToCsv(cases: CprRecord[]): void {
  const headers = [
    'ID',
    'AN',
    'HN',
    'Patient Name',
    'Service Group',
    'Department',
    'Start',
    'End',
    'Duration',
    'Status',
    'Outcome',
    'Cycle',
    'Medication',
    'Defib',
    'Initial Assessment',
    'Causes of Cardiac Arrest',
    'Team',
    'Clinical Note',
  ];

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = cases.map((c) => {
    const teamText = [
      c.team?.leader?.length ? `Leader: ${c.team.leader.join(', ')}` : '',
      c.team?.airway?.length ? `Airway: ${c.team.airway.join(', ')}` : '',
      c.team?.compressor?.length ? `Compressor: ${c.team.compressor.join(', ')}` : '',
      c.team?.medication?.length ? `IV/Med: ${c.team.medication.join(', ')}` : '',
      c.team?.monitor?.length ? `Monitor: ${c.team.monitor.join(', ')}` : '',
      c.team?.recorder?.length ? `Recorder: ${c.team.recorder.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return [
      c.id,
      c.an,
      c.hn,
      c.patientName,
      c.serviceGroup,
      c.department,
      formatShortDateTime(c.startTime),
      formatShortDateTime(c.endTime),
      formatDurationHMS(c.durationSeconds),
      c.status,
      c.outcome,
      c.cycles,
      c.medicineCount,
      c.defibCount,
      c.initialAssessment.join('; '),
      c.causes.join('; '),
      teamText,
      c.clinicalNote,
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cpr-worklist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
