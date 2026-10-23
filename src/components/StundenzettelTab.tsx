import { savePdfFile } from "../lib/savePdfFile";
import { StundenOverviewPage } from "./StundenOverviewPage";
import { useState } from "react";
import type { UseScheduleReturn } from "../hooks/useSchedule";
import { StundenzettelPage } from "./StundenzettelPage";
import { SchedulePrintPage } from "./SchedulePrintPage";
import { buildDienstplanPdf, buildStundenzettelPdf, safeFileName } from "../lib/pdf";
import { datesOfMonth } from "../lib/demand";
import { monthLabel } from "../lib/shiftOps";

export function StundenzettelTab({ store }: { store: UseScheduleReturn }) {
  const { schedule, isLocked, unlockMonth } = store;

  // ── Auswahl: WER (eine Person oder der ganze Laden) und WAS ─────────────
  // who: "all" = ganzer Laden, sonst eine employeeId.
  const [who, setWho] = useState<string>("all");
  const [what, setWhat] = useState<"stundenzettel" | "month">("stundenzettel");

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
  const [readyPdf, setReadyPdf] = useState<{ filename: string; blob: Blob } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  function finishPdf(doc: Awaited<ReturnType<typeof buildStundenzettelPdf>>, filename: string) {
    setReadyPdf({ filename, blob: doc.output("blob") });
    setSaveNote(null);
  }

  async function onSavePdf() {
    if (!readyPdf || savingPdf) return;
    setSavingPdf(true);
    setPdfError(null);
    setSaveNote(null);
    try {
      const result = await savePdfFile(readyPdf.blob, readyPdf.filename);
      if (result === "shared") setSaveNote("Đã hoàn tất lưu / chia sẻ PDF.");
      else if (result === "saved") setSaveNote("Đã lưu PDF.");
      else if (result === "download") setSaveNote("Đã gửi yêu cầu tải file xuống trình duyệt.");
    } catch (error) {
      setPdfError(`Không lưu được PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingPdf(false);
    }
  }

  /** Zweiter Klick für das Entsperren – ohne native Dialoge, siehe unten. */
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const monthTag = `${schedule.year}-${String(schedule.month).padStart(2, "0")}`;

  // Für WER: die betroffenen Mitarbeiter (Reihenfolge wie im Plan).
  const chosenEmployees =
    who === "all"
      ? schedule.employees
      : schedule.employees.filter((e) => e.id === who);
  // Für die Vorschau und die Dateinamen: eine konkrete Person.
  const previewEmployee =
    who === "all" ? schedule.employees[0] ?? null : chosenEmployees[0] ?? null;
  const employeeIds = who === "all" ? undefined : [who];
  const whoTag = who === "all" ? "tat_ca" : safeFileName(previewEmployee?.name ?? who);

  const dates = datesOfMonth(schedule.year, schedule.month);
  const previewTitle = monthLabel(schedule.year, schedule.month);
  const isTimesheet = what === "stundenzettel";

  async function onPdf() {
    if (!chosenEmployees.length || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    setReadyPdf(null);
    setSaveNote(null);
    setPdfProgress("");
    try {
      const doc = isTimesheet
        ? await buildStundenzettelPdf(schedule, chosenEmployees, {}, (current, total) => {
            if (total > 1) setPdfProgress(`${current}/${total}`);
          })
        : buildDienstplanPdf(schedule, { dates, title: previewTitle, layout: "byDate", employeeIds });
      finishPdf(doc, `${isTimesheet ? "Stundenzettel" : "Dienstplan"}_${whoTag}_${monthTag}.pdf`);
    } catch (error) {
      setPdfError(`Không tạo được PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPdfBusy(false);
      setPdfProgress("");
    }
  }

  if (schedule.employees.length === 0) {
    return (
      <div className="no-print rounded bg-white border border-slate-200 p-6 text-center text-slate-400">
        Vui lòng thêm nhân viên và tạo lịch làm việc trước.
      </div>
    );
  }

  const hasSchedule = schedule.shifts.length > 0;
  return (
    <>
      {/* Điều khiển (không in) */}
      <div className="no-print">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Loại tài liệu">
              {([{id:"stundenzettel",label:"Bảng chấm công"},{id:"month",label:"Lịch làm việc"}] as const).map(item => {
                const active = item.id === "stundenzettel" ? isTimesheet : !isTimesheet;
                return <button key={item.id} type="button" aria-pressed={active}
                  onClick={() => setWhat(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  {item.label}
                </button>;
              })}
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <select aria-label="Nhân viên" value={who} onChange={e => setWho(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm sm:flex-none">
                <option value="all">Cả quán ({schedule.employees.length} người)</option>
                {schedule.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button type="button" disabled={pdfBusy || !hasSchedule} onClick={onPdf}
                className="ml-auto shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                {pdfBusy ? `Đang tạo PDF${pdfProgress ? ` (${pdfProgress})` : "…"}` : "Xuất PDF"}
              </button>
            </div>
          </div>
          {!hasSchedule && <p className="text-xs text-slate-500">Chưa có lịch. Sang tab Lịch để tạo.</p>}

          {isLocked && (
            <div className="mt-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
              <div className="font-medium">
                Lịch tháng này đã khóa vì đã in
                {schedule.lockedAt &&
                  ` lúc ${new Date(schedule.lockedAt).toLocaleString("vi-VN")}`}
                .
              </div>
              <div className="mt-0.5">
                Không sửa được ca, không đổi nhân viên. Vẫn in được bình thường. (Tạo lại lịch ở tab
                „Lịch làm việc" cũng sẽ mở khóa.)
              </div>

              {/*
                Bewusst KEIN window.confirm: In-App-Browser (Messenger,
                Facebook) unterdrücken die native Rückfrage teilweise. Sie
                liefert dann stillschweigend false, der Klick tut nichts, und
                niemand erfährt warum. Die Rückfrage steht deshalb direkt hier.
              */}
              {!confirmUnlock ? (
                <button
                  onClick={() => setConfirmUnlock(true)}
                  className="mt-2 rounded border border-amber-400 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Mở khóa
                </button>
              ) : (
                <div className="mt-2 rounded border border-amber-300 bg-white px-3 py-2">
                  <div className="text-amber-900">
                    Mở khóa lịch tháng này? Bản đã in ở quán sẽ không còn khớp với hệ thống. Sau
                    khi sửa, hãy in lại tuần đó và thay bản cũ.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        unlockMonth();
                        setConfirmUnlock(false);
                      }}
                      className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Xác nhận mở khóa
                    </button>
                    <button
                      onClick={() => setConfirmUnlock(false)}
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {pdfError && <div role="alert" className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{pdfError}</div>}
        {readyPdf && <div role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">PDF đã sẵn sàng</p><p className="mt-1 break-all text-xs">{readyPdf.filename}</p></div>
            <button type="button" aria-label="Đóng PDF đã sẵn sàng" onClick={() => setReadyPdf(null)} className="text-sm underline">Đóng</button>
          </div>
          {saveNote && <p className="mt-2 text-xs">{saveNote}</p>}
          <div className="mt-3 flex gap-2 text-sm">
            <button type="button" onClick={() => void onSavePdf()} disabled={savingPdf} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50">{savingPdf ? "Đang lưu…" : "Lưu"}</button>
          </div>
        </div>}

        <div className="mb-2 text-xs text-slate-500">
          Xem trước {isTimesheet ? "bảng chấm công" : "lịch làm việc"} · {previewTitle}
          {isTimesheet && <> · {who === "all" ? `${chosenEmployees.length} nhân viên` : previewEmployee?.name}</>}
        </div>
        <div className="document-preview rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
          {isTimesheet ? <>
            <StundenOverviewPage schedule={schedule} dates={dates} title={previewTitle} employeeIds={employeeIds} />
            {chosenEmployees.map(employee => <StundenzettelPage key={employee.id} schedule={schedule} employee={employee}
              dates={dates} periodLabel={previewTitle} />)}
          </> : <SchedulePrintPage schedule={schedule} dates={dates} title={previewTitle}
              layout="byDate" employeeIds={employeeIds} />}
        </div>
      </div>


    </>
  );
}
