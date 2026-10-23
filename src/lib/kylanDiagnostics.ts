import type { Schedule, Shift } from "../types";
import { datesOfMonth, parseIsoDate, weekdayKeyOf } from "./demand";
import { mayWorkOn } from "./availability";
import { publicHolidays } from "./holidays";
import { analyzeSchedule } from "./analyze";
import { minCoverageOver, maxCoverageOver } from "./scheduler";
import { validateSchedule } from "./validation";
import { resolveDay } from "./workHours";
import { weekStartOf } from "./weeks";
import { OWNER_DAYS_PER_WEEK, OWNER_FREE_WEEKDAY } from "../types";

export const KYLAN_COVERAGE_WINDOWS = [
  { key: "opening", label: "11–12h · đầu ca", from: 660, to: 720 },
  { key: "lunch", label: "12–15h · trưa", from: 720, to: 900 },
  { key: "afternoon", label: "15–17h · chiều", from: 900, to: 1020 },
  { key: "dinner-opening", label: "17–18h · đầu tối", from: 1020, to: 1080 },
  { key: "dinner", label: "18–21h · tối", from: 1080, to: 1260 },
  { key: "closing", label: "21–22h · cuối ca", from: 1260, to: 1320 },
] as const;

export type WindowCoverage = { min: number; max: number };

/** Count distinct people; split shifts must never count one person twice. */
export function peopleCoverage(shifts: Shift[], from: number, to: number): WindowCoverage {
  const probes = new Set([from]);
  for (const s of shifts) {
    if (s.startMinutes > from && s.startMinutes < to) probes.add(s.startMinutes);
    if (s.endMinutes > from && s.endMinutes < to) probes.add(s.endMinutes);
  }
  const counts = [...probes].map(t => new Set(shifts
    .filter(s => s.startMinutes <= t && s.endMinutes > t).map(s => s.employeeId)).size);
  return { min: Math.min(...counts), max: Math.max(...counts) };
}

export function kylanDayCoverage(schedule: Schedule, date: string, from: number, to: number): WindowCoverage | null {
  const day = resolveDay(schedule.workHours, date, publicHolidays(schedule.year),
    Object.fromEntries(schedule.dateOverrides.map(o => [o.date, o])));
  const windows = day.closed ? [] : day.blocks.map(b => ({
    from: Math.max(from, b.startMinutes), to: Math.min(to, b.endMinutes),
  })).filter(b => b.to > b.from);
  if (!windows.length) return null;
  const shifts = schedule.shifts.filter(s => s.date === date);
  const coverage = windows.map(b => peopleCoverage(shifts, b.from, b.to));
  return { min: Math.min(...coverage.map(c => c.min)), max: Math.max(...coverage.map(c => c.max)) };
}

export function auditKylanSchedule(schedule: Schedule) {
  const { employees, shifts, year, month, workHours } = schedule;
  const validation = validateSchedule(employees, shifts, year);
  const errors = validation.errors.filter(e => e.severity !== "warning").map(e => e.message);
  const warnings = validation.errors.filter(e => e.severity === "warning").map(e => e.message);
  const holidays = publicHolidays(year);
  const overrides = Object.fromEntries(schedule.dateOverrides.map(o => [o.date, o]));
  const validDates = new Set(datesOfMonth(year, month));
  const byEmployee = new Map(employees.map(e => [e.id, e]));
  for (const s of shifts) {
    const e = byEmployee.get(s.employeeId);
    if (!e || !validDates.has(s.date)) { errors.push(`Ca không thuộc nhân viên/tháng: ${s.id}`); continue; }
    const day = resolveDay(workHours, s.date, holidays, overrides);
    if (day.closed || !(e.isOwner ? [day.window] : day.blocks).some(
      b => s.startMinutes >= b.startMinutes && s.endMinutes <= b.endMinutes)) {
      errors.push(`${e.name} ${s.date}: ca nằm ngoài khung làm việc.`);
    }
    if (!mayWorkOn(e, s.date)) errors.push(`${e.name} ${s.date}: xếp vào ngày không thể làm.`);
    if (e.employmentType === "AZUBI" && !["saturday", "sunday"].includes(weekdayKeyOf(parseIsoDate(s.date)))
      && (s.startMinutes < 18 * 60 || s.endMinutes > 22 * 60)) errors.push(`${e.name}: sai khung học nghề.`);
  }
  for (const e of employees) {
    const own = shifts.filter(s => s.employeeId === e.id);
    const paidByDay = new Map<string, number>();
    const daysByWeek = new Map<string, Set<string>>();
    for (const s of own) {
      paidByDay.set(s.date, (paidByDay.get(s.date) ?? 0) + s.paidMinutes);
      const week = weekStartOf(s.date);
      if (!daysByWeek.has(week)) daysByWeek.set(week, new Set());
      daysByWeek.get(week)!.add(s.date);
      if (e.isOwner && weekdayKeyOf(parseIsoDate(s.date)) === OWNER_FREE_WEEKDAY) errors.push(`${e.name}: làm vào ngày chủ nghỉ.`);
    }
    for (const [date, paid] of paidByDay) if (paid > (e.isOwner ? 10 : 9) * 60) errors.push(`${e.name} ${date}: vượt giờ/ngày.`);
    const maxDays = e.isOwner ? OWNER_DAYS_PER_WEEK : e.maxDaysPerWeek;
    if (maxDays != null) for (const [week, days] of daysByWeek) if (days.size > maxDays) errors.push(`${e.name} ${week}: vượt số ngày/tuần.`);
  }
  const analysis = analyzeSchedule({year, month, workHours, overrides, employees, shifts});
  const peakDays = analysis.peakViolations.length;
  const emptyDays = analysis.days.filter(d => !d.closed && schedule.shifts.length > 0 &&
    resolveDay(workHours, d.date, holidays, overrides).blocks.some(b =>
      minCoverageOver(shifts.filter(s => s.date === d.date), b.startMinutes, b.endMinutes) < 1)).length;
  return {
    errors: [...new Set(errors)], warnings, peakDays, emptyDays,
    targetHours: employees.reduce((sum, e) => sum + e.targetMinutes, 0) / 60,
    assignedHours: analysis.totalPaidHours,
    openDays: analysis.openDays,
    maximumStaff: Math.max(0, ...analysis.days.map(d => maxCoverageOver(shifts.filter(s => s.date === d.date), 0, 1440))),
  };
}
