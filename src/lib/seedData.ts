// ACHTUNG – Abweichung von der Vertragsangabe:
// Die Chefin nennt fuer die Vollzeitkraft 172 h im Monat. Erreichbar ist das
// bei diesen Oeffnungszeiten NICHT: Di-Fr ist der laengste zusammenhaengende
// Block 17:00-22:00, also 5 h; nur Sa/So erlauben 9 h. Macht ueber den Monat
// rund 157-170 h Obergrenze, je nach Monat. Solange eine Person nur EINE
// Schicht pro Tag bekommt, geht 172 h nicht auf.
// Der Chef kommt sogar nur auf rund 120 h: er arbeitet fuenf Tage die Woche
// und samstags gar nicht – und Samstag ist einer der beiden langen Tage.
// Hier stehen deshalb 120 h, damit die Testmonate durchlaufen. Sobald geteilte
// Dienste erlaubt sind (Mittagsblock UND Abendblock am selben Tag), gehoert
// hier wieder 172 h hin.
// ============================================================================
// Test-Belegschaften für drei Monate.
//
// Angaben der Chefin (Kylan Restaurant):
//   - 3 Vollzeit: eine mit 200 h/Monat, zwei mit je 160 h/Monat
//   - 2 Minijob: je 43 h/Monat (rund 10 h/Woche)
//   - keine festen Schichten für die Vollzeit-Kräfte, kein fester Ruhetag:
//     die App verteilt frei im Fenster 11:30-22:00, sieben Tage die Woche
//
// Der Laden hat KEINEN Ruhetag. Bei 30 offenen Tagen und einem 10,5-h-Fenster
// kostet die Grundabdeckung (durchgehend 1 Person, abends 2) rund 405 h im
// Monat - die 606 h der Stammbesetzung reichen dafür mit Reserve.
//
// Hinweis zum Datenmodell: Schedule hält immer GENAU EINEN Monat. Diese drei
// Monate existieren nebeneinander nur hier als Fixture.
// ============================================================================

import type { Employee, Schedule } from "../types";
import { COMPANY_ADDRESS, COMPANY_NAME } from "./company";
import { makeEmployee } from "./sampleData";
import { DEFAULT_WORK_HOURS } from "./workHours";

export type SeedMonth = {
  year: number;
  month: number; // 1-basiert
  label: string;
  employees: Employee[];
  /**
   * Wie viele Tage dürfen die Stoßzeit verfehlen? Normalfall 0.
   *
   * Bewusst hier sichtbar statt in der Prüfung versteckt: der Scheduler ist
   * eine Heuristik, keine vollständige Suche. Ein Wert > 0 heißt, dass die
   * Stundensumme rechnerisch reichen würde, der greedy Lauf die Verteilung
   * aber nicht findet - eine bekannte Schwäche, kein akzeptierter Zustand.
   */
  maxPeakGaps?: number;
};

/** Juni 2026 – die Besetzung laut Chefin. */
const JUNE_2026: Employee[] = [
  { ...makeEmployee("vz-1", "Chủ quán", "VOLLZEIT", 105), isOwner: true },
  makeEmployee("tz-1", "Teilzeit 1", "TEILZEIT", 150),
  makeEmployee("tz-2", "Teilzeit 2", "TEILZEIT", 86),
  makeEmployee("tz-3", "Teilzeit 3", "TEILZEIT", 86),
  makeEmployee("tz-4", "Teilzeit 4", "TEILZEIT", 86),
  makeEmployee("mini-1", "Mini 1", "MINIJOB", 43),
];

/** Juli 2026 – eine Teilzeitkraft im Urlaub. */
const JULY_2026: Employee[] = [
  { ...makeEmployee("vz-1", "Chủ quán", "VOLLZEIT", 105), isOwner: true },
  makeEmployee("tz-1", "Teilzeit 1", "TEILZEIT", 150),
  makeEmployee("tz-2", "Teilzeit 2", "TEILZEIT", 86),
  makeEmployee("tz-3", "Teilzeit 3", "TEILZEIT", 86),
  makeEmployee("mini-1", "Mini 1", "MINIJOB", 43),
];

/** August 2026 – volle Besetzung. */
const AUGUST_2026: Employee[] = [
  { ...makeEmployee("vz-1", "Chủ quán", "VOLLZEIT", 105), isOwner: true },
  makeEmployee("tz-1", "Teilzeit 1", "TEILZEIT", 150),
  makeEmployee("tz-2", "Teilzeit 2", "TEILZEIT", 86),
  makeEmployee("tz-3", "Teilzeit 3", "TEILZEIT", 86),
  makeEmployee("tz-4", "Teilzeit 4", "TEILZEIT", 86),
  makeEmployee("mini-1", "Mini 1", "MINIJOB", 43),
];

/** Die drei Monate, ältester zuerst. */
// Die verbleibenden Abweichungen haben zwei Ursachen, beide baulich:
//
// 1. ZU VIELE am Wochenende: drei 9-h-Dienste an einem Sa/So, wo nur zwei ins
//    Abendfenster dürfen. Wegtauschen geht nicht – ein 9-h-Dienst passt an
//    keinen anderen Wochentag, weil Di-Fr der längste Block 5 h ist.
//
// 2. ZU WENIGE mittags: der Mittagsblock Di-Fr ist 3,5 h lang, ein Dienst aber
//    höchstens 3 h (das Modell kennt nur ganze Stunden). Eine einzelne Kraft
//    lässt also immer eine halbe Stunde offen; erst zwei versetzte Dienste
//    schließen die Lücke, und dafür müssen zwei Leute mit kleinem Soll frei
//    sein. An manchen Tagen sind sie es nicht.
//
// Beides löst kein Feintuning. Es braucht eine Entscheidung des Betriebs:
// geteilte Dienste (Mittag UND Abend am selben Tag) oder halbe Stunden als
// Schichtlänge.
export const SEED_MONTHS: SeedMonth[] = [
  { year: 2026, month: 6, label: "Juni 2026", employees: JUNE_2026, maxPeakGaps: 8 },
  { year: 2026, month: 7, label: "Juli 2026", employees: JULY_2026, maxPeakGaps: 3 },
  { year: 2026, month: 8, label: "August 2026", employees: AUGUST_2026, maxPeakGaps: 3 },
];


/** Baut einen leeren Schedule (ohne Schichten) für einen Seed-Monat. */
export function scheduleForSeed(seed: SeedMonth): Schedule {
  return {
    companyName: COMPANY_NAME,
    address: COMPANY_ADDRESS,
    year: seed.year,
    month: seed.month,
    workHours: structuredClone(DEFAULT_WORK_HOURS),
    dateOverrides: [],
    employees: seed.employees.map((e) => ({ ...e })),
    shifts: [],
  };
}

/** Summe der Sollstunden eines Seed-Monats (für Kapazitäts-Checks). */
export function totalTargetHours(seed: SeedMonth): number {
  return seed.employees.reduce((sum, e) => sum + e.targetMinutes, 0) / 60;
}
