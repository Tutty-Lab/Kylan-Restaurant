import type { Schedule } from "../types";
import { hourStatsFor } from "./surchargeHours";

export const OVERVIEW_NOTE = "Nachtstunden: bezahlte Arbeitszeit ab 20:00 Uhr (ohne Pause), ohne Sonntage. Sonntagsstunden: gesamte bezahlte Arbeitszeit an Sonntagen (nicht doppelt als Nacht gezählt). Angaben in Stunden.";

export function hourOverview(schedule: Schedule, dates: string[], employeeIds?: string[]) {
  return schedule.employees.filter(e => !employeeIds?.length || employeeIds.includes(e.id)).map(employee => ({
    employee, ...hourStatsFor(schedule.shifts, employee.id, dates),
  }));
}
