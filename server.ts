import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { CprRecord, PatientDirectoryItem, WorkAlert } from './src/types/cpr';
import { PATIENT_DIRECTORY } from './src/data/cprConstants';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.cpr-data');
const DATA_FILE = path.join(DATA_DIR, 'cases.json');

type SseClient = {
  id: string;
  res: express.Response;
};

const sseClients = new Set<SseClient>();

function broadcastSse(eventName: string, payload: unknown) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function buildSeedCases(): CprRecord[] {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  const minsFromNow = (m: number) => new Date(now + m * 60_000).toISOString();

  return [
    {
      id: '405',
      clientId: 'seed-405',
      an: 'E691114-0215',
      hn: '1135291',
      patientName: 'MR. วิชัย รักษ์ไทย',
      department: 'ER Trauma Bay',
      serviceGroup: 'ER',
      startTime: minsAgo(3),
      endTime: null,
      durationSeconds: 185,
      isRunning: true,
      status: 'ACTIVE_CPR',
      outcome: 'ONGOING',
      cycles: 1,
      medicineCount: 1,
      defibCount: 1,
      events: [
        {
          id: 'ev-405-4',
          elapsedSeconds: 165,
          timestamp: minsAgo(0.3),
          type: 'DEFIB',
          title: 'DEFIBRILLATOR',
          detail: 'Defibrillation 200 Joules (Shock advised)',
        },
        {
          id: 'ev-405-3',
          elapsedSeconds: 120,
          timestamp: minsAgo(1),
          type: 'RHYTHM',
          title: 'RHYTHM',
          detail: 'VF (Ventricular Fibrillation)',
        },
        {
          id: 'ev-405-2',
          elapsedSeconds: 60,
          timestamp: minsAgo(2),
          type: 'ADRENALINE',
          title: 'ADRENALINE',
          detail: 'Epinephrine (Adrenaline) 1mg/ml IV Push',
        },
        {
          id: 'ev-405-1',
          elapsedSeconds: 0,
          timestamp: minsAgo(3),
          type: 'START',
          title: 'START CPR',
          detail: 'เริ่มปฏิบัติการช่วยฟื้นคืนชีพ High-quality CPR',
        },
      ],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)', 'No pulse (ไม่มีชีพจร)'],
      causes: ['Hypovolemia', 'Thrombosis: AMI'],
      clinicalNote: 'กำลังทำ CPR รอบที่ 2 เตรียมประเมิน Rhythm และให้ Amiodarone หากยังเป็น VF',
      team: {
        leader: ['นพ. กิตติพงษ์ วงศ์สุวรรณ'],
        airway: ['พว. มณีรัตน์ จันทร์เพ็ญ'],
        compressor: ['นชพ. อนุชา แสงทอง'],
        medication: ['พว. พัชรินทร์ แก้วมณี'],
        monitor: ['พว. ศิริพร ทองดี'],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: minsFromNow(1),
      lastCycleAtSec: 120,
      lastAdrenalineAtSec: 60,
      updatedAt: minsAgo(0.2),
      syncState: 'synced',
    },
    {
      id: '402',
      clientId: 'seed-402',
      an: 'I691114-0108',
      hn: '1134810',
      patientName: 'MRS. สมหญิง ใจดี',
      department: 'CCU โรคหัวใจ',
      serviceGroup: 'ICU',
      startTime: minsAgo(26),
      endTime: minsAgo(14),
      durationSeconds: 720,
      isRunning: false,
      status: 'POST_ROSC_FOLLOWUP',
      outcome: 'ROSC',
      cycles: 6,
      medicineCount: 3,
      defibCount: 2,
      events: [
        {
          id: 'ev-402-3',
          elapsedSeconds: 720,
          timestamp: minsAgo(14),
          type: 'ROSC',
          title: 'ROSC ACHIEVED',
          detail: 'กลับมามีชีพจร (ROSC) BP 108/66 mmHg',
        },
        {
          id: 'ev-402-2',
          elapsedSeconds: 360,
          timestamp: minsAgo(20),
          type: 'MEDICINE',
          title: 'MEDICINE',
          detail: 'Amiodarone 150 mg IV drip',
        },
        {
          id: 'ev-402-1',
          elapsedSeconds: 180,
          timestamp: minsAgo(23),
          type: 'ADRENALINE',
          title: 'ADRENALINE',
          detail: 'Epinephrine (Adrenaline) 1mg/ml',
        },
      ],
      initialAssessment: [
        'Unresponsive (ไม่ตอบสนอง)',
        'Not breathing / Agonal breathing (ไม่หายใจ / หายใจเฮือก)',
        'No pulse (ไม่มีชีพจร)',
      ],
      causes: ['Thrombosis: AMI', 'Hypoxia'],
      clinicalNote: 'Post-ROSC: 12-lead ECG, เตรียมส่งทำ PCI และติดตามสัญญาณชีพทุก 15 นาที',
      team: {
        leader: ['พญ. สุภาวดี ศรีสวัสดิ์'],
        airway: ['นพ. ธนกร เจริญสุข'],
        compressor: ['นชพ. ปิยะวัฒน์ ดีมาก'],
        medication: ['พว. ชุติมา รัตนโชติ'],
        monitor: ['พว. ศิริพร ทองดี'],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: minsFromNow(4),
      lastCycleAtSec: 720,
      lastAdrenalineAtSec: 180,
      updatedAt: minsAgo(12),
      syncState: 'synced',
    },
    {
      id: '399',
      clientId: 'seed-399',
      an: 'I691114-0302',
      hn: '1136044',
      patientName: 'MS. กัญญา พงษ์ไพร',
      department: 'OR ห้องผ่าตัดใหญ่',
      serviceGroup: 'OR',
      startTime: minsAgo(48),
      endTime: minsAgo(41),
      durationSeconds: 425,
      isRunning: false,
      status: 'PENDING_REVIEW',
      outcome: 'ROSC',
      cycles: 3,
      medicineCount: 1,
      defibCount: 1,
      events: [
        {
          id: 'ev-399-2',
          elapsedSeconds: 240,
          timestamp: minsAgo(44),
          type: 'DEFIB',
          title: 'DEFIBRILLATOR',
          detail: 'Defibrillation 150 J',
        },
        {
          id: 'ev-399-1',
          elapsedSeconds: 120,
          timestamp: minsAgo(46),
          type: 'ADRENALINE',
          title: 'ADRENALINE',
          detail: 'Epinephrine (Adrenaline) 1mg/ml',
        },
      ],
      initialAssessment: ['No pulse (ไม่มีชีพจร)'],
      causes: ['Hypovolemia'],
      clinicalNote: 'บันทึก Temp ระหว่างเคลื่อนย้ายเข้า ICU รอแพทย์เจ้าของไข้ตรวจสอบยืนยัน Causes',
      team: {
        leader: ['นพ. กิตติพงษ์ วงศ์สุวรรณ'],
        airway: ['นพ. ธนกร เจริญสุข'],
        compressor: [],
        medication: ['พว. มณีรัตน์ จันทร์เพ็ญ'],
        monitor: [],
        recorder: ['พว. ชุติมา รัตนโชติ'],
      },
      dueAt: minsAgo(2), // Overdue SLA!
      lastCycleAtSec: 420,
      lastAdrenalineAtSec: 120,
      updatedAt: minsAgo(35),
      syncState: 'synced',
    },
    {
      id: '366',
      clientId: 'seed-366',
      an: 'E691110-0036',
      hn: '1131792',
      patientName: 'MR. ชาย คุณท่าน',
      department: 'อายุรกรรมชาย',
      serviceGroup: 'IPD',
      startTime: '2026-11-13T18:17:00.000Z',
      endTime: '2026-11-13T18:25:00.000Z',
      durationSeconds: 475,
      isRunning: false,
      status: 'COMPLETED',
      outcome: 'ROSC',
      cycles: 3,
      medicineCount: 1,
      defibCount: 1,
      events: [
        {
          id: 'ev-366-2',
          elapsedSeconds: 300,
          timestamp: '2026-11-13T18:22:00.000Z',
          type: 'DEFIB',
          title: 'DEFIBRILLATOR',
          detail: 'Defibrillation 200 J',
        },
        {
          id: 'ev-366-1',
          elapsedSeconds: 120,
          timestamp: '2026-11-13T18:19:00.000Z',
          type: 'ADRENALINE',
          title: 'ADRENALINE',
          detail: 'Epinephrine (Adrenaline) 1mg/ml',
        },
      ],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)', 'No pulse (ไม่มีชีพจร)'],
      causes: ['Hypokalemia/Hyperkalemia'],
      clinicalNote: 'ทดสอบการบันทึก Clinical Note · ผู้ป่วยอาการคงที่หลัง ROSC',
      team: {
        leader: ['พญ. สุภาวดี ศรีสวัสดิ์'],
        airway: ['พว. มณีรัตน์ จันทร์เพ็ญ'],
        compressor: ['นชพ. อนุชา แสงทอง'],
        medication: ['พว. พัชรินทร์ แก้วมณี'],
        monitor: ['พว. ศิริพร ทองดี'],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: null,
      lastCycleAtSec: 360,
      lastAdrenalineAtSec: 120,
      updatedAt: '2026-11-13T18:30:00.000Z',
      syncState: 'synced',
    },
    {
      id: '333',
      clientId: 'seed-333',
      an: 'O691112-0035',
      hn: '1132023',
      patientName: 'MR. CPR TESTTEMP',
      department: 'ICU อายุรกรรม',
      serviceGroup: 'ICU',
      startTime: '2026-11-12T11:18:00.000Z',
      endTime: '2026-11-12T11:20:00.000Z',
      durationSeconds: 94,
      isRunning: false,
      status: 'PENDING_REVIEW',
      outcome: 'ROSC',
      cycles: 1,
      medicineCount: 1,
      defibCount: 0,
      events: [
        {
          id: 'ev-333-1',
          elapsedSeconds: 45,
          timestamp: '2026-11-12T11:18:45.000Z',
          type: 'MEDICINE',
          title: 'MEDICINE',
          detail: 'Amiodarone 150 mg',
        },
      ],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)'],
      causes: ['Hypoxia'],
      clinicalNote: 'รายการชั่วคราว (Temp) รอตรวจสอบบันทึกให้สมบูรณ์',
      team: {
        leader: ['นพ. กิตติพงษ์ วงศ์สุวรรณ'],
        airway: [],
        compressor: [],
        medication: [],
        monitor: [],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: minsFromNow(8),
      lastCycleAtSec: 0,
      lastAdrenalineAtSec: null,
      updatedAt: '2026-11-14T02:10:00.000Z',
      syncState: 'synced',
    },
    {
      id: '300',
      clientId: 'seed-300',
      an: 'O691112-0002',
      hn: '1131000',
      patientName: 'MR. APPOINTMENT TESTHISTORY',
      department: 'ER Resuscitation Room',
      serviceGroup: 'ER',
      startTime: '2026-11-12T10:49:00.000Z',
      endTime: '2026-11-12T11:15:00.000Z',
      durationSeconds: 1560,
      isRunning: false,
      status: 'COMPLETED',
      outcome: 'ROSC',
      cycles: 13,
      medicineCount: 2,
      defibCount: 1,
      events: [
        {
          id: 'ev-300-2',
          elapsedSeconds: 900,
          timestamp: '2026-11-12T11:04:00.000Z',
          type: 'DEFIB',
          title: 'DEFIBRILLATOR',
          detail: 'Defibrillation 200 J',
        },
        {
          id: 'ev-300-1',
          elapsedSeconds: 300,
          timestamp: '2026-11-12T10:54:00.000Z',
          type: 'MEDICINE',
          title: 'MEDICINE',
          detail: 'Amiodarone 300 mg',
        },
      ],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)', 'No pulse (ไม่มีชีพจร)'],
      causes: ['Thrombosis: AMI'],
      clinicalNote: 'test end · ปิดเคสเรียบร้อย',
      team: {
        leader: ['นพ. ธนกร เจริญสุข'],
        airway: ['พว. มณีรัตน์ จันทร์เพ็ญ'],
        compressor: ['นชพ. อนุชา แสงทอง'],
        medication: ['พว. พัชรินทร์ แก้วมณี'],
        monitor: ['พว. ศิริพร ทองดี'],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: null,
      lastCycleAtSec: 1560,
      lastAdrenalineAtSec: 600,
      updatedAt: '2026-11-12T11:16:00.000Z',
      syncState: 'synced',
    },
    {
      id: '295',
      clientId: 'seed-295',
      an: 'O691111-0118',
      hn: '1137119',
      patientName: 'MR. ประสิทธิ์ มั่นคง',
      department: 'ตรวจโรคทั่วไป',
      serviceGroup: 'OPD',
      startTime: '2026-11-11T09:10:00.000Z',
      endTime: '2026-11-11T09:38:00.000Z',
      durationSeconds: 1680,
      isRunning: false,
      status: 'COMPLETED',
      outcome: 'DEAD',
      cycles: 14,
      medicineCount: 6,
      defibCount: 3,
      events: [],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)', 'Not breathing / Agonal breathing (ไม่หายใจ / หายใจเฮือก)', 'No pulse (ไม่มีชีพจร)'],
      causes: ['Thrombosis: PE'],
      clinicalNote: 'ญาติรับทราบและเข้าใจ แพทย์ลงความเห็นยุติการช่วยฟื้นคืนชีพ',
      team: {
        leader: ['พญ. สุภาวดี ศรีสวัสดิ์'],
        airway: ['นพ. กิตติพงษ์ วงศ์สุวรรณ'],
        compressor: ['นชพ. ปิยะวัฒน์ ดีมาก'],
        medication: ['พว. ชุติมา รัตนโชติ'],
        monitor: [],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: null,
      lastCycleAtSec: 1680,
      lastAdrenalineAtSec: 1200,
      updatedAt: '2026-11-11T09:42:00.000Z',
      syncState: 'synced',
    },
    {
      id: '288',
      clientId: 'seed-288',
      an: 'I691110-0519',
      hn: '1138502',
      patientName: 'MRS. นงลักษณ์ สุขศรี',
      department: 'อายุรกรรมหญิง',
      serviceGroup: 'IPD',
      startTime: '2026-11-10T14:22:00.000Z',
      endTime: '2026-11-10T14:39:00.000Z',
      durationSeconds: 1020,
      isRunning: false,
      status: 'COMPLETED',
      outcome: 'DEAD',
      cycles: 8,
      medicineCount: 4,
      defibCount: 0,
      events: [],
      initialAssessment: ['Unresponsive (ไม่ตอบสนอง)', 'No pulse (ไม่มีชีพจร)'],
      causes: ['Hydrogen ion (acidosis)', 'Hypoxia'],
      clinicalNote: 'PEA ต่อเนื่อง ไม่ตอบสนองต่อการรักษา',
      team: {
        leader: ['นพ. ธนกร เจริญสุข'],
        airway: ['พว. มณีรัตน์ จันทร์เพ็ญ'],
        compressor: ['นชพ. อนุชา แสงทอง'],
        medication: ['พว. พัชรินทร์ แก้วมณี'],
        monitor: [],
        recorder: ['พว. วราภรณ์ นาคสุข'],
      },
      dueAt: null,
      lastCycleAtSec: 960,
      lastAdrenalineAtSec: 720,
      updatedAt: '2026-11-10T14:45:00.000Z',
      syncState: 'synced',
    },
  ];
}

function loadStore(): CprRecord[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to seed data
  }
  return buildSeedCases();
}

function saveStore(records: CprRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
  } catch {
    // Read-only FS fallback: stay in memory safely
  }
}

let casesStore: CprRecord[] = loadStore();

function upsertRecordInStore(incoming: CprRecord): { record: CprRecord; statusChanged: boolean; previousStatus?: string; isNew: boolean } {
  const idx = casesStore.findIndex(
    (c) => c.id === incoming.id || (incoming.clientId && c.clientId === incoming.clientId)
  );
  const normalized: CprRecord = {
    ...incoming,
    syncState: 'synced',
    updatedAt: incoming.updatedAt || new Date().toISOString(),
  };

  if (idx === -1) {
    const numericIds = casesStore
      .map((c) => Number(c.id))
      .filter((n) => !Number.isNaN(n));
    const nextNumericId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 406;
    if (!normalized.id || normalized.id.startsWith('local-')) {
      normalized.id = String(nextNumericId);
    }
    casesStore = [normalized, ...casesStore];
    saveStore(casesStore);
    return { record: normalized, statusChanged: true, isNew: true };
  }

  const prev = casesStore[idx];
  const prevTime = new Date(prev.updatedAt).getTime();
  const nextTime = new Date(normalized.updatedAt).getTime();
  if (nextTime < prevTime) {
    return { record: prev, statusChanged: false, isNew: false };
  }

  const statusChanged = prev.status !== normalized.status || prev.outcome !== normalized.outcome;
  casesStore[idx] = { ...normalized, id: prev.id };
  saveStore(casesStore);
  return { record: casesStore[idx], statusChanged, previousStatus: prev.status, isNew: false };
}

function makeStatusAlert(
  record: CprRecord,
  isNew: boolean,
  previousStatus?: string
): WorkAlert {
  const statusLabels: Record<string, string> = {
    ACTIVE_CPR: 'กำลังทำ CPR',
    POST_ROSC_FOLLOWUP: 'ติดตาม Post-ROSC',
    PENDING_REVIEW: 'รอสรุปผล (Temp)',
    COMPLETED: 'บันทึกสมบูรณ์',
  };

  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    caseId: record.id,
    hn: record.hn || '-',
    patientName: record.patientName || 'ผู้ป่วยไม่ระบุชื่อ',
    department: record.department || record.serviceGroup,
    severity: record.status === 'ACTIVE_CPR' ? 'critical' : record.status === 'POST_ROSC_FOLLOWUP' ? 'warning' : 'info',
    kind: 'STATUS_CHANGE',
    title: isNew
      ? `เปิดเคส CPR ใหม่ #${record.id}`
      : `สถานะงาน #${record.id} เปลี่ยนแปลง`,
    message: isNew
      ? `${record.patientName || 'ไม่ระบุชื่อ'} (${record.department}) — ${statusLabels[record.status] || record.status}`
      : `${previousStatus ? `${statusLabels[previousStatus] || previousStatus} → ` : ''}${statusLabels[record.status] || record.status} · Outcome: ${record.outcome}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), casesCount: casesStore.length });
  });

  app.get('/api/cases', (_req, res) => {
    res.json({ cases: casesStore, serverTime: new Date().toISOString() });
  });

  app.post('/api/cases', (req, res) => {
    const incoming = req.body as CprRecord;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid CPR record payload' });
      return;
    }
    const result = upsertRecordInStore(incoming);
    broadcastSse('case:upserted', result.record);
    if (result.statusChanged || result.isNew) {
      broadcastSse('alert:created', makeStatusAlert(result.record, result.isNew, result.previousStatus));
    }
    res.json({ case: result.record });
  });

  app.put('/api/cases/:id', (req, res) => {
    const incoming = { ...(req.body as CprRecord), id: req.params.id };
    const result = upsertRecordInStore(incoming);
    broadcastSse('case:upserted', result.record);
    if (result.statusChanged) {
      broadcastSse('alert:created', makeStatusAlert(result.record, false, result.previousStatus));
    }
    res.json({ case: result.record });
  });

  app.delete('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    const before = casesStore.length;
    casesStore = casesStore.filter((c) => c.id !== id && c.clientId !== id);
    if (casesStore.length !== before) {
      saveStore(casesStore);
      broadcastSse('case:deleted', { id });
    }
    res.json({ ok: true, id });
  });

  app.post('/api/cases/sync', (req, res) => {
    const { operations } = req.body as {
      operations?: Array<{ operation: 'upsert' | 'delete'; id: string; record?: CprRecord }>;
    };
    if (!Array.isArray(operations)) {
      res.status(400).json({ error: 'operations array is required' });
      return;
    }

    const syncedRecords: CprRecord[] = [];
    const deletedIds: string[] = [];

    for (const op of operations) {
      if (op.operation === 'delete') {
        casesStore = casesStore.filter((c) => c.id !== op.id && c.clientId !== op.id);
        deletedIds.push(op.id);
        broadcastSse('case:deleted', { id: op.id });
      } else if (op.operation === 'upsert' && op.record) {
        const result = upsertRecordInStore(op.record);
        syncedRecords.push(result.record);
        broadcastSse('case:upserted', result.record);
        if (result.statusChanged || result.isNew) {
          broadcastSse('alert:created', makeStatusAlert(result.record, result.isNew, result.previousStatus));
        }
      }
    }

    saveStore(casesStore);
    res.json({
      syncedRecords,
      deletedIds,
      cases: casesStore,
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/patients', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const list: PatientDirectoryItem[] = q
      ? PATIENT_DIRECTORY.filter(
          (p) =>
            p.hn.toLowerCase().includes(q) ||
            p.an.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.ward.toLowerCase().includes(q)
        )
      : PATIENT_DIRECTORY;
    res.json({ patients: list });
  });

  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client: SseClient = { id: clientId, res };
    sseClients.add(client);

    res.write(`event: init\ndata: ${JSON.stringify({ cases: casesStore, serverTime: new Date().toISOString() })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(client);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(client);
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CPR Command server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
