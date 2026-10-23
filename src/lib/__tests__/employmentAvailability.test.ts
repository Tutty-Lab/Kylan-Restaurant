import { describe, expect, it } from "vitest";
import { mayWorkOn, vacationEntitlement } from "../availability";
import { generateSchedule } from "../scheduler";
import { validateSchedule } from "../validation";
import { DEFAULT_WORK_HOURS } from "../workHours";
import { datesOfMonth } from "../demand";
import type { Employee } from "../../types";

const employee: Employee = { id: "e", name: "Minijob", employmentType: "MINIJOB", targetMinutes: 43 * 60 };
const team = (extra: Partial<Employee>): Employee[] => [
  { id: "a", name: "A", employmentType: "TEILZEIT", targetMinutes: 85 * 60 },
  { id: "b", name: "B", employmentType: "TEILZEIT", targetMinutes: 85 * 60 },
  { id: "c", name: "C", employmentType: "TEILZEIT", targetMinutes: 150 * 60 },
  { id: "d", name: "D", employmentType: "VOLLZEIT", targetMinutes: 170 * 60 },
  { ...employee, ...extra },
  { id: "f", name: "F", employmentType: "TEILZEIT", targetMinutes: 86 * 60 },
  { id: "g", name: "G", employmentType: "VOLLZEIT", targetMinutes: 170 * 60, isOwner: true },
];

describe("employee contract dates and annual leave", () => {
  it("includes first/last working days, excludes vacation and outside dates", () => {
    const e = { ...employee, employmentStartDate: "2026-01-09", employmentEndDate: "2026-01-25", vacationDates: ["2026-01-10"] };
    expect(mayWorkOn(e, "2026-01-08")).toBe(false);
    expect(mayWorkOn(e, "2026-01-09")).toBe(true);
    expect(mayWorkOn(e, "2026-01-10")).toBe(false);
    expect(mayWorkOn(e, "2026-01-25")).toBe(true);
    expect(mayWorkOn(e, "2026-01-26")).toBe(false);
  });
  it("uses allowance per year, including zero, preserving legacy fallback", () => {
    const e = { ...employee, vacationAllowanceByYear: { "2026": 6, "2027": 0 } };
    expect(vacationEntitlement(e, 2026)).toBe(6);
    expect(vacationEntitlement(e, 2027)).toBe(0);
    expect(vacationEntitlement(e, 2028)).toBe(8);
    const vacationDates = datesOfMonth(2026, 1).slice(0, 7);
    const result = validateSchedule([{ ...e, vacationDates }], [], 2026);
    expect(result.errors.some(e => e.message.includes("nghỉ phép") && e.message.includes("6"))).toBe(true);
  });
  for (let month = 1; month <= 12; month++) {
    it(`keeps all 43h after joining on day 9, month ${month}`, () => {
      const employees = team({ employmentStartDate: `2026-${String(month).padStart(2, "0")}-09` });
      const shifts = generateSchedule({ year: 2026, month, workHours: DEFAULT_WORK_HOURS, employees });
      const own = shifts.filter(s => s.employeeId === "e");
      expect(own.reduce((sum, s) => sum + s.paidMinutes, 0)).toBe(43 * 60);
      expect(own.every(s => mayWorkOn(employees[4], s.date))).toBe(true);
      expect(validateSchedule(employees, shifts, 2026).errors.filter(e => e.severity !== "warning")).toEqual([]);
    });
  }
  it("keeps 43h within January 9–25 when a last working date is supplied", () => {
    const employees = team({ employmentStartDate: "2026-01-09", employmentEndDate: "2026-01-25" });
    const shifts = generateSchedule({ year: 2026, month: 1, workHours: DEFAULT_WORK_HOURS, employees });
    const own = shifts.filter(s => s.employeeId === "e");
    expect(own.reduce((sum, s) => sum + s.paidMinutes, 0)).toBe(43 * 60);
    expect(own.every(s => mayWorkOn(employees[4], s.date))).toBe(true);
  });
  for (const month of [1, 2]) {
    it(`keeps 43h around vacation January 9–February 9, month ${month}`, () => {
      const vacationDates = [...datesOfMonth(2026, 1), ...datesOfMonth(2026, 2)]
        .filter(d => d >= "2026-01-09" && d <= "2026-02-09");
      const employees = team({ vacationDates });
      const shifts = generateSchedule({ year: 2026, month, workHours: DEFAULT_WORK_HOURS, employees });
      const own = shifts.filter(s => s.employeeId === "e");
      expect(own.reduce((sum, s) => sum + s.paidMinutes, 0)).toBe(43 * 60);
      expect(own.every(s => mayWorkOn(employees[4], s.date))).toBe(true);
    });
  }
  it("keeps 43h before the last working date without a start date", () => {
    const employees = team({ employmentEndDate: "2026-01-09" });
    const shifts = generateSchedule({ year: 2026, month: 1, workHours: DEFAULT_WORK_HOURS, employees });
    const own = shifts.filter(s => s.employeeId === "e");
    expect(own.reduce((sum, s) => sum + s.paidMinutes, 0)).toBe(43 * 60);
    expect(own.every(s => s.date <= "2026-01-09")).toBe(true);
    const invalid = { ...own[0], date: "2026-01-10" };
    expect(validateSchedule(employees, [invalid], 2026).errors.some(e => e.employeeId === "e" && e.severity !== "warning")).toBe(true);
  });
  it("reports an impossible target without scheduling outside employment dates", () => {
    const employees = team({ employmentStartDate: "2026-01-31" });
    const shifts = generateSchedule({ year: 2026, month: 1, workHours: DEFAULT_WORK_HOURS, employees });
    expect(shifts.filter(s => s.employeeId === "e").every(s => s.date === "2026-01-31")).toBe(true);
    expect(validateSchedule(employees, shifts, 2026).errors.some(e => e.employeeId === "e" && e.severity === "warning")).toBe(true);
  });
});
