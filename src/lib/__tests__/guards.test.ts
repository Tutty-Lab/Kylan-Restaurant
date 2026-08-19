// ============================================================================
// Zwei Fälle, die der Chef durch eigene Eingaben auslösen kann:
//  - ein Soll, das kleiner ist als die kürzeste Schicht,
//  - ein Tag mit mehr Leuten in der Stoßzeit, als dort stehen dürfen.
// Beides muss sichtbar werden statt still zu passieren.
// ============================================================================

import { describe, expect, it } from "vitest";
import { generateSchedule } from "../scheduler";
import { analyzeSchedule } from "../analyze";
import { DEFAULT_WORK_HOURS } from "../workHours";
import type { Employee, Shift } from "../../types";

const emp = (id: string, type: Employee["employmentType"], hours: number): Employee => ({
  id,
  name: id,
  employmentType: type,
  targetMinutes: hours * 60,
});

const generate = (employees: Employee[]) =>
  generateSchedule({ year: 2026, month: 8, workHours: DEFAULT_WORK_HOURS, employees });

describe("Soll kleiner als die kürzeste Schicht", () => {
  it("nennt den wahren Grund statt der Kapazitätsdecke", () => {
    // Früher kam hier ein Vortrag über die 6-Tage-Regel und eine Decke von
    // über 200 h – für jemanden, der 2 h eingetragen hat, völlig nutzlos.
    let message = "";
    try {
      generate([emp("a", "VOLLZEIT", 2)]);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("Định mức quá nhỏ");
    expect(message).toContain("3h");
    expect(message).not.toContain("6 ngày");
  });

  it("3 h ist die Untergrenze und geht durch", () => {
    const shifts = generate([emp("a", "TEILZEIT", 3)]);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].paidMinutes).toBe(180);
  });
});

describe("Zu viele Leute in der Stoßzeit", () => {
  // Kylan hat keine Untergrenze bei der Besetzung – eine Person genügt. Was
  // schiefgehen kann, ist das Gegenteil: mehr Leute im Fenster als erlaubt.
  //
  // Der Plan wird hier von Hand gebaut, nicht vom Scheduler. Sonst prüft der
  // Test nur, ob der Scheduler heute zufällig einen schlechten Tag erwischt;
  // gemeint ist aber die Auswertung – ein Verstoß muss auffallen, egal woher
  // er kommt (auch aus einer Änderung von Hand im Dienstplan).
  const employees = [
    emp("a", "TEILZEIT", 9),
    emp("b", "TEILZEIT", 9),
    emp("c", "TEILZEIT", 9),
  ];

  // 2026-08-01 ist ein Samstag: offen 13-22 Uhr, Abendspitze 17-22 Uhr,
  // höchstens zwei Personen. Hier stehen drei, jeweils den ganzen Tag.
  const shifts: Shift[] = employees.map((e, i) => ({
    id: `s${i}`,
    employeeId: e.id,
    date: "2026-08-01",
    startMinutes: 13 * 60,
    endMinutes: 22 * 60,
    pauseMinutes: 0,
    paidMinutes: 9 * 60,
    shiftType: "EARLY",
    generated: true,
  }));

  const analysis = analyzeSchedule({
    year: 2026,
    month: 8,
    workHours: DEFAULT_WORK_HOURS,
    employees,
    shifts,
  });

  it("meldet den überbesetzten Tag, statt ihn zu verschweigen", () => {
    const tag = analysis.peakViolations.find((d) => d.date === "2026-08-01");
    expect(tag).toBeDefined();
    expect(tag!.peaks.some((p) => !p.ok)).toBe(true);
  });

  it("nennt die tatsächliche Personenzahl und die erlaubte", () => {
    const abend = analysis.peakViolations
      .find((d) => d.date === "2026-08-01")!
      .peaks.find((p) => !p.ok)!;
    expect(abend.maxStaff).toBe(3); // so viele stehen wirklich da
    expect(abend.allowed).toBe(2); // so viele dürfen es sein
  });

  it("lässt zwei Personen im selben Fenster in Ruhe", () => {
    const zwei = analyzeSchedule({
      year: 2026,
      month: 8,
      workHours: DEFAULT_WORK_HOURS,
      employees: employees.slice(0, 2),
      shifts: shifts.slice(0, 2),
    });
    // Nur dieser eine Tag zählt. Alle übrigen Tage des Monats stehen in
    // dieser Fixture ohne jede Schicht da und sind damit zu Recht als
    // unterbesetzt gemeldet – das ist hier nicht der Prüfgegenstand.
    expect(zwei.peakViolations.map((d) => d.date)).not.toContain("2026-08-01");
  });
});
