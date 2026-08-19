// ============================================================================
// Zentrale Datentypen. Intern wird IMMER in Minuten (Integer) gerechnet,
// niemals mit Fließkomma-Stunden.
// ============================================================================

import type { DateOverride, WorkHoursConfig } from "./lib/workHours";

/**
 * Anstellungsart. MINIJOB ist arbeitsrechtlich eine Form der Teilzeit und wird
 * bei der Schichtplanung auch genauso behandelt – die Trennung dient der
 * Obergrenze und der Belegschaftsstruktur, nicht der Planung selbst.
 */
export type EmploymentType = "VOLLZEIT" | "TEILZEIT" | "MINIJOB";

/**
 * Für Kylan gibt es BEWUSST keine Zahlengrenzen bei der Belegschaft:
 * weder eine Obergrenze für die Anzahl der Beschäftigten noch eine eigene
 * Stundendecke für Minijobs.
 *
 * Andere Filialen haben so etwas, weil der Betrieb es ausdrücklich gesagt hat
 * ("höchstens 3 Stammkräfte und 5 Minijobs"). Hier wurde nur die heutige
 * Besetzung genannt. Die vertraglichen 43 h einer Minijob-Kraft stehen ohnehin
 * als deren Monats-Soll in der Mitarbeiterliste – eine zusätzliche Prüfung
 * dagegen wäre doppelt gemoppelt und würde beim Einstellen einer weiteren
 * Kraft grundlos meckern.
 *
 * MINIJOB bleibt als Anstellungsart erhalten: sie steht auf dem Stundenzettel
 * und in der Lohnabrechnung, nur eben ohne eigene Grenze.
 */

export type ShiftType = "EARLY" | "LATE" | "CUSTOM";

export type Employee = {
  id: string;
  name: string;
  employmentType: EmploymentType;
  /**
   * Ist diese Person der Chef?
   *
   * Der Chef arbeitet mit und zaehlt bei der Besetzung ganz normal mit – auch
   * bei der Obergrenze der Stosszeit. Fuer ihn gelten aber zwei eigene Regeln:
   * fuenf Arbeitstage je Woche, und samstags ist er nicht im Laden.
   */
  isOwner?: boolean;
  /** Monatliches Soll in Minuten (Integer). 176 h => 10560. */
  targetMinutes: number;
  /**
   * Häkchen „Lưu" in der Mitarbeiterliste: vom Nutzer gesetzte Bestätigung,
   * dass die Daten dieser Person geprüft und übernommen sind. Rein als Merker
   * gedacht – auf die Planung hat das Feld keinen Einfluss.
   */
  saved?: boolean;
};

export type Shift = {
  id: string;
  employeeId: string;
  /** ISO-Datum "yyyy-MM-dd". */
  date: string;
  startMinutes: number;
  endMinutes: number;
  pauseMinutes: number;
  /** Bezahlte Arbeitszeit in Minuten = presence - pause. */
  paidMinutes: number;
  shiftType: ShiftType;
  /** true = automatisch generiert, false = manuell hinzugefügt/geändert. */
  generated: boolean;
};

export type Schedule = {
  companyName: string;
  /** Anschrift des Betriebs (erscheint auf dem Stundenzettel). */
  address: string;
  year: number;
  /** 1-basiert: 1 = Januar ... 12 = Dezember. */
  month: number;
  /** Arbeitszeit-Fenster (giờ làm) je Wochentag + Feiertag. */
  workHours: WorkHoursConfig;
  /** Ausnahmen für einzelne Daten (geschlossen / abweichende Zeiten). */
  dateOverrides: DateOverride[];
  employees: Employee[];
  shifts: Shift[];
  /**
   * Zeitpunkt der ersten Wochen-Ausgabe (ISO). Gesetzt = der Monat ist
   * gesperrt und darf nicht mehr geändert werden.
   *
   * Hintergrund: sobald eine Woche ausgedruckt im Laden hängt, muss der Stand
   * im System exakt dem Papier entsprechen – bei einer Kontrolle wird genau
   * das verglichen. Entsperren geht nur bewusst über die Oberfläche.
   */
  lockedAt?: string;
  /** Bereits gedruckte Wochen, als ISO-Datum des jeweiligen Montags. */
  printedWeeks?: string[];
};

/** Ein einzelnes zu verplanendes Schicht-Token (Ergebnis von splitTargetHours). */
export type ShiftToken = {
  employeeId: string;
  paidMinutes: number;
};

/** So viele Tage je Woche arbeitet der Chef. */
export const OWNER_DAYS_PER_WEEK = 5;

/** An diesem Wochentag ist der Chef nicht im Laden. */
export const OWNER_FREE_WEEKDAY = "saturday" as const;
