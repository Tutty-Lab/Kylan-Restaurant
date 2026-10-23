import type { Schedule } from "../types";
import { parseIsoDate } from "./demand";

export const OVERVIEW_NOTE = "Bezahlte Stunden ohne Pausen. Nachtstunden ab 20 Uhr ohne Sonntage. * Pausenlage unbekannt: Nachtstunden nicht bestimmbar.";

export function hourOverview(schedule: Schedule, dates: string[], employeeIds?: string[]) {
  const selected = new Set(dates);
  return schedule.employees.filter(e => !employeeIds?.length || employeeIds.includes(e.id)).map(employee => {
    let total = 0, sunday = 0, night = 0;
    let unknownNight = false;
    for (const shift of schedule.shifts) {
      if (shift.employeeId !== employee.id || !selected.has(shift.date)) continue;
      total += shift.paidMinutes;
      if (parseIsoDate(shift.date).getDay() === 0) sunday += shift.paidMinutes;
      else {
        const overlap = Math.max(0, shift.endMinutes - Math.max(1200, shift.startMinutes));
        if (overlap && shift.pauseMinutes > 0 && shift.startMinutes < 1200) unknownNight = true;
        else night += Math.max(0, overlap - (shift.startMinutes >= 1200 ? shift.pauseMinutes : 0));
      }
    }
    return { employee, total, sunday, night: unknownNight ? null : night };
  });
}
