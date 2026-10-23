import { describe, expect, it } from "vitest";
import type { Employee, Schedule, Shift } from "../../types";
import fixture from "../kylanReviewData.json";
import { DEFAULT_WORK_HOURS } from "../workHours";
import { hourOverview } from "../hourOverview";
import { buildStundenzettelPdf, buildDienstplanPdf } from "../pdf";

const employee = fixture.employees[0] as Employee;
const shift = (date: string, pauseMinutes = 0): Shift => ({ id: date, employeeId: employee.id, date,
  startMinutes: 1140, endMinutes: 1320, pauseMinutes, paidMinutes: 180-pauseMinutes,
  shiftType: "EARLY", generated: true });
const schedule: Schedule = { year: 2026, month: 10, companyName: "Kylan Restaurant", address: "",
  employees: fixture.employees as Employee[], workHours: DEFAULT_WORK_HOURS, dateOverrides: [],
  shifts: [shift("2026-10-23"), shift("2026-10-25"), shift("2026-10-24",30)] };

describe("schedule overview", () => {
  it("filters dates and employees; Sunday hours do not count twice", () => {
    const rows = hourOverview(schedule,["2026-10-23","2026-10-25"],[employee.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({total:360,sunday:180,night:120});
  });
  it("does not invent pause placement", () => {
    expect(hourOverview(schedule,["2026-10-24"],[employee.id])[0]).toMatchObject({total:150,night:null});
  });
  it("puts overview first for monthly and weekly timesheets, respecting selected employees", async () => {
    for (const dates of [undefined, ["2026-10-23"]]) {
      const doc = await buildStundenzettelPdf(schedule, [employee], { dates });
      expect(doc.getNumberOfPages()).toBe(2);
      const pages = (doc.internal as unknown as { pages: string[][] }).pages;
      expect(pages[1].join(" ")).toContain("Stundenübersicht");
      expect(pages[1].join(" ")).toContain(employee.name);
      expect(pages[1].join(" ")).not.toContain(schedule.employees[1].name);
      expect(pages[2].join(" ")).toContain("Stundenaufzeichnung");
      expect(pages[1].join(" ")).toContain(dates ? "3,00" : "8,50");
    }
  });
  for (const layout of ["byDate","byEmployee"] as const) {
    it(`puts overview before schedule: ${layout}`, () => {
      const doc = buildDienstplanPdf(schedule,{dates:["2026-10-23","2026-10-24","2026-10-25"],title:"Oktober 2026",layout});
      expect(doc.getNumberOfPages()).toBe(2);
      const pages = (doc.internal as unknown as { pages: string[][] }).pages;
      expect(pages[1].join(" ")).toContain("Stundenübersicht");
      expect(pages[2].join(" ")).toContain("Dienstplan");
    });
  }
});
