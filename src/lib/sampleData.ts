// ============================================================================
// Beispieldaten: die heutige Besetzung von VietHaus, Summe = 606 bezahlte Stunden.
// ============================================================================

import type { Employee, Schedule } from "../types";
import { DEFAULT_WORK_HOURS } from "./workHours";

export function makeEmployee(
  id: string,
  name: string,
  employmentType: Employee["employmentType"],
  targetHours: number,
): Employee {
  return { id, name, employmentType, targetMinutes: targetHours * 60 };
}

/**
 * Beispielbelegschaft = Angaben des Chefs (VietHaus Restaurant):
 * 3 Vollzeit (1x 200 h, 2x 160 h) + 2 Minijob (je 43 h). Summe = 606 h.
 */
export const SAMPLE_EMPLOYEES: Employee[] = [
  makeEmployee("VZ1", "VZ1", "VOLLZEIT", 172),
  makeEmployee("TZ1", "TZ1", "TEILZEIT", 150),
  makeEmployee("TZ2", "TZ2", "TEILZEIT", 86),
  makeEmployee("TZ3", "TZ3", "TEILZEIT", 86),
  makeEmployee("TZ4", "TZ4", "TEILZEIT", 86),
  makeEmployee("MJ1", "MJ1", "MINIJOB", 43),
];

export function createSampleSchedule(): Schedule {
  return {
    companyName: "VietHaus Restaurant",
    address: "Herrengasse 19, 01744 Dippoldiswalde",
    year: 2026,
    month: 8, // August
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: SAMPLE_EMPLOYEES.map((e) => ({ ...e })),
    shifts: [],
  };
}
