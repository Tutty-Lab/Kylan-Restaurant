import { describe, expect, it } from "vitest";
import type { Employee, Schedule } from "../../types";
import fixture from "../kylanReviewData.json";
import { DEFAULT_WORK_HOURS, normalizeWorkHours } from "../workHours";
import { generateSchedule } from "../scheduler";
import { auditKylanSchedule, kylanDayCoverage, peopleCoverage } from "../kylanDiagnostics";
import { COMPANY_ADDRESS, COMPANY_NAME } from "../company";

describe("Kylan: dữ liệu 7 nhân viên thực tế, giờ T3–T6 từ 11:00", () => {
  for (let month = 1; month <= 12; month++) {
    it(`tháng ${month}/2026`, () => {
      const employees = structuredClone(fixture.employees) as Employee[];
      const workHours = structuredClone(DEFAULT_WORK_HOURS);
      const shifts = generateSchedule({year: 2026, month, employees, workHours});
      const schedule: Schedule = {year:2026, month, companyName:COMPANY_NAME, address:COMPANY_ADDRESS,
        employees, workHours, shifts, dateOverrides:[]};
      const report = auditKylanSchedule(schedule);
      console.log(JSON.stringify({month, ...report}));
      expect(report.errors).toEqual([]);
      expect(report.assignedHours).toBe(report.targetHours);
      expect(shifts.length).toBeGreaterThan(0);
    }, 120000);
  }
});

describe("Kylan: debug độ phủ", () => {
  const s = (id: string, from: number, to: number) => ({id, employeeId:id, date:"2026-10-06",
    startMinutes:from, endMinutes:to, paidMinutes:to-from, pauseMinutes:0, shiftType:"EARLY" as const, generated:true});
  it("không đếm trùng người; bắt được cả khoảng hụt không tròn 30 phút", () => {
    const a = s("a",660,900);
    expect(peopleCoverage([a, {...a,id:"duplicate"},s("b",675,885)],660,900)).toEqual({min:1,max:2});
    expect(peopleCoverage([s("a",660,719),s("b",720,900)],660,900).min).toBe(0);
  });
  it("giờ đóng cửa hiển thị trống; đầu ca mới gồm 11:00–11:30", () => {
    const schedule: Schedule = {year:2026,month:10,companyName:COMPANY_NAME,address:COMPANY_ADDRESS,
      employees:[],workHours:structuredClone(DEFAULT_WORK_HOURS),dateOverrides:[],shifts:[s("a",690,900)]};
    expect(kylanDayCoverage(schedule,"2026-10-06",660,720)).toEqual({min:0,max:1});
    expect(kylanDayCoverage(schedule,"2026-10-06",900,1020)).toBeNull();
    expect(kylanDayCoverage(schedule,"2026-10-05",660,900)).toBeNull();
  });
  it("giữ giờ T7/CN và ngày lễ; không ghi đè giờ riêng người dùng", () => {
    expect(DEFAULT_WORK_HOURS.perWeekday.tuesday[0].startMinutes).toBe(660);
    expect(DEFAULT_WORK_HOURS.perWeekday.saturday[0].startMinutes).toBe(780);
    expect(DEFAULT_WORK_HOURS.holiday[0].startMinutes).toBe(900);
    const custom = structuredClone(DEFAULT_WORK_HOURS);
    custom.perWeekday.tuesday[0].startMinutes=600;
    expect(normalizeWorkHours(custom).perWeekday.tuesday[0].startMinutes).toBe(600);
    custom.perWeekday.tuesday[0].startMinutes=690;
    expect(normalizeWorkHours(custom).perWeekday.tuesday[0].startMinutes).toBe(660);
    custom.perWeekday.tuesday[0].endMinutes=840;
    expect(normalizeWorkHours(custom).perWeekday.tuesday[0].startMinutes).toBe(690);
  });
});
