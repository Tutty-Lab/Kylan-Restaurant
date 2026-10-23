import { useCallback, useMemo, useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import type { Employee, EmploymentType } from "../types";
import { VacationPicker } from "./VacationPicker";
import { isDayClosed } from "../lib/workHours";
import { publicHolidays } from "../lib/holidays";
import { WEEKDAY_SHORT_VI, type WeekdayKey } from "../lib/demand";
import {
  vacationDaysInYear,
  vacationEntitlement,
} from "../lib/availability";
import { employmentShortVi } from "../lib/employment";

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const stunden = Math.max(0, Math.round(Number(d.hours) || 0));
  const tooMany = stunden > WARN_HOURS;

  const draftEmp: Employee = { id: "draft", ...draftToEmployee(d) };
  const imJahr = vacationDaysInYear(draftEmp, year);
  const anspruch = vacationEntitlement(draftEmp, year);
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

  const invalidPeriod = !!(d.employmentStartDate && d.employmentEndDate && d.employmentEndDate < d.employmentStartDate);
  const fieldClass = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100";
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-500";
  const sectionClass = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title"
        onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") onClose(); }}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-xl sm:max-w-lg sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 id="employee-dialog-title" className="text-base font-semibold text-slate-900">{employee ? "Sửa nhân viên" : "Thêm nhân viên"}</h3>
          <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </header>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-4">
            <h4 className={sectionClass}>Thông tin</h4>
            <label className="block">
              <span className={labelClass}>Tên nhân viên</span>
              <input autoFocus className={fieldClass} value={d.name} onChange={e => set("name", e.target.value)} placeholder="Họ và tên" />
            </label>
            <div>
              <span id="employment-type-label" className={labelClass}>Hình thức</span>
              <div role="group" aria-labelledby="employment-type-label" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
                {([
                  ["VOLLZEIT", "Toàn thời gian"], ["TEILZEIT", "Bán thời gian"], ["MINIJOB", "Minijob"], ["AZUBI", "Học nghề"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={d.employmentType === value} onClick={() => set("employmentType", value)}
                    className={`rounded-md px-2 py-2.5 text-xs font-medium transition-colors ${d.employmentType === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>Giờ định mức / tháng</span>
              <div className="relative">
                <input type="number" inputMode="numeric" min={0} step={1} className={`${fieldClass} pr-20 tabular-nums`} value={d.hours} onChange={e => set("hours", e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">h / tháng</span>
              </div>
            </label>
            {tooMany && <p className="text-xs text-amber-700">Định mức vượt {WARN_HOURS}h/tháng.</p>}
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200">
            <button type="button" aria-expanded={showAdvanced} aria-controls="employee-advanced-settings" onClick={() => setShowAdvanced(v => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <span><span className="block text-sm font-medium text-slate-700">Cài đặt nâng cao</span>
                <span className="mt-0.5 block text-xs text-slate-400">Ngày làm việc · nghỉ phép {imJahr}/{anspruch} ngày</span></span>
              <span aria-hidden="true" className="text-slate-400">{showAdvanced ? "−" : "+"}</span>
            </button>
            {showAdvanced && <div id="employee-advanced-settings" className="space-y-5 border-t border-slate-100 px-4 py-4">
              <section className="space-y-3">
                <h4 className={sectionClass}>Thời gian làm việc</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block min-w-0"><span className={labelClass}>Ngày vào làm</span>
                    <input type="date" className={fieldClass} value={d.employmentStartDate} max={d.employmentEndDate || undefined}
                      onInput={e => set("employmentStartDate", e.currentTarget.value)} />
                  </label>
                  <label className="block min-w-0"><span className={labelClass}>Ngày làm cuối</span>
                    <input type="date" className={fieldClass} value={d.employmentEndDate} min={d.employmentStartDate || undefined}
                      onInput={e => set("employmentEndDate", e.currentTarget.value)} />
                  </label>
                </div>
                {invalidPeriod && <p role="alert" className="text-xs text-rose-600">Ngày làm cuối không được trước ngày vào làm.</p>}
              </section>
              <section className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className={sectionClass}>Ngày làm trong tuần</h4>
                <div role="group" aria-label="Ngày làm trong tuần" className="grid grid-cols-7 gap-1">
                  {WEEKDAY_ORDER.map(key => {
                    const active = alleTage || d.availableWeekdays.includes(key);
                    return <button key={key} type="button" aria-pressed={active} onClick={() => toggleWeekday(key)}
                      className={`rounded-md border py-2.5 text-xs font-medium ${active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{WEEKDAY_SHORT_VI[key]}</button>;
                  })}
                </div>
                <label className="flex items-center justify-between gap-3 text-sm text-slate-600">Tối đa ngày / tuần
                  <input type="number" min={1} max={7} placeholder="Mặc định" className={`${fieldClass} !w-28`} value={d.maxDays} onChange={e => set("maxDays", e.target.value)} />
                </label>
              </section>
              <section className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className={sectionClass}>Phép năm {year}</h4>
                <div className="grid grid-cols-2 items-end gap-3">
                  <label className="block"><span className={labelClass}>Số ngày cho phép</span>
                    <input type="number" min={0} step={1} className={fieldClass} value={anspruch}
                      onChange={e => set("vacationAllowanceByYear", { ...d.vacationAllowanceByYear, [String(year)]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </label>
                  <div className="pb-2.5 text-sm text-slate-500">Đã chọn <b className="font-medium text-slate-900">{imJahr}/{anspruch}</b> ngày</div>
                </div>
                {zuVielUrlaub && <p role="alert" className="text-xs text-amber-700">Vượt {imJahr - anspruch} ngày phép đã thiết lập.</p>}
                <VacationPicker year={year} month={month} selected={d.vacationDates} onToggle={toggleUrlaub} isClosed={isClosed} />
              </section>
            </div>}
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {loeschFrage ? <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">Xoá nhân viên này?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLoeschFrage(false)} className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Không</button>
              <button type="button" onClick={onDelete} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700">Xoá</button>
            </div>
          </div> : <div className="flex items-center justify-between gap-3">
            {onDelete ? <button type="button" onClick={() => setLoeschFrage(true)} className="rounded-lg px-2 py-2.5 text-sm text-rose-600 hover:bg-rose-50">Xoá nhân viên</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Huỷ</button>
              <button type="button" disabled={invalidPeriod} onClick={() => onSave(draftToEmployee(d))}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">Lưu</button>
            </div>
          </div>}
        </footer>
      </div>
    </div>
  );
}
