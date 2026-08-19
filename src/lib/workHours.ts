// ============================================================================
// Arbeitszeit-Fenster (giờ làm) je Wochentag + Feiertag. Das ist das Fenster,
// in dem Schichten geplant werden dürfen (Früh am Fenster-Beginn, Spät am
// Fenster-Ende). Feiertage (Sachsen) werden für Nachfrage & Spätquote wie Sonntag
// behandelt, verwenden aber ihr eigenes Zeitfenster.
// ============================================================================

import { parseIsoDate, weekdayKeyOf, type WeekdayKey } from "./demand";

export type DayWindow = { startMinutes: number; endMinutes: number };

export type WorkHoursConfig = {
  perWeekday: Record<WeekdayKey, DayWindow>;
  holiday: DayWindow;
  /**
   * Wochentage, an denen der Laden grundsätzlich geschlossen ist (kein Dienst).
   * VietHaus hat KEINEN festen Ruhetag – alle Wochentage stehen auf false.
   * Ein Datum-Override mit eigenen Zeiten kann
   * einen einzelnen Tag trotzdem schließen oder anders belegen (z.B. Urlaub).
   */
  closedWeekdays: Record<WeekdayKey, boolean>;
};

/**
 * Ausnahme für ein konkretes Datum (überschreibt Wochentag/Feiertag).
 * closed = an diesem Tag wird nicht geplant (z.B. Betriebsruhe);
 * window = abweichende Arbeitszeiten (z.B. halber Tag).
 */
export type DateOverride = {
  date: string; // ISO yyyy-MM-dd
  closed: boolean;
  window?: DayWindow;
  note?: string;
};

export type OverrideMap = Record<string, DateOverride>;

export type ResolvedDay = { closed: boolean; window: DayWindow };

const w = (start: number, end: number): DayWindow => ({ startMinutes: start, endMinutes: end });

// Vorgaben des Chefs (Kylan Restaurant), Öffnungszeiten:
//   Montag        geschlossen
//   Dienstag–Freitag  11:30–15:00 UND 17:00–22:00   (zwei Blöcke!)
//   Samstag, Sonntag  13:00–22:00
//   Feiertag          15:00–22:00
//
// ACHTUNG – bekannte Lücke: das Datenmodell kennt je Wochentag GENAU EIN
// Zeitfenster (DayWindow = start + end). Die geteilte Öffnung Di–Fr lässt sich
// damit nicht abbilden. Hier steht deshalb der äußere Rahmen 11:30–22:00, und
// der Scheduler darf Dienste auch in die Mittagsschließung 15:00–17:00 legen –
// das ist FALSCH und muss vor dem Echteinsatz behoben werden. Der saubere Weg
// ist, DayWindow zu einer Liste von Fenstern zu erweitern.
const WEEKDAY_MIDDAY = w(11 * 60 + 30, 22 * 60); // Rahmen Di–Fr (siehe oben)
const WEEKEND = w(13 * 60, 22 * 60); // Sa + So durchgehend
const HOLIDAY = w(15 * 60, 22 * 60); // Feiertag

export const DEFAULT_WORK_HOURS: WorkHoursConfig = {
  perWeekday: {
    monday: { ...WEEKDAY_MIDDAY }, // geschlossen, Fenster nur als Rückfall
    tuesday: { ...WEEKDAY_MIDDAY },
    wednesday: { ...WEEKDAY_MIDDAY },
    thursday: { ...WEEKDAY_MIDDAY },
    friday: { ...WEEKDAY_MIDDAY },
    saturday: { ...WEEKEND },
    sunday: { ...WEEKEND },
  },
  holiday: { ...HOLIDAY },
  closedWeekdays: {
    monday: true, // Kylan: montags geschlossen
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  },
};

/**
 * Für Nachfrage/Spätquote maßgeblicher Wochentag: Feiertage zählen wie Sonntag
 * (der Nutzer gruppiert „Sonntag & Feiertag").
 */
export function effectiveWeekdayKey(isoDate: string, holidays: Set<string>): WeekdayKey {
  if (holidays.has(isoDate)) return "sunday";
  return weekdayKeyOf(parseIsoDate(isoDate));
}

/** Arbeitszeit-Fenster für ein konkretes Datum (berücksichtigt Feiertage). */
export function resolveWorkWindow(
  config: WorkHoursConfig,
  isoDate: string,
  holidays: Set<string>,
): DayWindow {
  if (holidays.has(isoDate)) return config.holiday;
  return config.perWeekday[weekdayKeyOf(parseIsoDate(isoDate))];
}

/**
 * Vollständige Auflösung eines Tages inkl. Ausnahmen:
 * Ausnahme geschlossen > Ausnahme eigene Zeiten > geschlossener Wochentag
 * (z.B. Sonntag) > Feiertag > Wochentag.
 */
export function resolveDay(
  config: WorkHoursConfig,
  isoDate: string,
  holidays: Set<string>,
  overrides: OverrideMap = {},
): ResolvedDay {
  const ov = overrides[isoDate];
  if (ov?.closed) return { closed: true, window: { startMinutes: 0, endMinutes: 0 } };
  // Ein Override mit eigenen Zeiten öffnet den Tag auch dann, wenn der
  // Wochentag sonst geschlossen wäre (z.B. Sonderöffnung an einem Sonntag).
  if (ov?.window) return { closed: false, window: ov.window };
  const weekday = weekdayKeyOf(parseIsoDate(isoDate));
  if (config.closedWeekdays?.[weekday]) {
    return { closed: true, window: { startMinutes: 0, endMinutes: 0 } };
  }
  return { closed: false, window: resolveWorkWindow(config, isoDate, holidays) };
}

/** Ist der Laden an diesem Datum geschlossen? (für die Anzeige in der UI). */
export function isDayClosed(
  config: WorkHoursConfig,
  isoDate: string,
  holidays: Set<string>,
  overrides: OverrideMap = {},
): boolean {
  return resolveDay(config, isoDate, holidays, overrides).closed;
}

/** Tiefe Kopie mit Auffüllen fehlender Felder (für Migration alter Speicherstände). */
export function normalizeWorkHours(partial: Partial<WorkHoursConfig> | undefined): WorkHoursConfig {
  const base = DEFAULT_WORK_HOURS;
  const perWeekday = { ...base.perWeekday };
  if (partial?.perWeekday) {
    for (const key of Object.keys(perWeekday) as WeekdayKey[]) {
      const v = partial.perWeekday[key];
      if (v && typeof v.startMinutes === "number" && typeof v.endMinutes === "number") {
        perWeekday[key] = { startMinutes: v.startMinutes, endMinutes: v.endMinutes };
      }
    }
  }
  const holiday =
    partial?.holiday &&
    typeof partial.holiday.startMinutes === "number" &&
    typeof partial.holiday.endMinutes === "number"
      ? { ...partial.holiday }
      : { ...base.holiday };

  const closedWeekdays = { ...base.closedWeekdays };
  if (partial?.closedWeekdays) {
    for (const key of Object.keys(closedWeekdays) as WeekdayKey[]) {
      const v = partial.closedWeekdays[key];
      if (typeof v === "boolean") closedWeekdays[key] = v;
    }
  }
  return { perWeekday, holiday, closedWeekdays };
}
