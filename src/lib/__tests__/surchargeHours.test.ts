import { describe, expect, it } from "vitest";
import type { Shift } from "../../types";
import { hourStatsFor, nightMinutes, sundayMinutes } from "../surchargeHours";

const shift = (date: string, start: number, end: number, pauseStart?: number, pause = 0): Shift => ({
  id: `${date}-${start}`, employeeId: "a", date, startMinutes: start, endMinutes: end,
  pauseMinutes: pause, ...(pauseStart == null ? {} : { pauseStartMinutes: pauseStart }),
  paidMinutes: end - start - pause, shiftType: "LATE", generated: true,
});

describe("Nacht- und Sonntagsstunden", () => {
  it("zählt nur die bezahlte Zeit ab 20:00", () => {
    expect(nightMinutes(shift("2026-10-05", 17 * 60, 22 * 60))).toBe(120);
    expect(nightMinutes(shift("2026-10-05", 11 * 60, 15 * 60))).toBe(0);
    expect(nightMinutes(shift("2026-10-05", 16.5 * 60, 20 * 60))).toBe(0);
    // Pause 20:00–20:30 liegt in der Nacht und ist unbezahlt.
    expect(nightMinutes(shift("2026-10-05", 14 * 60, 22 * 60, 20 * 60, 30))).toBe(90);
  });
  it("zählt Sonntage voll, andere Tage nicht", () => {
    expect(sundayMinutes(shift("2026-10-04", 17 * 60, 22 * 60))).toBe(300);
    expect(sundayMinutes(shift("2026-10-05", 17 * 60, 22 * 60))).toBe(0);
  });
  it("summiert je Person im Zeitraum", () => {
    const shifts = [shift("2026-10-04", 17 * 60, 22 * 60), shift("2026-10-05", 11 * 60, 15 * 60), shift("2026-11-01", 17 * 60, 22 * 60)];
    // 04.10. ist Sonntag: 17–22 Uhr zählt nur als Sonntag, nicht als Nacht.
    expect(hourStatsFor(shifts, "a", ["2026-10-04", "2026-10-05"])).toEqual({ total: 540, night: 0, sunday: 300 });
    const weekday = [shift("2026-10-05", 17 * 60, 22 * 60)];
    expect(hourStatsFor(weekday, "a", ["2026-10-05"])).toEqual({ total: 300, night: 120, sunday: 0 });
  });
});

