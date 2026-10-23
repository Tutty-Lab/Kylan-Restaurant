import { useMemo } from "react";
import type { Schedule } from "../types";
import { KYLAN_COVERAGE_WINDOWS, kylanDayCoverage } from "../lib/kylanDiagnostics";
import { analyzeSchedule } from "../lib/analyze";

export function KylanCoverageRows({ schedule, dates }: { schedule: Schedule; dates: string[] }) {
  const rows = useMemo(() => KYLAN_COVERAGE_WINDOWS.map(w => ({...w,
    cells: dates.map(date => kylanDayCoverage(schedule, date, w.from, w.to)),
  })), [schedule, dates]);
  const analysis = useMemo(() => analyzeSchedule({...schedule,
    overrides: Object.fromEntries(schedule.dateOverrides.map(o => [o.date,o])),
  }), [schedule]);
  return <>
    {rows.map(w => <tr key={w.key} className="bg-slate-50 text-slate-600">
      <th scope="row" className="sticky left-0 z-10 bg-slate-50 border-t border-r border-slate-200 px-2 py-1 text-left font-medium whitespace-nowrap">{w.label}</th>
      <td className="border-t border-slate-200" /><td className="border-t border-slate-200" />
      {w.cells.map((c,i) => <td key={dates[i]}
        title={c ? `${dates[i]}: ít nhất ${c.min}, đông nhất ${c.max} người có mặt` : "Không có giờ mở cửa trong khung này"}
        className={`border-t border-l border-slate-200 px-1 py-1 text-center ${!c ? "text-slate-300" : c.min === 0 ? "bg-rose-50 text-rose-700 font-semibold" : c.min === 1 ? "bg-amber-50 text-amber-800" : ""}`}>
        {c ? c.min === c.max ? c.min : `${c.min}–${c.max}` : "–"}
        {c?.min === 0 && <span className="block text-[10px]">trống</span>}
      </td>)}
      <td className="border-t border-l border-slate-200" /><td className="border-t border-l border-slate-200" />
    </tr>)}
    <tr className="bg-slate-50 text-slate-600">
      <th scope="row" className="sticky left-0 z-10 bg-slate-50 border-t border-r border-slate-200 px-2 py-1 text-left font-medium">Cao điểm · cần 1–5</th>
      <td className="border-t border-slate-200" /><td className="border-t border-slate-200" />
      {dates.map(date => {
        const peaks = analysis.days.find(d => d.date === date)?.peaks ?? [];
        const ok = peaks.every(p => p.ok);
        return <td key={date} title={peaks.map(p => `${p.label}: ${p.minStaff}–${p.maxStaff}, yêu cầu ${p.required}–${p.allowed}`).join("; ")}
          className={`border-t border-l border-slate-200 px-1 py-1 text-center ${!peaks.length ? "text-slate-300" : ok ? "text-emerald-700" : "bg-rose-50 text-rose-700 font-semibold"}`}>
          {peaks.length ? ok ? "✓" : "Lệch" : "–"}
        </td>;
      })}
      <td className="border-t border-l border-slate-200" /><td className="border-t border-l border-slate-200" />
    </tr>
  </>;
}
