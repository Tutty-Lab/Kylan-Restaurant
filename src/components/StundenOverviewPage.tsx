import type { Schedule } from "../types";
import { hourOverview, OVERVIEW_NOTE } from "../lib/hourOverview";
import { minutesToDecimalHours } from "../lib/time";

export function StundenOverviewPage({ schedule, dates, title, employeeIds }: {
  schedule: Schedule; dates: string[]; title: string; employeeIds?: string[];
}) {
  const rows = hourOverview(schedule, dates, employeeIds);
  const sum = (key: "total" | "sunday") => rows.reduce((n, r) => n + r[key], 0);
  const night = rows.some(r => r.night === null) ? null : rows.reduce((n, r) => n + r.night!, 0);
  const hours = (n: number | null) => n === null ? "— *" : minutesToDecimalHours(n);
  const cell = "border border-slate-300 px-3 py-2";
  return <div className="stundenzettel-page bg-white text-slate-900 mx-auto max-w-[210mm] p-6 text-[12px]">
    <header className="border-b-2 border-slate-800 pb-3 mb-5">
      <h2 className="text-xl font-bold">Stundenübersicht</h2>
      <p>{schedule.companyName}</p><p className="text-slate-500">{schedule.address}</p><p className="mt-2">{title}</p>
    </header>
    <table className="w-full border-collapse text-right">
      <thead className="bg-slate-100"><tr>{["Mitarbeiter", "Gesamtstunden", "Nachtstunden (ab 20 Uhr)", "Sonntagsstunden"].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.employee.id}><td className={`${cell} text-left`}>{r.employee.name}</td><td className={cell}>{hours(r.total)}</td><td className={cell}>{hours(r.night)}</td><td className={cell}>{hours(r.sunday)}</td></tr>)}</tbody>
      <tfoot className="bg-slate-100 font-bold"><tr><td className={`${cell} text-left`}>Summe</td><td className={cell}>{hours(sum("total"))}</td><td className={cell}>{hours(night)}</td><td className={cell}>{hours(sum("sunday"))}</td></tr></tfoot>
    </table><p className="mt-4 text-[10px] text-slate-500">{OVERVIEW_NOTE}</p>
  </div>;
}
