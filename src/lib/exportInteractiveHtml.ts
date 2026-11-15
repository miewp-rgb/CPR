import type { CprRecord } from '../types/cpr';
import {
  BLOOD_OPTIONS,
  FLUID_OPTIONS,
  MEDICINE_OPTIONS,
  RHYTHM_OPTIONS,
  SERVICE_GROUPS,
  TEAM_ROLES,
  WORKFLOW_STATUS_META,
} from '../data/cprConstants';

export interface ExportHtmlOptions {
  cases: CprRecord[];
  focusedRecordId?: string | null;
  filename?: string;
}

export function exportInteractiveHtml({
  cases,
  focusedRecordId = null,
  filename,
}: ExportHtmlOptions): void {
  const safeJson = (val: unknown) =>
    JSON.stringify(val)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  const initialTab = focusedRecordId ? 'summary' : 'dashboard';
  const exportedAt = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const payload = {
    cases,
    focusedRecordId: focusedRecordId || (cases[0]?.id ?? null),
    initialTab,
    serviceGroups: SERVICE_GROUPS,
    teamRoles: TEAM_ROLES,
    statusMeta: WORKFLOW_STATUS_META,
    medicineOptions: MEDICINE_OPTIONS,
    rhythmOptions: RHYTHM_OPTIONS,
    fluidOptions: FLUID_OPTIONS,
    bloodOptions: BLOOD_OPTIONS,
    exportedAt,
  };

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CPR Work List &amp; Summary — Interactive Report</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --blue: #2563eb;
      --sky: #68a8df;
      --teal: #0d9488;
      --mint: #56c2a7;
      --red: #dc2626;
      --amber: #d97706;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Thai", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    .wrap-anywhere { overflow-wrap: anywhere; word-break: break-word; }
    .topbar {
      position: sticky; top: 0; z-index: 40;
      background: rgba(255,255,255,0.96); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 10px;
      background: linear-gradient(135deg, #14b8a6, #0284c7);
      color: #fff; font-weight: 800; font-size: 13px;
      display: flex; align-items: center; justify-content: center;
    }
    .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .tab-btn {
      border: 1px solid var(--border); background: #fff; color: #334155;
      padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: all 0.15s; min-height: 38px; white-space: nowrap;
    }
    .tab-btn:hover { background: #f1f5f9; }
    .tab-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .btn {
      border: 1px solid var(--border); background: #fff; color: #334155;
      padding: 8px 13px; border-radius: 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; min-height: 38px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    .btn:hover { background: #f8fafc; }
    .btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-teal { background: var(--teal); border-color: var(--teal); color: #fff; }
    .btn-teal:hover { background: #0f766e; }
    .btn-amber { background: #f59e0b; border-color: #f59e0b; color: #fff; }
    .btn-red { background: var(--red); border-color: var(--red); color: #fff; }
    .container { max-width: 1360px; margin: 0 auto; padding: 18px 16px 48px; }
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 16px; box-shadow: 0 1px 2px rgba(15,23,42,0.03);
      min-width: 0;
    }
    .grid { display: grid; gap: 14px; }
    .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
    .kpi-card {
      text-align: left; width: 100%; cursor: pointer;
      transition: border-color 0.15s, transform 0.1s;
    }
    .kpi-card:hover { border-color: #94a3b8; transform: translateY(-1px); }
    .kpi-card.active-ring { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(13,148,136,0.18); }
    .kpi-label { font-size: 12px; color: var(--muted); font-weight: 600; }
    .kpi-val { font-size: 28px; font-weight: 800; margin-top: 6px; letter-spacing: -0.02em; }
    .kpi-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .field label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
    .field input, .field select, .field textarea {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 8px 10px; font-size: 12px; color: var(--text); background: #fff; min-height: 38px;
    }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
    .three-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge-rosc { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge-dead { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
    .badge-ongoing { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .badge-refer { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .pill-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill-btn {
      border: 1px solid var(--border); background: #fff; color: #475569;
      padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .pill-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: #fff; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
    th { background: #f8fafc; color: #475569; font-weight: 700; padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr.clickable:hover { background: #f8fafc; cursor: pointer; }
    .chart-bars { display: flex; align-items: flex-end; gap: 14px; height: 150px; padding: 12px 8px 4px; border-bottom: 1px solid var(--border); }
    .chart-col { flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
    .bar-pair { display: flex; align-items: flex-end; gap: 4px; height: 110px; }
    .bar { width: 14px; border-radius: 6px 6px 2px 2px; transition: height 0.2s; }
    .bar-blue { background: var(--sky); }
    .bar-teal { background: var(--mint); }
    .dist-row { margin-bottom: 10px; }
    .dist-track { width: 100%; height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-top: 4px; }
    .dist-fill { height: 100%; border-radius: 999px; }
    .a4-sheet {
      max-width: 210mm; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1;
      border-radius: 6px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.08);
    }
    .section-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; min-width: 0; overflow: hidden; }
    .section-title { font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 8px; }
    .item-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 12px; border-bottom: 1px dashed #e2e8f0; }
    .item-row:last-child { border-bottom: 0; }
    .alert-banner {
      position: sticky; top: 64px; z-index: 35;
      background: #dc2626; color: #fff; border: 2px solid #fecaca;
      border-radius: 14px; padding: 14px 16px; margin-bottom: 14px;
      box-shadow: 0 12px 28px rgba(220,38,38,0.28);
    }
    .quick-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .quick-btn {
      border: 1px solid var(--border); background: #fff; color: #1e293b;
      padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; min-height: 40px;
    }
    .quick-btn:hover { background: #f0f9ff; border-color: #7dd3fc; }
    .hidden { display: none !important; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; }
      .container { padding: 0; max-width: none; }
      .a4-sheet { box-shadow: none; border: 0; padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <header class="topbar no-print">
    <div class="brand">
      <div class="brand-badge">CPR</div>
      <div>
        <div style="font-size:14px;font-weight:800;">Work list CPR &amp; Interactive Summary</div>
        <div style="font-size:11px;color:#64748b;">ส่งออกเมื่อ ${exportedAt} · ใช้งานแบบออฟไลน์ได้ทันที</div>
      </div>
    </div>

    <nav class="tabs" aria-label="เมนูหลัก">
      <button type="button" class="tab-btn" id="tab-dashboard" onclick="switchTab('dashboard')">Work list CPR (สรุปรวม)</button>
      <button type="button" class="tab-btn" id="tab-summary" onclick="switchTab('summary')">สรุปเคส (A4 / PDF)</button>
      <button type="button" class="tab-btn" id="tab-timer" onclick="switchTab('timer')">CPR Timer &amp; Quick-Tap</button>
    </nav>

    <div class="actions">
      <button type="button" class="btn" onclick="exportFilteredCsv()">Export CSV</button>
      <button type="button" class="btn btn-primary" onclick="window.print()">พิมพ์ / Save PDF</button>
    </div>
  </header>

  <main class="container">
    <!-- TAB 1: DASHBOARD -->
    <section id="view-dashboard" class="grid" style="gap:16px;">
      <div class="card no-print">
        <div class="filters-grid">
          <div class="field">
            <label>ค้นหา (ชื่อ / HN / AN / ทีม / สาเหตุ / Note)</label>
            <input type="text" id="f-search" placeholder="พิมพ์คำค้นหา..." oninput="applyFilters()" />
          </div>
          <div class="field">
            <label>กลุ่มบริการ</label>
            <select id="f-service" onchange="applyFilters()">
              <option value="ALL">ทุกกลุ่มบริการ</option>
              <option value="ER">ER — ห้องฉุกเฉิน</option>
              <option value="ICU">ICU — หอผู้ป่วยวิกฤต</option>
              <option value="IPD">IPD — หอผู้ป่วยใน</option>
              <option value="OR">OR — ห้องผ่าตัด</option>
              <option value="OPD">OPD — ผู้ป่วยนอก</option>
            </select>
          </div>
          <div class="field">
            <label>ผลลัพธ์ (Outcome)</label>
            <select id="f-outcome" onchange="applyFilters()">
              <option value="ALL">ทุกผลลัพธ์</option>
              <option value="ROSC">ROSC</option>
              <option value="DEAD">DEAD</option>
              <option value="ONGOING">ONGOING</option>
              <option value="REFER">REFER</option>
            </select>
          </div>
          <div class="field">
            <label>สถานะงาน</label>
            <select id="f-status" onchange="applyFilters()">
              <option value="ALL">ทุกสถานะ</option>
              <option value="ACTIVE_CPR">กำลังทำ CPR</option>
              <option value="POST_ROSC_FOLLOWUP">ติดตาม Post-ROSC</option>
              <option value="PENDING_REVIEW">รอสรุปผล (Temp)</option>
              <option value="COMPLETED">บันทึกสมบูรณ์</option>
            </select>
          </div>
          <div class="field" style="display:flex;align-items:flex-end;">
            <button type="button" class="btn" style="width:100%;justify-content:center;" onclick="resetFilters()">ล้างตัวกรอง</button>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid kpi-grid" id="kpi-cards"></div>

      <!-- Consolidated Medication / Fluid / Blood Summary across filtered cases -->
      <div class="card">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;font-weight:800;">สรุปรวมรายการยา สารน้ำ และเลือด (ตามเคสที่กรองอยู่)</div>
            <div style="font-size:11px;color:#64748b;">รวมจำนวนแยกตามหมวด ยา (Medicine) / Fluid / Blood อัตโนมัติ</div>
          </div>
          <span class="mono" style="font-size:12px;font-weight:700;color:#334155;" id="consolidated-totals"></span>
        </div>
        <div class="three-col" id="consolidated-mfb"></div>
      </div>

      <!-- Charts -->
      <div class="two-col">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-size:14px;font-weight:800;">จำนวนเคส CPR เทียบ ROSC รายกลุ่มบริการ</div>
              <div style="font-size:11px;color:#64748b;">คลิกที่แท่งกราฟเพื่อกรองดูรายแผนก</div>
            </div>
            <div style="font-size:11px;display:flex;gap:10px;">
              <span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#68a8df;"></span> เคสทั้งหมด</span>
              <span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#56c2a7;"></span> ROSC</span>
            </div>
          </div>
          <div class="chart-bars" id="dept-chart"></div>
        </div>

        <div class="card">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px;">สัดส่วนเคสตามกลุ่มบริการ</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:12px;">Service group distribution</div>
          <div id="service-dist"></div>
        </div>
      </div>

      <!-- Worklist Table -->
      <div class="card" id="worklist-anchor">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
          <div>
            <div style="font-size:15px;font-weight:800;">CPR work list แบบ Interactive</div>
            <div style="font-size:11px;color:#64748b;" id="worklist-subtitle"></div>
          </div>
          <div class="pill-tabs" id="work-tabs"></div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID / AN / HN</th>
                <th>ชื่อผู้ป่วย</th>
                <th>กลุ่ม / หน่วยงาน</th>
                <th>เวลาเริ่ม - จบ / Duration</th>
                <th>Outcome</th>
                <th>Cycle / Med / Defib</th>
                <th>Team ที่ร่วมทำ CPR</th>
                <th>Note / สาเหตุ</th>
                <th class="no-print">จัดการ</th>
              </tr>
            </thead>
            <tbody id="worklist-tbody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: CASE PDF SUMMARY -->
    <section id="view-summary" class="hidden">
      <div class="card no-print" style="margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
          <label style="font-size:12px;font-weight:700;">เลือกเคสที่ต้องการดูสรุป:</label>
          <select id="summary-case-select" onchange="selectSummaryCase(this.value)" style="border:1px solid var(--border);border-radius:10px;padding:7px 10px;font-size:12px;min-width:240px;"></select>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;" id="timeline-filter-pills"></div>
      </div>
      <div class="a4-sheet" id="summary-sheet"></div>
    </section>

    <!-- TAB 3: INTERACTIVE CPR TIMER & QUICK-TAP -->
    <section id="view-timer" class="hidden">
      <div id="timer-2min-alert" class="alert-banner hidden">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:16px;font-weight:800;">2 minutes check rhythm — Time Cycle หยุดรอชั่วคราว</div>
            <div class="mono" style="font-size:12px;opacity:0.95;" id="timer-alert-sub"></div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button type="button" class="btn" style="background:#fff;color:#b91c1c;font-weight:800;" onclick="timerStartCycle()">Start นับต่อ (Cycle ใหม่)</button>
            <button type="button" class="btn" style="background:#991b1b;color:#fff;border-color:#fca5a5;" onclick="dismissTimerAlert()">ปิดแจ้งเตือน</button>
          </div>
        </div>
      </div>

      <div class="two-col" style="margin-bottom:14px;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px;">
            <span style="font-size:14px;font-weight:800;">CPR Timer (โหมดใช้งานออฟไลน์)</span>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn" id="btn-sound-toggle" onclick="toggleTimerSound()">เสียง: เปิด</button>
              <button type="button" class="btn" onclick="speakTwoMin()">ทดสอบเสียง</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div class="mono" id="live-cpr-clock" style="font-size:44px;font-weight:800;color:var(--blue);line-height:1;">0:00</div>
              <div class="mono" id="live-cpr-meta" style="font-size:12px;color:var(--muted);margin-top:6px;">Cycles: 0 · Med: 0 · Defib: 0</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button type="button" class="btn btn-teal" id="btn-main-start-pause" onclick="toggleMainTimer()" style="min-width:116px;justify-content:center;font-weight:800;">Start</button>
              <button type="button" class="btn btn-red" onclick="stopMainTimer()" style="min-width:116px;justify-content:center;font-weight:800;">Stop</button>
            </div>
          </div>

          <div style="margin-top:14px;border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:#f8fafc;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-size:12px;font-weight:700;">Time Cycle (2 นาที)</div>
              <div class="mono" id="live-cycle-status" style="font-size:11px;color:#475569;">เหลือ 2:00</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="mono" id="live-cycle-clock" style="font-size:18px;font-weight:800;color:#0f172a;">2:00</span>
              <button type="button" class="btn btn-amber" id="btn-cycle-pause-start" onclick="toggleCyclePause()" style="min-height:34px;padding:6px 10px;">Pause Cycle</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;">
            <button type="button" class="btn btn-red" style="justify-content:center;font-weight:800;" onclick="logLiveEvent('ADRENALINE','ADRENALINE','Epinephrine (Adrenaline) 1mg/ml IV Push')">Adrenaline</button>
            <button type="button" class="btn btn-primary" style="justify-content:center;font-weight:800;" onclick="logLiveEvent('CYCLE','CYCLE ASSESSMENT','ครบรอบ Cycle')">+1 Cycle</button>
            <button type="button" class="btn btn-teal" style="justify-content:center;font-weight:800;" onclick="markLiveRosc()">ROSC</button>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-size:14px;font-weight:800;">บันทึกผู้ป่วย &amp; Event Timeline</div>
              <div style="font-size:11px;color:#64748b;">บันทึกแล้วสามารถกดดูสรุปและพิมพ์ PDF ได้ทันที</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-teal" onclick="saveLiveCaseToList()">บันทึกเข้า Work list</button>
              <button type="button" class="btn" onclick="resetLiveTimer()">ล้างใหม่</button>
            </div>
          </div>
          <div class="filters-grid" style="margin-bottom:10px;">
            <div class="field"><label>HN</label><input type="text" id="live-hn" placeholder="เช่น 113xxxx" /></div>
            <div class="field"><label>ชื่อผู้ป่วย</label><input type="text" id="live-name" placeholder="ระบุชื่อผู้ป่วย" /></div>
            <div class="field"><label>หน่วยงาน</label><input type="text" id="live-dept" value="ER Resuscitation Room" /></div>
          </div>
          <div id="live-timeline" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:8px;background:#f8fafc;"></div>
        </div>
      </div>

      <div class="two-col">
        <div class="card">
          <div style="font-size:13px;font-weight:800;margin-bottom:8px;">Medicine</div>
          <div class="quick-grid" id="quick-medicine"></div>
          <div style="font-size:13px;font-weight:800;margin:12px 0 8px;">Rhythm &amp; Defibrillator</div>
          <div class="quick-grid" id="quick-rhythm"></div>
        </div>
        <div class="card">
          <div style="font-size:13px;font-weight:800;margin-bottom:8px;">Fluid</div>
          <div class="quick-grid" id="quick-fluid"></div>
          <div style="font-size:13px;font-weight:800;margin:12px 0 8px;">Blood</div>
          <div class="quick-grid" id="quick-blood"></div>
        </div>
      </div>
    </section>
  </main>

  <script>
    const INITIAL_DATA = ${safeJson(payload)};
    const state = {
      cases: Array.isArray(INITIAL_DATA.cases) ? INITIAL_DATA.cases : [],
      activeTab: INITIAL_DATA.initialTab || 'dashboard',
      selectedCaseId: INITIAL_DATA.focusedRecordId || (INITIAL_DATA.cases[0] ? INITIAL_DATA.cases[0].id : null),
      workTab: 'all',
      timelineFilter: 'ALL',
      filters: { search: '', service: 'ALL', outcome: 'ALL', status: 'ALL' },
      timer: {
        running: false,
        durationSeconds: 0,
        cycleElapsed: 0,
        cyclePaused: false,
        soundEnabled: true,
        cycles: 0,
        medicineCount: 0,
        defibCount: 0,
        events: [],
        startTime: new Date().toISOString(),
        endTime: null,
        outcome: 'ONGOING',
        alertVisible: false,
        alertedCycleMark: false,
        intervalId: null,
        repeatVoiceId: null
      }
    };

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function fmtSec(total) {
      var s = Math.max(0, Math.floor(total || 0));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var r = s % 60;
      if (h > 0) return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
      return m + ':' + String(r).padStart(2,'0');
    }

    function fmtHMS(total) {
      var s = Math.max(0, Math.floor(total || 0));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var r = s % 60;
      return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
    }

    function fmtDT(iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
    }

    function fmtTime(iso) {
      if (!iso) return '00:00:00';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '00:00:00';
      return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    }

    function isBloodText(txt) {
      var t = String(txt || '');
      return /\\b(prc|lprc|ffp|cryo|cryoprecipitate|platelet|whole blood|blood)\\b/i.test(t) || t.indexOf('เลือด') !== -1;
    }

    function aggregateMfb(records) {
      var medMap = {};
      var fluidMap = {};
      var bloodMap = {};
      records.forEach(function(rec) {
        (rec.events || []).forEach(function(ev) {
          var label = (ev.detail || '').trim() || 'ไม่ระบุรายการ';
          if (ev.type === 'ADRENALINE' || ev.type === 'MEDICINE') {
            medMap[label] = (medMap[label] || 0) + 1;
          } else if (ev.type === 'BLOOD' || ((ev.type === 'FLUID' || ev.type === 'NOTE') && isBloodText(label))) {
            bloodMap[label] = (bloodMap[label] || 0) + 1;
          } else if (ev.type === 'FLUID') {
            fluidMap[label] = (fluidMap[label] || 0) + 1;
          }
        });
      });
      function toList(map) {
        return Object.keys(map).map(function(k) { return { name: k, count: map[k] }; });
      }
      var meds = toList(medMap);
      var fluids = toList(fluidMap);
      var bloods = toList(bloodMap);
      var fluidMl = 0;
      fluids.forEach(function(f) {
        var m = f.name.match(/(\\d+(?:,\\d+)?)\\s*ml/i);
        if (m) fluidMl += Number(m[1].replace(/,/g, '')) * f.count;
      });
      return {
        meds: meds,
        fluids: fluids,
        bloods: bloods,
        totalMeds: meds.reduce(function(a,b){return a+b.count;}, 0),
        totalFluids: fluids.reduce(function(a,b){return a+b.count;}, 0),
        fluidMl: fluidMl,
        totalBloods: bloods.reduce(function(a,b){return a+b.count;}, 0)
      };
    }

    function renderMfbBox(title, badgeText, colorHex, bgHex, items) {
      var listHtml = items.length === 0
        ? '<div style="font-size:12px;color:#94a3b8;">— ไม่มีรายการ —</div>'
        : items.map(function(it) {
            return '<div class="item-row"><span class="wrap-anywhere" style="min-width:0;">' + esc(it.name) + '</span><span class="mono" style="font-weight:800;flex-shrink:0;">× ' + it.count + '</span></div>';
          }).join('');
      return '<div style="border:1px solid var(--border);background:#f8fafc;border-radius:10px;padding:12px;min-width:0;overflow:hidden;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding-bottom:6px;margin-bottom:8px;border-bottom:1px solid var(--border);">' +
          '<span style="font-size:12px;font-weight:800;color:' + colorHex + ';">' + esc(title) + '</span>' +
          '<span class="mono" style="font-size:11px;font-weight:800;color:' + colorHex + ';background:' + bgHex + ';padding:2px 7px;border-radius:6px;">' + esc(badgeText) + '</span>' +
        '</div>' + listHtml + '</div>';
    }

    function switchTab(tab) {
      state.activeTab = tab;
      ['dashboard','summary','timer'].forEach(function(t) {
        document.getElementById('tab-' + t).classList.toggle('active', t === tab);
        document.getElementById('view-' + t).classList.toggle('hidden', t !== tab);
      });
      if (tab === 'summary') renderSummaryView();
      if (tab === 'dashboard') renderDashboard();
      if (tab === 'timer') renderTimerView();
    }

    function getFilteredCases() {
      var q = state.filters.search.trim().toLowerCase();
      return state.cases.filter(function(c) {
        if (state.filters.service !== 'ALL' && c.serviceGroup !== state.filters.service) return false;
        if (state.filters.status !== 'ALL' && c.status !== state.filters.status) return false;
        if (state.filters.outcome !== 'ALL' && c.outcome !== state.filters.outcome) return false;
        if (q) {
          var teamNames = [];
          Object.keys(c.team || {}).forEach(function(k) { teamNames = teamNames.concat(c.team[k] || []); });
          var hay = [c.id, c.an, c.hn, c.patientName, c.department, c.clinicalNote, c.outcome]
            .concat(c.causes || [], c.initialAssessment || [], teamNames)
            .join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function getWorkRows(base) {
      return base.filter(function(c) {
        if (state.workTab === 'urgent') return c.status === 'ACTIVE_CPR' || c.status === 'POST_ROSC_FOLLOWUP';
        if (state.workTab === 'temp') return c.status === 'PENDING_REVIEW';
        if (state.workTab === 'completed') return c.status === 'COMPLETED';
        return true;
      });
    }

    function applyFilters() {
      state.filters.search = document.getElementById('f-search').value;
      state.filters.service = document.getElementById('f-service').value;
      state.filters.outcome = document.getElementById('f-outcome').value;
      state.filters.status = document.getElementById('f-status').value;
      renderDashboard();
    }

    function resetFilters() {
      state.filters = { search: '', service: 'ALL', outcome: 'ALL', status: 'ALL' };
      state.workTab = 'all';
      document.getElementById('f-search').value = '';
      document.getElementById('f-service').value = 'ALL';
      document.getElementById('f-outcome').value = 'ALL';
      document.getElementById('f-status').value = 'ALL';
      renderDashboard();
    }

    function quickFilterOutcome(outcome) {
      state.filters.outcome = state.filters.outcome === outcome ? 'ALL' : outcome;
      document.getElementById('f-outcome').value = state.filters.outcome;
      renderDashboard();
      document.getElementById('worklist-anchor').scrollIntoView({ behavior: 'smooth' });
    }

    function quickFilterService(sg) {
      state.filters.service = state.filters.service === sg ? 'ALL' : sg;
      document.getElementById('f-service').value = state.filters.service;
      renderDashboard();
    }

    function renderDashboard() {
      var filtered = getFilteredCases();
      var rows = getWorkRows(filtered);
      var activeCount = filtered.filter(function(c){ return c.status === 'ACTIVE_CPR'; }).length;
      var roscCount = filtered.filter(function(c){ return c.outcome === 'ROSC'; }).length;
      var deadCount = filtered.filter(function(c){ return c.outcome === 'DEAD'; }).length;
      var avgDur = filtered.length > 0 ? Math.round(filtered.reduce(function(a,c){return a + (c.durationSeconds||0);}, 0) / filtered.length) : 0;
      var finalized = roscCount + deadCount;
      var roscRate = finalized > 0 ? Math.round((roscCount / finalized) * 100) : 0;
      var deadRate = finalized > 0 ? Math.round((deadCount / finalized) * 100) : 0;

      document.getElementById('kpi-cards').innerHTML = [
        { label: 'เคส CPR ทั้งหมด', val: filtered.length, sub: 'คลิกเพื่อดูทุกเคส', color: '#0f172a', act: "quickFilterOutcome('ALL')", active: state.filters.outcome === 'ALL' },
        { label: 'กำลังทำ CPR (Realtime)', val: activeCount, sub: 'Active CPR', color: '#dc2626', act: "state.workTab='urgent';renderDashboard();", active: state.workTab === 'urgent' },
        { label: 'ROSC (รอดชีวิต)', val: roscCount, sub: 'อัตรา ROSC ' + roscRate + '% · คลิกดูรายชื่อ', color: '#0d9488', act: "quickFilterOutcome('ROSC')", active: state.filters.outcome === 'ROSC' },
        { label: 'DEAD (เสียชีวิต)', val: deadCount, sub: 'อัตรา DEAD ' + deadRate + '% · คลิกดูรายชื่อ', color: '#334155', act: "quickFilterOutcome('DEAD')", active: state.filters.outcome === 'DEAD' },
        { label: 'ระยะเวลาทำ CPR เฉลี่ย', val: fmtSec(avgDur), sub: 'นาที:วินาที ต่อเคส', color: '#2563eb', act: "resetFilters()", active: false }
      ].map(function(k) {
        return '<button type="button" class="card kpi-card ' + (k.active ? 'active-ring' : '') + '" onclick="' + k.act + '">' +
          '<div class="kpi-label">' + esc(k.label) + '</div>' +
          '<div class="kpi-val mono" style="color:' + k.color + ';">' + esc(k.val) + '</div>' +
          '<div class="kpi-sub">' + esc(k.sub) + '</div>' +
        '</button>';
      }).join('');

      var mfb = aggregateMfb(rows);
      document.getElementById('consolidated-totals').textContent = 'ยา ' + mfb.totalMeds + ' · Fluid ' + mfb.totalFluids + (mfb.fluidMl > 0 ? ' (' + mfb.fluidMl.toLocaleString() + ' ml)' : '') + ' · Blood ' + mfb.totalBloods + ' unit';
      document.getElementById('consolidated-mfb').innerHTML =
        renderMfbBox('ยา (Medicine)', 'รวม ' + mfb.totalMeds, '#1e40af', '#dbeafe', mfb.meds) +
        renderMfbBox('สารน้ำ (Fluid)', 'รวม ' + mfb.totalFluids + (mfb.fluidMl > 0 ? ' (' + mfb.fluidMl.toLocaleString() + ' ml)' : ''), '#0f766e', '#ccfbf1', mfb.fluids) +
        renderMfbBox('เลือด (Blood)', 'รวม ' + mfb.totalBloods + ' unit', '#be123c', '#ffe4e6', mfb.bloods);

      var maxDept = Math.max(4, Math.max.apply(null, INITIAL_DATA.serviceGroups.map(function(g) {
        return filtered.filter(function(c){ return c.serviceGroup === g.value; }).length;
      })));
      document.getElementById('dept-chart').innerHTML = INITIAL_DATA.serviceGroups.map(function(g) {
        var items = filtered.filter(function(c){ return c.serviceGroup === g.value; });
        var tot = items.length;
        var rosc = items.filter(function(c){ return c.outcome === 'ROSC'; }).length;
        var h1 = Math.max(4, Math.round((tot / maxDept) * 100));
        var h2 = Math.max(4, Math.round((rosc / maxDept) * 100));
        return '<div class="chart-col" data-sg="' + esc(g.value) + '" onclick="quickFilterService(this.dataset.sg)">' +
          '<div class="bar-pair">' +
            '<div class="bar bar-blue" style="height:' + h1 + 'px;" title="' + g.label + ' ทั้งหมด ' + tot + '"></div>' +
            '<div class="bar bar-teal" style="height:' + h2 + 'px;" title="ROSC ' + rosc + '"></div>' +
          '</div>' +
          '<div style="font-size:11px;font-weight:700;color:' + (state.filters.service === g.value ? '#2563eb' : '#475569') + ';">' + g.label + ' (' + tot + ')</div>' +
        '</div>';
      }).join('');

      var totalCasesDenom = Math.max(1, filtered.length);
      document.getElementById('service-dist').innerHTML = INITIAL_DATA.serviceGroups.map(function(g, idx) {
        var cnt = filtered.filter(function(c){ return c.serviceGroup === g.value; }).length;
        var pct = Math.round((cnt / totalCasesDenom) * 100);
        var color = idx % 2 === 0 ? '#68a8df' : '#56c2a7';
        return '<div class="dist-row">' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">' +
            '<span>' + esc(g.label) + ' — ' + esc(g.description) + '</span>' +
            '<span class="mono">' + cnt + ' เคส · ' + pct + '%</span>' +
          '</div>' +
          '<div class="dist-track"><div class="dist-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
        '</div>';
      }).join('');

      var tabCounts = {
        all: filtered.length,
        urgent: filtered.filter(function(c){ return c.status === 'ACTIVE_CPR' || c.status === 'POST_ROSC_FOLLOWUP'; }).length,
        temp: filtered.filter(function(c){ return c.status === 'PENDING_REVIEW'; }).length,
        completed: filtered.filter(function(c){ return c.status === 'COMPLETED'; }).length
      };
      var tabsMeta = [
        { k:'all', l:'ทั้งหมด' },
        { k:'urgent', l:'กำลัง CPR / Post-ROSC' },
        { k:'temp', l:'Temp (รอสรุป)' },
        { k:'completed', l:'เสร็จสมบูรณ์' }
      ];
      document.getElementById('work-tabs').innerHTML = tabsMeta.map(function(t) {
        return '<button type="button" class="pill-btn ' + (state.workTab === t.k ? 'active' : '') + '" data-tab="' + t.k + '" onclick="state.workTab=this.dataset.tab;renderDashboard();">' + esc(t.l) + ' (' + tabCounts[t.k] + ')</button>';
      }).join('');

      document.getElementById('worklist-subtitle').textContent = 'แสดง ' + rows.length + ' เคส (คลิกแถวเพื่อเปิดหน้าสรุป A4)';

      document.getElementById('worklist-tbody').innerHTML = rows.length === 0
        ? '<tr><td colspan="9" style="text-align:center;padding:28px;color:#94a3b8;">ไม่พบข้อมูลตามตัวกรอง</td></tr>'
        : rows.map(function(c) {
            var badgeCls = c.outcome === 'ROSC' ? 'badge-rosc' : c.outcome === 'DEAD' ? 'badge-dead' : c.outcome === 'REFER' ? 'badge-refer' : 'badge-ongoing';
            var teamEntries = INITIAL_DATA.teamRoles.map(function(r) {
              var mem = (c.team && c.team[r.key]) || [];
              return mem.length > 0 ? r.shortLabel + ': ' + mem.join(', ') : '';
            }).filter(Boolean);
            var teamHtml = teamEntries.length === 0 ? '<span style="color:#94a3b8;">—</span>' : teamEntries.map(function(t){ return '<div class="wrap-anywhere">' + esc(t) + '</div>'; }).join('');
            return '<tr class="clickable" data-id="' + esc(c.id) + '" onclick="openCaseSummary(this.dataset.id)">' +
              '<td class="mono"><div style="font-weight:800;">#' + esc(c.id) + '</div><div style="font-size:11px;color:#64748b;">HN ' + esc(c.hn || '—') + '</div><div style="font-size:11px;color:#94a3b8;">AN ' + esc(c.an || '—') + '</div></td>' +
              '<td><div style="font-weight:700;" class="wrap-anywhere">' + esc(c.patientName || 'ไม่ระบุชื่อ') + '</div></td>' +
              '<td><div style="font-weight:700;">' + esc(c.serviceGroup) + '</div><div style="font-size:11px;color:#64748b;">' + esc(c.department) + '</div></td>' +
              '<td class="mono"><div style="font-weight:800;color:#2563eb;">' + fmtHMS(c.durationSeconds) + '</div><div style="font-size:11px;color:#64748b;">' + esc(fmtDT(c.startTime)) + '</div></td>' +
              '<td><span class="badge ' + badgeCls + '">' + esc(c.outcome) + '</span></td>' +
              '<td class="mono"><div>C:' + (c.cycles||0) + ' · M:' + (c.medicineCount||0) + ' · D:' + (c.defibCount||0) + '</div></td>' +
              '<td style="font-size:11px;max-width:220px;">' + teamHtml + '</td>' +
              '<td style="font-size:11px;max-width:220px;" class="wrap-anywhere">' + esc(c.clinicalNote || (c.causes||[]).join(', ') || '—') + '</td>' +
              '<td class="no-print"><button type="button" class="btn btn-teal" style="min-height:32px;padding:4px 10px;" data-id="' + esc(c.id) + '" onclick="event.stopPropagation();openCaseSummary(this.dataset.id)">ดูสรุป</button></td>' +
            '</tr>';
          }).join('');
    }

    function openCaseSummary(id) {
      state.selectedCaseId = id;
      state.timelineFilter = 'ALL';
      switchTab('summary');
    }

    function selectSummaryCase(id) {
      state.selectedCaseId = id;
      state.timelineFilter = 'ALL';
      renderSummaryView();
    }

    function renderSummaryView() {
      var sel = document.getElementById('summary-case-select');
      sel.innerHTML = state.cases.map(function(c) {
        return '<option value="' + esc(c.id) + '" ' + (c.id === state.selectedCaseId ? 'selected' : '') + '>#' + esc(c.id) + ' · ' + esc(c.patientName || 'ไม่ระบุชื่อ') + ' (' + esc(c.outcome) + ')</option>';
      }).join('');

      var rec = state.cases.find(function(c){ return c.id === state.selectedCaseId; }) || state.cases[0];
      if (!rec) {
        document.getElementById('summary-sheet').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">ไม่มีข้อมูลเคส</div>';
        return;
      }

      var tlTabs = [
        { k:'ALL', l:'ทุกเหตุการณ์' },
        { k:'MED', l:'ยา (Medicine)' },
        { k:'FLUID', l:'Fluid' },
        { k:'BLOOD', l:'Blood' },
        { k:'RHYTHM', l:'Rhythm / Cycle' },
        { k:'DEFIB', l:'Defib / ETT / Proc' }
      ];
      document.getElementById('timeline-filter-pills').innerHTML = tlTabs.map(function(t) {
        return '<button type="button" class="pill-btn ' + (state.timelineFilter === t.k ? 'active' : '') + '" data-tl="' + t.k + '" onclick="state.timelineFilter=this.dataset.tl;renderSummaryView();">' + esc(t.l) + '</button>';
      }).join('');

      var mfb = aggregateMfb([rec]);
      var events = (rec.events || []).slice().sort(function(a,b){ return a.elapsedSeconds - b.elapsedSeconds; });
      var filteredEvents = events.filter(function(ev) {
        if (state.timelineFilter === 'ALL') return true;
        if (state.timelineFilter === 'MED') return ev.type === 'MEDICINE' || ev.type === 'ADRENALINE';
        if (state.timelineFilter === 'FLUID') return ev.type === 'FLUID' && !isBloodText(ev.detail);
        if (state.timelineFilter === 'BLOOD') return ev.type === 'BLOOD' || isBloodText(ev.detail);
        if (state.timelineFilter === 'RHYTHM') return ev.type === 'RHYTHM' || ev.type === 'CYCLE';
        if (state.timelineFilter === 'DEFIB') return ev.type === 'DEFIB' || ev.type === 'ETT' || ev.type === 'PROCEDURE';
        return true;
      });

      var statusInfo = INITIAL_DATA.statusMeta[rec.status] || { label: rec.status };
      var teamHtml = INITIAL_DATA.teamRoles.map(function(r) {
        var mem = (rec.team && rec.team[r.key]) || [];
        return '<div class="item-row"><span style="font-weight:700;color:#334155;flex-shrink:0;">' + esc(r.label) + ':</span><span class="wrap-anywhere" style="text-align:right;min-width:0;">' + esc(mem.length ? mem.join(', ') : '—') + '</span></div>';
      }).join('');

      document.getElementById('summary-sheet').innerHTML =
        '<div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;">' +
          '<div>' +
            '<div style="font-size:11px;font-weight:800;color:#0f766e;text-transform:uppercase;">Clinical Resuscitation Summary</div>' +
            '<h1 style="margin:2px 0 0;font-size:20px;font-weight:800;">แบบบันทึกการช่วยฟื้นคืนชีพ (CPR Record)</h1>' +
          '</div>' +
          '<div class="mono" style="font-size:12px;text-align:right;">' +
            '<div style="font-weight:800;">CPR Record ID: #' + esc(rec.id) + '</div>' +
            '<div>สถานะ: ' + esc(statusInfo.label) + '</div>' +
            '<div style="color:#64748b;">อัปเดต: ' + esc(fmtDT(rec.updatedAt)) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="section-box">' +
          '<h2 class="section-title">1. ข้อมูลผู้ป่วยและหน่วยงาน (Patient Information)</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:12px;">' +
            '<div><div style="font-size:11px;color:#64748b;">ชื่อ-สกุลผู้ป่วย</div><div style="font-weight:800;" class="wrap-anywhere">' + esc(rec.patientName || 'ไม่ระบุชื่อ') + '</div></div>' +
            '<div><div style="font-size:11px;color:#64748b;">HN / AN</div><div class="mono" style="font-weight:700;">HN ' + esc(rec.hn||'—') + ' · AN ' + esc(rec.an||'—') + '</div></div>' +
            '<div><div style="font-size:11px;color:#64748b;">กลุ่มบริการ / หน่วยงาน</div><div style="font-weight:700;" class="wrap-anywhere">' + esc(rec.serviceGroup) + ' · ' + esc(rec.department) + '</div></div>' +
            '<div><div style="font-size:11px;color:#64748b;">ผลลัพธ์ (Outcome)</div><div class="mono" style="font-weight:800;font-size:14px;">' + esc(rec.outcome) + '</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="section-box">' +
          '<h2 class="section-title">2. สรุปเวลาและหัตถการหลัก (Resuscitation Summary)</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:12px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;">' +
            '<div><div style="font-size:11px;color:#64748b;">Start Time</div><div class="mono" style="font-weight:700;">' + esc(fmtDT(rec.startTime)) + '</div></div>' +
            '<div><div style="font-size:11px;color:#64748b;">End Time</div><div class="mono" style="font-weight:700;">' + esc(rec.endTime ? fmtDT(rec.endTime) : 'กำลังดำเนินการ') + '</div></div>' +
            '<div><div style="font-size:11px;color:#64748b;">Total Duration</div><div class="mono" style="font-weight:800;color:#1d4ed8;font-size:14px;">' + fmtHMS(rec.durationSeconds) + '</div></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:10px;text-align:center;">' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;"><div style="font-size:11px;color:#64748b;">Cycles</div><div class="mono" style="font-size:18px;font-weight:800;">' + (rec.cycles||0) + '</div></div>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;"><div style="font-size:11px;color:#64748b;">Medicines</div><div class="mono" style="font-size:18px;font-weight:800;">' + (rec.medicineCount||0) + '</div></div>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;"><div style="font-size:11px;color:#64748b;">Defib</div><div class="mono" style="font-size:18px;font-weight:800;">' + (rec.defibCount||0) + '</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="section-box">' +
          '<h2 class="section-title">3. สรุปรายการยา สารน้ำ และเลือด (Medication, Fluid &amp; Blood Summary)</h2>' +
          '<div class="three-col">' +
            renderMfbBox('ยา (Medicine)', 'รวม ' + mfb.totalMeds, '#1e40af', '#dbeafe', mfb.meds) +
            renderMfbBox('สารน้ำ (Fluid)', 'รวม ' + mfb.totalFluids + (mfb.fluidMl > 0 ? ' (' + mfb.fluidMl.toLocaleString() + ' ml)' : ''), '#0f766e', '#ccfbf1', mfb.fluids) +
            renderMfbBox('เลือด (Blood)', 'รวม ' + mfb.totalBloods + ' unit', '#be123c', '#ffe4e6', mfb.bloods) +
          '</div>' +
        '</div>' +

        '<div class="two-col" style="margin-bottom:14px;">' +
          '<div class="section-box" style="margin-bottom:0;">' +
            '<h2 class="section-title">4. Initial Assessment</h2>' +
            ((rec.initialAssessment && rec.initialAssessment.length) ? rec.initialAssessment.map(function(i){ return '<div style="font-size:12px;" class="wrap-anywhere">✓ ' + esc(i) + '</div>'; }).join('') : '<div style="font-size:12px;color:#94a3b8;">ไม่ได้ระบุ</div>') +
          '</div>' +
          '<div class="section-box" style="margin-bottom:0;">' +
            '<h2 class="section-title">5. Causes of Cardiac Arrest</h2>' +
            ((rec.causes && rec.causes.length) ? rec.causes.map(function(c){ return '<div style="font-size:12px;" class="wrap-anywhere">✓ ' + esc(c) + '</div>'; }).join('') : '<div style="font-size:12px;color:#94a3b8;">ไม่ได้ระบุ</div>') +
          '</div>' +
        '</div>' +

        '<div class="section-box">' +
          '<h2 class="section-title">6. บันทึกเหตุการณ์ตามลำดับเวลา (' + filteredEvents.length + ' รายการ)</h2>' +
          (filteredEvents.length === 0
            ? '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:12px;">ไม่มีรายการในหมวดนี้</div>'
            : '<table style="width:100%;table-layout:fixed;"><thead><tr><th style="width:70px;">เวลา CPR</th><th style="width:82px;">นาฬิกา</th><th style="width:120px;">ประเภท</th><th>รายละเอียด</th></tr></thead><tbody>' +
              filteredEvents.map(function(ev) {
                return '<tr><td class="mono" style="font-weight:700;">' + fmtSec(ev.elapsedSeconds) + '</td><td class="mono" style="color:#64748b;">' + fmtTime(ev.timestamp) + '</td><td class="wrap-anywhere" style="font-weight:700;">' + esc(ev.title) + '</td><td class="wrap-anywhere">' + esc(ev.detail) + '</td></tr>';
              }).join('') + '</tbody></table>') +
        '</div>' +

        '<div class="two-col">' +
          '<div class="section-box" style="margin-bottom:0;"><h2 class="section-title">7. ทีมช่วยฟื้นคืนชีพ (CPR Team)</h2>' + teamHtml + '</div>' +
          '<div class="section-box" style="margin-bottom:0;"><h2 class="section-title">8. หมายเหตุทางคลินิก (Clinical Note)</h2><div class="wrap-anywhere" style="font-size:12px;white-space:pre-wrap;">' + esc(rec.clinicalNote || '—') + '</div></div>' +
        '</div>';
    }

    function exportFilteredCsv() {
      var rows = getWorkRows(getFilteredCases());
      var headers = ['ID','AN','HN','Patient Name','Service Group','Department','Start','End','Duration','Status','Outcome','Cycle','Medication','Defib','Clinical Note'];
      function eCsv(v) {
        var s = String(v == null ? '' : v);
        return /[",\\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
      }
      var lines = [headers].concat(rows.map(function(c) {
        return [c.id, c.an, c.hn, c.patientName, c.serviceGroup, c.department, fmtDT(c.startTime), fmtDT(c.endTime), fmtHMS(c.durationSeconds), c.status, c.outcome, c.cycles, c.medicineCount, c.defibCount, c.clinicalNote];
      }));
      var csv = '\\uFEFF' + lines.map(function(r){ return r.map(eCsv).join(','); }).join('\\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'cpr-worklist-export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // ---- Interactive CPR Timer & 2-Min Voice Alert ----
    function speakTwoMin() {
      if (!state.timer.soundEnabled) return;
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance('2 minutes check rhythm');
          u.lang = 'en-US'; u.rate = 0.96;
          window.speechSynthesis.speak(u);
        }
      } catch (e) {}
    }

    function stopRepeatVoice() {
      if (state.timer.repeatVoiceId) { clearInterval(state.timer.repeatVoiceId); state.timer.repeatVoiceId = null; }
      try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
    }

    function toggleTimerSound() {
      state.timer.soundEnabled = !state.timer.soundEnabled;
      if (!state.timer.soundEnabled) stopRepeatVoice();
      renderTimerView();
    }

    function ensureTimerTick() {
      if (state.timer.intervalId) return;
      state.timer.intervalId = setInterval(function() {
        if (!state.timer.running) return;
        state.timer.durationSeconds += 1;
        if (!state.timer.cyclePaused) {
          if (state.timer.cycleElapsed < 120) {
            state.timer.cycleElapsed += 1;
          }
          if (state.timer.cycleElapsed >= 120 && !state.timer.alertedCycleMark) {
            state.timer.alertedCycleMark = true;
            state.timer.cyclePaused = true;
            state.timer.alertVisible = true;
            speakTwoMin();
            if (!state.timer.repeatVoiceId) {
              state.timer.repeatVoiceId = setInterval(function() {
                if (state.timer.alertVisible && state.timer.running) speakTwoMin();
              }, 15000);
            }
          }
        }
        renderTimerView();
      }, 1000);
    }

    function toggleMainTimer() {
      if (!state.timer.running) {
        if (state.timer.events.length === 0 && state.timer.durationSeconds === 0) {
          state.timer.startTime = new Date().toISOString();
          state.timer.events.unshift({ id: 'ev-' + Date.now(), elapsedSeconds: 0, timestamp: state.timer.startTime, type: 'START', title: 'START CPR', detail: 'เริ่มจับเวลา CPR' });
        }
        if (state.timer.cycleElapsed >= 120) {
          timerStartCycle();
          return;
        }
        state.timer.running = true;
        state.timer.endTime = null;
        ensureTimerTick();
      } else {
        state.timer.running = false;
        stopRepeatVoice();
      }
      renderTimerView();
    }

    function stopMainTimer() {
      state.timer.running = false;
      state.timer.endTime = new Date().toISOString();
      stopRepeatVoice();
      state.timer.events.unshift({ id: 'ev-' + Date.now(), elapsedSeconds: state.timer.durationSeconds, timestamp: state.timer.endTime, type: 'STOP', title: 'STOP CPR', detail: 'หยุดจับเวลา CPR ที่ ' + fmtSec(state.timer.durationSeconds) });
      renderTimerView();
    }

    function toggleCyclePause() {
      if (state.timer.cycleElapsed >= 120 || !state.timer.running || state.timer.cyclePaused) {
        timerStartCycle();
      } else {
        state.timer.cyclePaused = true;
        stopRepeatVoice();
        renderTimerView();
      }
    }

    function timerStartCycle() {
      stopRepeatVoice();
      var completed = state.timer.cycleElapsed >= 120;
      if (completed) {
        state.timer.cycles += 1;
        state.timer.cycleElapsed = 0;
        state.timer.alertedCycleMark = false;
        state.timer.alertVisible = false;
        state.timer.events.unshift({ id: 'ev-' + Date.now(), elapsedSeconds: state.timer.durationSeconds, timestamp: new Date().toISOString(), type: 'CYCLE', title: 'CYCLE ASSESSMENT', detail: 'ครบรอบ Cycle #' + state.timer.cycles + ' · เริ่มรอบ 2 นาทีใหม่' });
      }
      state.timer.cyclePaused = false;
      if (!state.timer.running) {
        state.timer.running = true;
        ensureTimerTick();
      }
      renderTimerView();
    }

    function dismissTimerAlert() {
      state.timer.alertVisible = false;
      stopRepeatVoice();
      renderTimerView();
    }

    function logLiveEvent(type, title, detail) {
      var nowIso = new Date().toISOString();
      if (type === 'ADRENALINE' || type === 'MEDICINE') state.timer.medicineCount += 1;
      if (type === 'DEFIB') state.timer.defibCount += 1;
      if (type === 'CYCLE' || type === 'RHYTHM') {
        if (type === 'CYCLE' || state.timer.cycleElapsed >= 120) state.timer.cycles += 1;
        state.timer.cycleElapsed = 0;
        state.timer.cyclePaused = false;
        state.timer.alertedCycleMark = false;
        state.timer.alertVisible = false;
        stopRepeatVoice();
      }
      state.timer.events.unshift({ id: 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2,5), elapsedSeconds: state.timer.durationSeconds, timestamp: nowIso, type: type, title: title, detail: detail });
      renderTimerView();
    }

    function markLiveRosc() {
      state.timer.running = false;
      state.timer.outcome = 'ROSC';
      state.timer.endTime = new Date().toISOString();
      stopRepeatVoice();
      state.timer.events.unshift({ id: 'ev-' + Date.now(), elapsedSeconds: state.timer.durationSeconds, timestamp: state.timer.endTime, type: 'ROSC', title: 'ROSC ACHIEVED', detail: 'กลับมามีชีพจร (ROSC) ที่เวลา ' + fmtSec(state.timer.durationSeconds) });
      renderTimerView();
    }

    function resetLiveTimer() {
      stopRepeatVoice();
      if (state.timer.intervalId) { clearInterval(state.timer.intervalId); state.timer.intervalId = null; }
      state.timer = {
        running: false, durationSeconds: 0, cycleElapsed: 0, cyclePaused: false,
        soundEnabled: state.timer.soundEnabled, cycles: 0, medicineCount: 0, defibCount: 0,
        events: [], startTime: new Date().toISOString(), endTime: null, outcome: 'ONGOING',
        alertVisible: false, alertedCycleMark: false, intervalId: null, repeatVoiceId: null
      };
      renderTimerView();
    }

    function saveLiveCaseToList() {
      var newRec = {
        id: 'HTML-' + String(Date.now()).slice(-4),
        clientId: 'html-' + Date.now(),
        hn: document.getElementById('live-hn').value.trim() || '1139999',
        an: 'O' + String(Date.now()).slice(-6),
        patientName: document.getElementById('live-name').value.trim() || 'ผู้ป่วยบันทึกจาก HTML',
        department: document.getElementById('live-dept').value.trim() || 'ER Resuscitation Room',
        serviceGroup: 'ER',
        startTime: state.timer.startTime,
        endTime: state.timer.endTime,
        durationSeconds: state.timer.durationSeconds,
        isRunning: state.timer.running,
        status: state.timer.outcome === 'ROSC' ? 'POST_ROSC_FOLLOWUP' : 'COMPLETED',
        outcome: state.timer.outcome,
        cycles: state.timer.cycles,
        medicineCount: state.timer.medicineCount,
        defibCount: state.timer.defibCount,
        events: state.timer.events.slice(),
        initialAssessment: [],
        causes: [],
        clinicalNote: 'บันทึกจากโหมด Interactive HTML',
        team: { leader: [], airway: [], compressor: [], medication: [], monitor: [], recorder: [] },
        dueAt: null, lastCycleAtSec: 0, lastAdrenalineAtSec: null,
        updatedAt: new Date().toISOString(), syncState: 'synced'
      };
      state.cases.unshift(newRec);
      openCaseSummary(newRec.id);
    }

    function renderTimerView() {
      document.getElementById('live-cpr-clock').textContent = fmtSec(state.timer.durationSeconds);
      document.getElementById('live-cpr-meta').textContent = 'Cycles: ' + state.timer.cycles + ' · Med: ' + state.timer.medicineCount + ' · Defib: ' + state.timer.defibCount;
      document.getElementById('btn-main-start-pause').textContent = state.timer.running ? 'Pause' : 'Start';
      document.getElementById('btn-main-start-pause').className = 'btn ' + (state.timer.running ? 'btn-amber' : 'btn-teal');
      document.getElementById('btn-sound-toggle').textContent = state.timer.soundEnabled ? 'เสียง: เปิด' : 'เสียง: ปิด';

      var rem = Math.max(0, 120 - state.timer.cycleElapsed);
      document.getElementById('live-cycle-clock').textContent = fmtSec(rem);
      document.getElementById('live-cycle-status').textContent = state.timer.cycleElapsed >= 120
        ? 'Paused · Check Rhythm (ครบ 2 นาที)'
        : (state.timer.cyclePaused || !state.timer.running)
          ? 'Paused · เดินไป ' + fmtSec(state.timer.cycleElapsed)
          : 'กำลังนับ · ' + fmtSec(state.timer.cycleElapsed) + ' / 2:00';
      document.getElementById('btn-cycle-pause-start').textContent = (state.timer.running && !state.timer.cyclePaused) ? 'Pause Cycle' : (state.timer.cycleElapsed >= 120 ? 'Start รอบใหม่' : 'Start นับต่อ');
      document.getElementById('btn-cycle-pause-start').className = 'btn ' + ((state.timer.running && !state.timer.cyclePaused) ? 'btn-amber' : 'btn-teal');

      var alertEl = document.getElementById('timer-2min-alert');
      alertEl.classList.toggle('hidden', !state.timer.alertVisible);
      document.getElementById('timer-alert-sub').textContent = 'เวลา CPR รวม ' + fmtSec(state.timer.durationSeconds) + ' · กด Start เพื่อเริ่ม Cycle #' + (state.timer.cycles + 1);

      document.getElementById('live-timeline').innerHTML = state.timer.events.length === 0
        ? '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:12px;">ยังไม่มีเหตุการณ์ — กด Start หรือแตะปุ่มด้านล่าง</div>'
        : state.timer.events.map(function(ev) {
            return '<div class="item-row"><span class="mono" style="font-weight:700;color:#475569;">' + fmtSec(ev.elapsedSeconds) + '</span><span style="font-weight:700;">' + esc(ev.title) + '</span><span class="wrap-anywhere" style="flex:1;color:#334155;">' + esc(ev.detail) + '</span></div>';
          }).join('');
    }

    function logQuickBtn(el) {
      logLiveEvent(el.dataset.type, el.dataset.title, el.dataset.detail);
    }

    function initQuickButtons() {
      document.getElementById('quick-medicine').innerHTML = INITIAL_DATA.medicineOptions.map(function(m) {
        return '<button type="button" class="quick-btn" data-type="MEDICINE" data-title="MEDICINE" data-detail="' + esc(m) + '" onclick="logQuickBtn(this)">' + esc(m) + '</button>';
      }).join('');
      document.getElementById('quick-rhythm').innerHTML = INITIAL_DATA.rhythmOptions.map(function(r) {
        return '<button type="button" class="quick-btn" data-type="RHYTHM" data-title="RHYTHM" data-detail="Rhythm: ' + esc(r) + '" onclick="logQuickBtn(this)">' + esc(r) + '</button>';
      }).concat(['150','200','400'].map(function(j) {
        return '<button type="button" class="quick-btn" style="color:#b91c1c;" data-type="DEFIB" data-title="DEFIBRILLATOR" data-detail="Defibrillation ' + j + ' Joules" onclick="logQuickBtn(this)">Defib ' + j + ' J</button>';
      })).join('');
      document.getElementById('quick-fluid').innerHTML = INITIAL_DATA.fluidOptions.map(function(f) {
        return '<button type="button" class="quick-btn" data-type="FLUID" data-title="IV FLUID" data-detail="' + esc(f) + '" onclick="logQuickBtn(this)">' + esc(f) + '</button>';
      }).join('');
      document.getElementById('quick-blood').innerHTML = INITIAL_DATA.bloodOptions.map(function(b) {
        return '<button type="button" class="quick-btn" style="color:#be123c;" data-type="BLOOD" data-title="BLOOD" data-detail="' + esc(b) + '" onclick="logQuickBtn(this)">' + esc(b) + '</button>';
      }).join('');
    }

    initQuickButtons();
    switchTab(state.activeTab);
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename ||
    (focusedRecordId
      ? `cpr-summary-${focusedRecordId}-interactive.html`
      : `cpr-worklist-interactive-${new Date().toISOString().slice(0, 10)}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
