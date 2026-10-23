// Monthly leave calendar. Closed days cannot be selected; existing entries can be cleared.

import { WEEKDAY_LABELS_VI, parseIsoDate, weekdayKeyOf } from "../lib/demand";

/** ISO-Datum "yyyy-MM-dd" für einen Tag des Monats. */
function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function VacationPicker({
  year,
  month,
  selected,
  onToggle,
  isClosed,
}: {
  year: number;
  month: number;
  /** Bereits gewählte Urlaubstage als ISO-Daten. */
  selected: string[];
  onToggle: (iso: string) => void;
  /** Tage, an denen der Laden zu hat – dort ist Urlaub sinnlos. */
  isClosed?: (iso: string) => boolean;
}) {
  const tageImMonat = new Date(year, month, 0).getDate();
  const gewaehlt = new Set(selected);

  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-3 text-sm font-medium text-slate-700">Tháng {month}/{year}</div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day =>
          <div key={day} className="py-1 text-xs text-slate-400">{day}</div>)}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`blank-${i}`} />)}
        {Array.from({ length: tageImMonat }, (_, i) => {
          const tag = i + 1;
          const iso = isoOf(year, month, tag);
          const an = gewaehlt.has(iso);
          const zu = isClosed?.(iso) === true;
          return (
            <label key={iso} title={zu ? "Đóng cửa" : an ? "Đã chọn nghỉ phép" : "Chọn nghỉ phép"}
              className={`relative flex min-h-10 items-center justify-center rounded border text-sm ${
                an ? "bg-amber-50 border-amber-400 text-amber-900 font-semibold" :
                zu ? "border-transparent bg-slate-50 text-slate-300" : "border-slate-200 text-slate-700 hover:border-slate-400"
              } ${zu && !an ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="checkbox" checked={an} disabled={zu && !an} onChange={() => onToggle(iso)}
                aria-label={`${tag} ${WEEKDAY_LABELS_VI[weekdayKeyOf(parseIsoDate(iso))]}${zu ? " đóng cửa" : ""}`}
                className="absolute inset-0 h-full w-full cursor-inherit opacity-0 focus-visible:opacity-100" />
              <span aria-hidden="true">{tag}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />Nghỉ phép</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-200" />Đóng cửa</span>
      </div>
    </div>
  );
}
