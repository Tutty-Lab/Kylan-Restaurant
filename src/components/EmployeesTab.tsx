import { useCallback, useMemo, useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { Employee, EmploymentType } from "../types";
import { splitTargetHours } from "../lib/splitTargetHours";
import { VacationPicker } from "./VacationPicker";
import { isDayClosed } from "../lib/workHours";
import { publicHolidays } from "../lib/holidays";
import { WEEKDAY_SHORT_VI, type WeekdayKey } from "../lib/demand";
import {
  vacationDatesInMonth,
  vacationDaysInYear,
  vacationEntitlement,
} from "../lib/availability";
import { employmentShortVi } from "../lib/employment";

const inputClass =
  "rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

const WEEKDAY_ORDER: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Ab hier wird gewarnt. 192 h = 24 Tage à 8 h; darüber wird der Monat sehr
 * eng (6-Tage-Regel) und arbeitsrechtlich heikel.
 */
export const WARN_HOURS = 192;

/** Số ngày làm (= số ca) cho một mục tiêu, hoặc thông báo lỗi. */
function splitInfo(targetHours: number, type: EmploymentType): { ok: boolean; text: string } {
  if (targetHours <= 0) return { ok: true, text: "—" };
  try {
    const parts = splitTargetHours(Math.round(targetHours), type);
    return { ok: true, text: `${parts.length} ca` };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : "không hợp lệ" };
  }
}

/** Entwurf, während im Blatt getippt wird. Stunden als STRING (Feld leerbar). */
type Draft = {
  name: string;
  employmentType: EmploymentType;
  hours: string;
  availableWeekdays: WeekdayKey[]; // [] = mọi ngày
  maxDays: string;
  vacationDates: string[];
  vacationAllowanceByYear: Record<string, number>;
  employmentStartDate: string;
  employmentEndDate: string;
};

function draftFrom(emp?: Employee): Draft {
  return {
    name: emp?.name ?? "",
    employmentType: emp?.employmentType ?? "VOLLZEIT",
    hours: emp ? String(emp.targetMinutes / 60) : "176",
    availableWeekdays: emp?.availableWeekdays ?? [],
    maxDays: emp?.maxDaysPerWeek ? String(emp.maxDaysPerWeek) : "",
    vacationDates: emp?.vacationDates ?? [],
    vacationAllowanceByYear: { ...emp?.vacationAllowanceByYear },
    employmentStartDate: emp?.employmentStartDate ?? "",
    employmentEndDate: emp?.employmentEndDate ?? "",
  };
}

function draftToEmployee(d: Draft): Omit<Employee, "id"> {
  const stunden = Math.max(0, Math.round(Number(d.hours) || 0));
  const tage = Number(d.maxDays);
  return {
    name: d.name.trim() || "Nhân viên mới",
    employmentType: d.employmentType,
    targetMinutes: stunden * 60,
    availableWeekdays:
      d.availableWeekdays.length === 0 || d.availableWeekdays.length === 7
        ? undefined
        : [...d.availableWeekdays],
    maxDaysPerWeek: d.maxDays === "" || tage < 1 ? undefined : Math.min(7, Math.round(tage)),
    vacationAllowanceByYear: d.vacationAllowanceByYear,
    employmentStartDate: d.employmentStartDate || undefined,
    employmentEndDate: d.employmentEndDate || undefined,
    vacationDates: d.vacationDates.length > 0 ? [...d.vacationDates].sort() : undefined,
  };
}

export function EmployeesTab({ store }: { store: UseScheduleReturn }) {
  const { schedule, addEmployee, updateEmployee, removeEmployee, isLocked } = store;

  const holidays = useMemo(() => publicHolidays(schedule.year), [schedule.year]);
  const overrides = useMemo(
    () => Object.fromEntries(schedule.dateOverrides.map((o) => [o.date, o])),
    [schedule.dateOverrides],
  );
  const isClosed = useCallback(
    (iso: string) => isDayClosed(schedule.workHours, iso, holidays, overrides),
    [schedule.workHours, holidays, overrides],
  );

  // null = zu; "new" = anlegen; sonst = die id, die bearbeitet wird.
  const [offen, setOffen] = useState<null | "new" | string>(null);
  const bearbeitet = useMemo(
    () =>
      typeof offen === "string" && offen !== "new"
        ? schedule.employees.find((e) => e.id === offen)
        : undefined,
    [offen, schedule.employees],
  );

  return (
    <section className="rounded-lg bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-slate-900">
          Nhân viên
          {schedule.employees.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              {schedule.employees.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => setOffen("new")}
          disabled={isLocked}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 active:bg-slate-800 disabled:opacity-40"
        >
          + Thêm
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Giờ nhập theo <b>tháng</b>. Bấm vào một người để sửa (hình thức, giờ, ngày làm trong
        tuần, số ngày/tuần, nghỉ phép). Ngày nghỉ phép đã lưu sẽ tự được áp dụng khi tạo lịch.
      </p>

      {isLocked && (
        <div className="mb-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
          <b>Tháng này đã khoá</b> vì lịch đã in — mở khoá ở tab <b>Bảng chấm công</b> để sửa
          nhân viên.
        </div>
      )}

      {schedule.employees.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          Chưa có nhân viên. Bấm <b>+ Thêm</b> để tạo.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_1fr_1fr] gap-4 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 border-b border-slate-200">
            <span>Nhân viên · thời gian làm việc</span><span>Định mức tháng</span><span>Phép năm {schedule.year}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {schedule.employees.map((emp) => (
              <li key={emp.id}>
                <button disabled={isLocked} onClick={() => setOffen(emp.id)}
                  aria-label={`Chỉnh sửa ${emp.name}`}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 focus-visible:outline-slate-500 disabled:opacity-60">
                  <EmployeeSummaryRow emp={emp} year={schedule.year} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLocked && (
        <button
          onClick={() => setOffen("new")}
          aria-label="Thêm nhân viên"
          className="sm:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-slate-900 text-white text-2xl shadow-lg active:bg-slate-700 flex items-center justify-center"
        >
          +
        </button>
      )}

      {offen !== null && !isLocked && (
        <EmployeeSheet
          key={bearbeitet?.id ?? "new"}
          employee={bearbeitet}
          year={schedule.year}
          month={schedule.month}
          isClosed={isClosed}
          onClose={() => setOffen(null)}
          onSave={(felder) => {
            if (bearbeitet) updateEmployee(bearbeitet.id, felder);
            else addEmployee(felder);
            setOffen(null);
          }}
          onDelete={
            bearbeitet
              ? () => {
                  removeEmployee(bearbeitet.id);
                  setOffen(null);
                }
              : undefined
          }
        />
      )}
    </section>
  );
}

/** Kompakte Zeile in der Liste. */
function EmployeeSummaryRow({ emp, year }: { emp: Employee; year: number }) {
  const stunden = emp.targetMinutes / 60;
  const allowance = vacationEntitlement(emp, year);
  const used = vacationDaysInYear(emp, year);
  const dateLabel = (date?: string) => date ? date.split("-").reverse().join("/") : "Không giới hạn";
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr] sm:gap-4 sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{emp.name}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{employmentShortVi(emp.employmentType)}</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">{emp.employmentStartDate || emp.employmentEndDate ? `${dateLabel(emp.employmentStartDate)} – ${dateLabel(emp.employmentEndDate)}` : "Chưa giới hạn ngày làm"}</div>
        <div className="mt-1 text-xs text-slate-500">{emp.availableWeekdays?.length ? emp.availableWeekdays.map(k => WEEKDAY_SHORT_VI[k]).join(" · ") : "Theo ngày mở cửa"}{emp.maxDaysPerWeek ? ` · tối đa ${emp.maxDaysPerWeek} ngày/tuần` : ""}</div>
      </div>
      <div className="text-sm"><span className="font-semibold text-slate-900">{stunden}h</span><span className="sm:hidden text-slate-500"> / tháng</span></div>
      <div>
        <span className={`text-sm font-medium ${used > allowance ? "text-amber-700" : "text-slate-700"}`}>{used} / {allowance} ngày</span>
        <div className="mt-1 text-xs text-slate-500">Còn {Math.max(0, allowance - used)} ngày phép</div>
      </div>
    </div>
  );
}

/** Blatt zum Anlegen ODER Bearbeiten – Handy von unten, Desktop mittig. */
function EmployeeSheet({
  employee,
  year,
  month,
  isClosed,
  onClose,
  onSave,
  onDelete,
}: {
  employee?: Employee;
  year: number;
  month: number;
  isClosed: (iso: string) => boolean;
  onClose: () => void;
  onSave: (felder: Omit<Employee, "id">) => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(employee));

  const [loeschFrage, setLoeschFrage] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const stunden = Math.max(0, Math.round(Number(d.hours) || 0));
  const info = splitInfo(stunden, d.employmentType);
  const tooMany = stunden > WARN_HOURS;

  const draftEmp: Employee = { id: "draft", ...draftToEmployee(d) };
  const imJahr = vacationDaysInYear(draftEmp, year);
  const anspruch = vacationEntitlement(draftEmp, year);
  const imMonat = vacationDatesInMonth(draftEmp, year, month);
  const zuVielUrlaub = imJahr > anspruch;

  const toggleUrlaub = (iso: string) => {
    setD((prev) => ({
      ...prev,
      vacationDates: prev.vacationDates.includes(iso)
        ? prev.vacationDates.filter((x) => x !== iso)
        : [...prev.vacationDates, iso].sort(),
    }));
  };

  const alleTage = d.availableWeekdays.length === 0;
  const toggleWeekday = (key: WeekdayKey) => {
    const basis = alleTage ? WEEKDAY_ORDER : d.availableWeekdays;
    set(
      "availableWeekdays",
      basis.includes(key) ? basis.filter((k) => k !== key) : [...basis, key],
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-lg bg-white shadow-xl border border-slate-200"
        role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h3 id="employee-dialog-title" className="font-semibold text-slate-900">
            {employee ? "Sửa nhân viên" : "Thêm nhân viên"}
          </h3>
          <button aria-label="Đóng" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hợp đồng & định mức</div>
          <label className="block">
            <span className="text-xs text-slate-600">Tên</span>
            <input
              autoFocus={!employee}
              className={`${inputClass} w-full mt-1`}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Tên nhân viên"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-600">Hình thức</span>
              <select
                className={`${inputClass} w-full mt-1`}
                value={d.employmentType}
                onChange={(e) => set("employmentType", e.target.value as EmploymentType)}
              >
                <option value="VOLLZEIT">Toàn thời gian</option>
                <option value="TEILZEIT">Bán thời gian</option>
                <option value="MINIJOB">Minijob</option>
                <option value="AZUBI">Học nghề</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Giờ định mức / tháng</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={`${inputClass} w-full mt-1`}
                value={d.hours}
                onChange={(e) => set("hours", e.target.value)}
              />
            </label>
          </div>
          <div className={`text-xs ${info.ok ? "text-slate-500" : "text-rose-600"}`}>
            {info.text}
            {tooMany && <span className="text-amber-600 font-medium"> · ⚠ &gt;{WARN_HOURS}h/tháng</span>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs text-slate-600">Ngày vào làm
                <input type="date" className={`${inputClass} mt-1 w-full bg-white`} value={d.employmentStartDate}
                  max={d.employmentEndDate || undefined} onInput={e => set("employmentStartDate", e.currentTarget.value)} />
              </label>
              <label className="block text-xs text-slate-600">Ngày làm cuối cùng
                <input type="date" className={`${inputClass} mt-1 w-full bg-white`} value={d.employmentEndDate}
                  min={d.employmentStartDate || undefined} onInput={e => set("employmentEndDate", e.currentTarget.value)} />
              </label>
            </div>
            {d.employmentStartDate && d.employmentEndDate && d.employmentEndDate < d.employmentStartDate &&
              <p role="alert" className="mt-2 text-xs text-rose-600">Ngày làm cuối không được trước ngày vào làm.</p>}
            <p className="mt-2 text-xs text-slate-500">Bỏ trống nếu không giới hạn. Xếp đủ {stunden}h/tháng vào những ngày còn làm việc; không tự giảm định mức theo tuần hoặc ngày vào làm.</p>
          </div>
          {/* Ngày làm trong tuần + số ngày/tuần */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-600 mb-1.5">
              Ngày làm trong tuần
              {alleTage && <span className="text-slate-400"> — bỏ trống = làm mọi ngày</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {WEEKDAY_ORDER.map((key) => {
                const an = alleTage || d.availableWeekdays.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleWeekday(key)}
                    className={`rounded px-2 py-1 text-xs border transition-colors ${
                      an
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-400 border-slate-200 line-through"
                    }`}
                  >
                    {WEEKDAY_SHORT_VI[key]}
                  </button>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              Số ngày làm mỗi tuần
              <input
                type="number"
                min={1}
                max={7}
                placeholder="—"
                className={`${inputClass} w-16`}
                value={d.maxDays}
                onChange={(e) => set("maxDays", e.target.value)}
              />
              <span className="text-slate-400">bỏ trống = không giới hạn</span>
            </label>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h4 className="text-sm font-semibold text-slate-900">Nghỉ phép · {year}</h4>
                <p className="mt-1 text-xs text-slate-500">Chọn ngày nghỉ bên dưới. Lịch tự chừa các ngày đã lưu.</p></div>
              <label className="block text-xs text-slate-600">Số ngày phép cho phép năm {year}
                <input type="number" min={0} step={1} className={`${inputClass} mt-1 block w-28`}
                  value={anspruch} onChange={e => set("vacationAllowanceByYear", {
                    ...d.vacationAllowanceByYear, [String(year)]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })} />
              </label>
            </div>
            <p className={`my-3 text-xs ${zuVielUrlaub ? "text-amber-700" : "text-slate-500"}`}>
              Đã chọn {imJahr}/{anspruch} ngày năm {year} · Còn {Math.max(0, anspruch - imJahr)} ngày.
              {zuVielUrlaub && " Vượt số ngày đã thiết lập."}
              {imMonat.length > 0 && ` Tháng này: ${imMonat.map(x => Number(x.slice(8))).join(", ")}.`}
            </p>
            <VacationPicker year={year} month={month} selected={d.vacationDates}
              onToggle={toggleUrlaub} isClosed={isClosed} />
            <p className="mt-2 text-xs text-slate-500">Hạn phép lưu riêng từng năm. Chuyển năm ở thanh trên để thiết lập năm khác.</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3">
          {loeschFrage ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">Xoá nhân viên này?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLoeschFrage(false)}
                  className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Không
                </button>
                <button
                  onClick={onDelete}
                  className="rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Xoá
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {onDelete ? (
                <button
                  onClick={() => setLoeschFrage(true)}
                  className="text-rose-600 hover:text-rose-800 text-sm font-medium"
                >
                  Xoá
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Huỷ
                </button>
                <button
                  disabled={!!(d.employmentStartDate && d.employmentEndDate && d.employmentEndDate < d.employmentStartDate)}
                  onClick={() => onSave(draftToEmployee(d))}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Lưu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
