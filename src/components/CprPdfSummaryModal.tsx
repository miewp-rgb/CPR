import React from 'react';
import { ArrowLeft, CheckCircle2, Cloud, CloudOff, Edit3, FileCode2, Printer, X } from 'lucide-react';
import type { CprRecord } from '../types/cpr';
import { TEAM_ROLES, WORKFLOW_STATUS_META } from '../data/cprConstants';
import {
  formatDurationHMS,
  formatShortDateTime,
  formatTimeOnly,
  formatTimerSeconds,
} from '../lib/formatters';
import { exportInteractiveHtml } from '../lib/exportInteractiveHtml';

interface CprPdfSummaryModalProps {
  record: CprRecord;
  allCases?: CprRecord[];
  isOnline: boolean;
  onCloseEdit: () => void;
  onGoToDashboard: () => void;
}

interface AggregatedItem {
  name: string;
  count: number;
}

function aggregateByDetail(details: string[]): AggregatedItem[] {
  const counts = new Map<string, number>();
  for (const raw of details) {
    const label = raw.trim() || 'ไม่ระบุรายการ';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

function isBloodText(text: string): boolean {
  return /\b(prc|lprc|ffp|cryo|cryoprecipitate|platelet|whole blood|blood)\b/i.test(text) || text.includes('เลือด');
}

function parseTotalFluidMl(items: AggregatedItem[]): number {
  let totalMl = 0;
  for (const item of items) {
    const match = item.name.match(/(\d+(?:,\d+)?)\s*ml/i);
    if (match) {
      const vol = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(vol)) {
        totalMl += vol * item.count;
      }
    }
  }
  return totalMl;
}

export const CprPdfSummaryModal: React.FC<CprPdfSummaryModalProps> = ({
  record,
  allCases,
  isOnline,
  onCloseEdit,
  onGoToDashboard,
}) => {
  const statusMeta = WORKFLOW_STATUS_META[record.status];
  const chronologicalEvents = [...record.events].sort(
    (a, b) => a.elapsedSeconds - b.elapsedSeconds
  );

  const medicineItems = aggregateByDetail(
    chronologicalEvents
      .filter((ev) => ev.type === 'ADRENALINE' || ev.type === 'MEDICINE')
      .map((ev) => ev.detail)
  );
  const bloodItems = aggregateByDetail(
    chronologicalEvents
      .filter(
        (ev) =>
          ev.type === 'BLOOD' ||
          ((ev.type === 'FLUID' || ev.type === 'NOTE') && isBloodText(ev.detail))
      )
      .map((ev) => ev.detail)
  );
  const fluidItems = aggregateByDetail(
    chronologicalEvents
      .filter((ev) => ev.type === 'FLUID' && !isBloodText(ev.detail))
      .map((ev) => ev.detail)
  );

  const totalMedicineCount = medicineItems.reduce((sum, i) => sum + i.count, 0);
  const totalFluidCount = fluidItems.reduce((sum, i) => sum + i.count, 0);
  const totalFluidMl = parseTotalFluidMl(fluidItems);
  const totalBloodCount = bloodItems.reduce((sum, i) => sum + i.count, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:overflow-visible"
      role="dialog"
      aria-label="สรุป CPR Record รูปแบบ PDF"
    >
      {/* Top PDF Viewer Toolbar — hidden when printing */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">
              สรุป CPR Record #{record.id} (รูปแบบ PDF / A4)
            </div>
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
              {isOnline && record.syncState !== 'pending' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-teal-400" />
                  <span>บันทึกและซิงค์ข้อมูลขึ้นเซิร์ฟเวอร์เรียบร้อย</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>บันทึกออฟไลน์ลงเครื่องเรียบร้อย (รอซิงค์อัตโนมัติ)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCloseEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 px-3.5 py-2 text-xs font-semibold min-h-[40px] transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>กลับไปแก้ไข</span>
          </button>

          <button
            type="button"
            onClick={onGoToDashboard}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 px-3.5 py-2 text-xs font-semibold min-h-[40px] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Work list CPR</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportInteractiveHtml({
                cases: allCases && allCases.length > 0 ? allCases : [record],
                focusedRecordId: record.id,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm min-h-[40px] transition"
          >
            <FileCode2 className="w-4 h-4" />
            <span>Export HTML</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 text-xs font-bold shadow-sm min-h-[40px] transition"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ / บันทึกเป็น PDF</span>
          </button>

          <button
            type="button"
            onClick={onCloseEdit}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="ปิดหน้าต่าง PDF"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* A4 PDF Sheet Container */}
      <div className="py-6 px-3 sm:px-6 print:p-0">
        <article className="mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-200 p-6 sm:p-[14mm] print:shadow-none print:border-0 print:p-0 space-y-5">
          {/* Document Header */}
          <header className="border-b-2 border-slate-900 pb-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-wider text-teal-700 uppercase">
                Clinical Resuscitation Summary
              </div>
              <h1 className="mt-0.5 text-lg sm:text-xl font-bold text-slate-900">
                แบบบันทึกการช่วยฟื้นคืนชีพ (CPR Record)
              </h1>
              <p className="text-xs text-slate-500">
                เอกสารสรุปการปฏิบัติการช่วยฟื้นคืนชีพและเหตุการณ์ทางคลินิก
              </p>
            </div>

            <div className="text-left sm:text-right text-xs font-mono-tabular space-y-0.5 shrink-0">
              <div className="font-bold text-slate-900">CPR Record ID: #{record.id}</div>
              <div className="text-slate-600">
                สถานะ: <span className="font-sans font-semibold">{statusMeta.label}</span>
              </div>
              <div className="text-slate-500">
                อัปเดตล่าสุด: {formatShortDateTime(record.updatedAt)}
              </div>
            </div>
          </header>

          {/* Section 1: Patient Info */}
          <section className="rounded-lg border border-slate-300 p-3.5">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">
              1. ข้อมูลผู้ป่วยและหน่วยงาน (Patient Information)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="col-span-2 min-w-0">
                <div className="text-[11px] text-slate-500">ชื่อ-สกุลผู้ป่วย (Patient Name)</div>
                <div className="mt-0.5 font-bold text-slate-900 text-sm [overflow-wrap:anywhere]">
                  {record.patientName || 'ผู้ป่วยไม่ระบุชื่อ'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">HN</div>
                <div className="mt-0.5 font-mono-tabular font-bold text-slate-900 [overflow-wrap:anywhere]">
                  {record.hn || '—'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">AN</div>
                <div className="mt-0.5 font-mono-tabular font-bold text-slate-900 [overflow-wrap:anywhere]">
                  {record.an || '—'}
                </div>
              </div>
              <div className="col-span-2 min-w-0">
                <div className="text-[11px] text-slate-500">กลุ่มบริการ / หน่วยงาน</div>
                <div className="mt-0.5 font-semibold text-slate-800 [overflow-wrap:anywhere]">
                  {record.serviceGroup} · {record.department}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">ผลลัพธ์ (Outcome)</div>
                <div
                  className={`mt-0.5 font-mono-tabular font-bold text-sm ${
                    record.outcome === 'ROSC'
                      ? 'text-teal-700'
                      : record.outcome === 'DEAD'
                        ? 'text-red-700'
                        : 'text-slate-900'
                  }`}
                >
                  {record.outcome}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">สถานะการซิงค์</div>
                <div className="mt-0.5 font-semibold text-slate-700">
                  {record.syncState === 'pending' ? 'บันทึกออฟไลน์ (รอซิงค์)' : 'ซิงค์แล้ว'}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Resuscitation Timing & Summary */}
          <section className="rounded-lg border border-slate-300 p-3.5">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">
              2. สรุปเวลาและหัตถการหลัก (Resuscitation Summary)
            </h2>
            <div className="grid grid-cols-3 gap-3 text-xs pb-3 border-b border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500">เวลาเริ่ม (Start Time)</div>
                <div className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                  {formatShortDateTime(record.startTime)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">เวลาสิ้นสุด (End Time)</div>
                <div className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                  {record.endTime ? formatShortDateTime(record.endTime) : 'กำลังดำเนินการ'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">ระยะเวลารวม (Total Duration)</div>
                <div className="mt-0.5 font-mono-tabular font-bold text-blue-700 text-sm">
                  {formatDurationHMS(record.durationSeconds)}
                </div>
              </div>
            </div>

            <div className="pt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-slate-50 border border-slate-200 py-2 px-3">
                <div className="text-[11px] text-slate-500">จำนวนรอบ (Cycles)</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900">
                  {record.cycles}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-200 py-2 px-3">
                <div className="text-[11px] text-slate-500">การให้ยา (Medicines)</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900">
                  {record.medicineCount}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-200 py-2 px-3">
                <div className="text-[11px] text-slate-500">การช็อกไฟฟ้า (Defib)</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900">
                  {record.defibCount}
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Medication, Fluid & Blood Summary */}
          <section className="rounded-lg border border-slate-300 p-3.5 min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                3. สรุปรายการยา สารน้ำ และเลือด (Medication, Fluid &amp; Blood Summary)
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-600">
                ยา {totalMedicineCount} · Fluid {totalFluidCount} · Blood {totalBloodCount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* ยา (Medication) */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-blue-800">ยา (Medicine)</span>
                  <span className="text-[11px] font-mono-tabular font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                    รวม {totalMedicineCount}
                  </span>
                </div>
                {medicineItems.length === 0 ? (
                  <div className="text-xs text-slate-400">— ไม่มีรายการ —</div>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {medicineItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-start justify-between gap-2 min-w-0"
                      >
                        <span className="text-slate-800 min-w-0 [overflow-wrap:anywhere]">
                          {item.name}
                        </span>
                        <span className="font-mono-tabular font-bold text-slate-900 shrink-0">
                          × {item.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* สารน้ำ (Fluid) */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-teal-800">สารน้ำ (Fluid)</span>
                  <span className="text-[11px] font-mono-tabular font-bold text-teal-700 bg-teal-100/80 px-1.5 py-0.5 rounded">
                    รวม {totalFluidCount}
                    {totalFluidMl > 0 ? ` (${totalFluidMl.toLocaleString()} ml)` : ''}
                  </span>
                </div>
                {fluidItems.length === 0 ? (
                  <div className="text-xs text-slate-400">— ไม่มีรายการ —</div>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {fluidItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-start justify-between gap-2 min-w-0"
                      >
                        <span className="text-slate-800 min-w-0 [overflow-wrap:anywhere]">
                          {item.name}
                        </span>
                        <span className="font-mono-tabular font-bold text-slate-900 shrink-0">
                          × {item.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* เลือด (Blood) */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-rose-800">เลือด (Blood)</span>
                  <span className="text-[11px] font-mono-tabular font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded">
                    รวม {totalBloodCount} unit
                  </span>
                </div>
                {bloodItems.length === 0 ? (
                  <div className="text-xs text-slate-400">— ไม่มีรายการ —</div>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {bloodItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-start justify-between gap-2 min-w-0"
                      >
                        <span className="text-slate-800 min-w-0 [overflow-wrap:anywhere]">
                          {item.name}
                        </span>
                        <span className="font-mono-tabular font-bold text-slate-900 shrink-0">
                          × {item.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* Section 4 & 5: Assessment & Causes */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-slate-300 p-3.5 min-w-0 overflow-hidden">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                4. การประเมินแรกรับ (Initial Assessment)
              </h2>
              {record.initialAssessment.length === 0 ? (
                <div className="text-xs text-slate-400">ไม่ได้ระบุ</div>
              ) : (
                <ul className="space-y-1 text-xs text-slate-800">
                  {record.initialAssessment.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 min-w-0">
                      <span className="font-bold text-teal-700 shrink-0">✓</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-slate-300 p-3.5 min-w-0 overflow-hidden">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                5. สาเหตุ (Causes of Cardiac Arrest)
              </h2>
              {record.causes.length === 0 ? (
                <div className="text-xs text-slate-400">ไม่ได้ระบุ</div>
              ) : (
                <ul className="space-y-1 text-xs text-slate-800">
                  {record.causes.map((cause) => (
                    <li key={cause} className="flex items-start gap-1.5 min-w-0">
                      <span className="font-bold text-blue-700 shrink-0">✓</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{cause}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Section 6: Chronological Event Timeline */}
          <section className="rounded-lg border border-slate-300 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                6. บันทึกเหตุการณ์ตามลำดับเวลา (Event Timeline)
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-600">
                ทั้งหมด {chronologicalEvents.length} รายการ
              </span>
            </div>
            {chronologicalEvents.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center">ไม่มีเหตุการณ์ที่บันทึก</div>
            ) : (
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] text-slate-600">
                    <th className="py-2 px-3 w-16 sm:w-20">เวลา CPR</th>
                    <th className="py-2 px-3 w-20 sm:w-24">นาฬิกาจริง</th>
                    <th className="py-2 px-3 w-28 sm:w-32">ประเภท</th>
                    <th className="py-2 px-3">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chronologicalEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 px-3 font-mono-tabular font-bold text-slate-900 align-top">
                        {formatTimerSeconds(ev.elapsedSeconds)}
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-slate-500 align-top">
                        {formatTimeOnly(ev.timestamp)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 align-top [overflow-wrap:anywhere]">
                        {ev.title}
                      </td>
                      <td className="py-2 px-3 text-slate-700 align-top [overflow-wrap:anywhere]">
                        {ev.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Section 7 & 8: Team & Clinical Note */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-slate-300 p-3.5 min-w-0 overflow-hidden">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                7. ทีมช่วยฟื้นคืนชีพ (CPR Team)
              </h2>
              <div className="space-y-1.5 text-xs">
                {TEAM_ROLES.map((role) => {
                  const members = record.team?.[role.key] || [];
                  return (
                    <div
                      key={role.key}
                      className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-0 last:pb-0 min-w-0"
                    >
                      <span className="font-semibold text-slate-700 shrink-0">{role.label}:</span>
                      <span className="text-slate-800 text-right min-w-0 [overflow-wrap:anywhere]">
                        {members.length > 0 ? members.join(', ') : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 p-3.5 min-w-0 overflow-hidden flex flex-col justify-between">
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  8. หมายเหตุทางคลินิก (Clinical Note)
                </h2>
                <p className="text-xs text-slate-800 whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">
                  {record.clinicalNote || '—'}
                </p>
              </div>
            </div>
          </section>

          {/* Signature Footer */}
          <footer className="pt-6 grid grid-cols-2 gap-8 text-xs text-slate-700">
            <div className="text-center space-y-6 min-w-0">
              <div className="border-b border-slate-400 mx-6 pt-4" />
              <div className="min-w-0">
                <div className="font-semibold">ลงชื่อผู้บันทึก (Timer / Recorder)</div>
                <div className="text-[11px] text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                  {record.team?.recorder?.join(', ') || '....................................................'}
                </div>
              </div>
            </div>

            <div className="text-center space-y-6 min-w-0">
              <div className="border-b border-slate-400 mx-6 pt-4" />
              <div className="min-w-0">
                <div className="font-semibold">ลงชื่อหัวหน้าทีม (Team Leader)</div>
                <div className="text-[11px] text-slate-500 mt-0.5 [overflow-wrap:anywhere]">
                  {record.team?.leader?.join(', ') || '....................................................'}
                </div>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};
