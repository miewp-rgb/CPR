import type { CprTeam, PatientDirectoryItem, ServiceGroup } from '../types/cpr';

export const MEDICINE_OPTIONS = [
  'Amiodarone 150 mg',
  'Amiodarone 300 mg',
  'Lidocaine (ทางเลือกแทน Amiodarone) 1 mg',
  'Lidocaine (ทางเลือกแทน Amiodarone) 1.5 mg',
  'Lidocaine (ทางเลือกแทน Amiodarone) 3 mg',
  'Magnesium sulfate 1 g',
  'Magnesium sulfate 2 g',
];

export const RHYTHM_OPTIONS = [
  'pVT',
  'VF',
  'PEA',
  'Asystole',
  'Bradycardia',
  'SVT',
  'VT with pulse',
];

export const DEFIB_JOULES_OPTIONS = ['150', '200', '400'];

export const ETT_SIZE_OPTIONS = ['3', '3.5', '5', '5.5', '7', '7.5', '8', '8.5'];

export const FLUID_OPTIONS = [
  'NSS 0.9% 500 ml',
  'NSS 0.9% 1000 ml',
  "Ringer's Lactate 500 ml",
  '5% D/W 250 ml',
];

export const BLOOD_OPTIONS = [
  'PRC 1 unit',
  'LPRC 1 unit',
  'FFP 1 unit',
  'PC (Platelet) 1 unit',
  'Whole Blood 1 unit',
];

export const PROCEDURE_OPTIONS = [
  'C - line',
  'A - line',
  'IO Access',
  'Intubation',
];

export const INITIAL_ASSESSMENT_OPTIONS = [
  { id: 'unresponsive', label: 'Unresponsive (ไม่ตอบสนอง)' },
  { id: 'not_breathing', label: 'Not breathing / Agonal breathing (ไม่หายใจ / หายใจเฮือก)' },
  { id: 'no_pulse', label: 'No pulse (ไม่มีชีพจร)' },
];

export const CAUSES_OPTIONS = [
  'Hydrogen ion (acidosis)',
  'Hypokalemia/Hyperkalemia',
  'Hypoxia',
  'Hypovolemia',
  'Hypothermia',
  'Hypoglycemia',
  'Unattended',
  'Thrombosis: AMI',
  'Thrombosis: PE',
  'Tamponade (cardiac)',
  'Tension pneumothorax',
  'Toxin',
  'Trauma',
  'Other',
];

export const TEAM_ROLES: { key: keyof CprTeam; label: string; shortLabel: string }[] = [
  { key: 'leader', label: 'Team Leader', shortLabel: 'Leader' },
  { key: 'airway', label: 'Airway', shortLabel: 'Airway' },
  { key: 'compressor', label: 'Compressor', shortLabel: 'Compressor' },
  { key: 'medication', label: 'IV / IO Medication', shortLabel: 'IV / Med' },
  { key: 'monitor', label: 'AED / Monitor Defibrillator', shortLabel: 'Monitor' },
  { key: 'recorder', label: 'Timer/Recorder', shortLabel: 'Recorder' },
];

export const STAFF_DIRECTORY = [
  'นพ. กิตติพงษ์ วงศ์สุวรรณ',
  'พญ. สุภาวดี ศรีสวัสดิ์',
  'นพ. ธนกร เจริญสุข',
  'พว. มณีรัตน์ จันทร์เพ็ญ',
  'พว. พัชรินทร์ แก้วมณี',
  'พว. ศิริพร ทองดี',
  'พว. วราภรณ์ นาคสุข',
  'พว. ชุติมา รัตนโชติ',
  'นชพ. อนุชา แสงทอง',
  'นชพ. ปิยะวัฒน์ ดีมาก',
];

export const SERVICE_GROUPS: { value: ServiceGroup; label: string; description: string }[] = [
  { value: 'ER', label: 'ER', description: 'ห้องฉุกเฉิน' },
  { value: 'ICU', label: 'ICU', description: 'หอผู้ป่วยวิกฤต' },
  { value: 'IPD', label: 'IPD', description: 'หอผู้ป่วยใน' },
  { value: 'OR', label: 'OR', description: 'ห้องผ่าตัด' },
  { value: 'OPD', label: 'OPD', description: 'ผู้ป่วยนอก' },
];

export const DEPARTMENTS_BY_GROUP: Record<ServiceGroup, string[]> = {
  ER: ['ER Resuscitation Room', 'ER Trauma Bay', 'ER Observation'],
  ICU: ['ICU อายุรกรรม', 'ICU ศัลยกรรม', 'CCU โรคหัวใจ'],
  IPD: ['อายุรกรรมชาย', 'อายุรกรรมหญิง', 'ศัลยกรรมชาย', 'ศัลยกรรมหญิง'],
  OR: ['OR ห้องผ่าตัดใหญ่', 'OR Recovery Room'],
  OPD: ['ตรวจโรคทั่วไป', 'คลินิกเฉพาะทางหัวใจ'],
};

export const PATIENT_DIRECTORY: PatientDirectoryItem[] = [
  { hn: '1131000', an: 'O691112-0002', name: 'MR. APPOINTMENT TESTHISTORY', age: 64, gender: 'M', ward: 'ER Resuscitation Room', serviceGroup: 'ER' },
  { hn: '1132023', an: 'O691112-0035', name: 'MR. CPR TESTTEMP', age: 58, gender: 'M', ward: 'ICU อายุรกรรม', serviceGroup: 'ICU' },
  { hn: '1131792', an: 'E691110-0036', name: 'MR. ชาย คุณท่าน', age: 71, gender: 'M', ward: 'อายุรกรรมชาย', serviceGroup: 'IPD' },
  { hn: '1134810', an: 'I691114-0108', name: 'MRS. สมหญิง ใจดี', age: 67, gender: 'F', ward: 'CCU โรคหัวใจ', serviceGroup: 'ICU' },
  { hn: '1135291', an: 'E691114-0215', name: 'MR. วิชัย รักษ์ไทย', age: 52, gender: 'M', ward: 'ER Trauma Bay', serviceGroup: 'ER' },
  { hn: '1136044', an: 'I691114-0302', name: 'MS. กัญญา พงษ์ไพร', age: 45, gender: 'F', ward: 'OR ห้องผ่าตัดใหญ่', serviceGroup: 'OR' },
  { hn: '1137119', an: 'O691114-0411', name: 'MR. ประสิทธิ์ มั่นคง', age: 74, gender: 'M', ward: 'ตรวจโรคทั่วไป', serviceGroup: 'OPD' },
  { hn: '1138502', an: 'I691114-0519', name: 'MRS. นงลักษณ์ สุขศรี', age: 62, gender: 'F', ward: 'อายุรกรรมหญิง', serviceGroup: 'IPD' },
];

export const EMPTY_TEAM: CprTeam = {
  leader: [],
  airway: [],
  compressor: [],
  medication: [],
  monitor: [],
  recorder: [],
};

export const WORKFLOW_STATUS_META = {
  ACTIVE_CPR: {
    label: 'กำลังทำ CPR',
    shortLabel: 'Active CPR',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50 border-red-200',
    dotClass: 'bg-red-500',
  },
  POST_ROSC_FOLLOWUP: {
    label: 'ติดตาม Post-ROSC',
    shortLabel: 'Post-ROSC',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  PENDING_REVIEW: {
    label: 'รอสรุปผล (Temp)',
    shortLabel: 'Temp / รอสรุป',
    textClass: 'text-blue-700',
    bgClass: 'bg-blue-50 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  COMPLETED: {
    label: 'บันทึกสมบูรณ์',
    shortLabel: 'Completed',
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
} as const;
