import { addDays, format, parseISO, startOfDay } from "date-fns";
import type { CalendarEventDTO } from "@/types/calendar";

export function resolveEventColor(e: CalendarEventDTO): string {
  const c = e.color?.trim();
  if (c && /^#[0-9A-Fa-f]{6}$/i.test(c)) return c;
  return "#6366f1";
}

/** Kalendertag [day 00:00, nächster Tag 00:00) schneidet [startAt, endAt). */
export function eventIntersectsCalendarDay(e: CalendarEventDTO, day: Date): boolean {
  const a = parseISO(e.startAt).getTime();
  const b = parseISO(e.endAt).getTime();
  const ds = startOfDay(day).getTime();
  const de = addDays(startOfDay(day), 1).getTime();
  return a < de && b > ds;
}

export function eventsForCalendarDay(
  events: CalendarEventDTO[],
  day: Date,
): CalendarEventDTO[] {
  return events
    .filter((e) => eventIntersectsCalendarDay(e, day))
    .sort((x, y) => +parseISO(x.startAt) - +parseISO(y.startAt));
}

/** Pro Tag: wie viele Termine diesen Tag (auch mehrtägig) berühren. */
export function countByDayKey(events: CalendarEventDTO[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    let d = startOfDay(parseISO(e.startAt));
    for (let i = 0; i < 400 && eventIntersectsCalendarDay(e, d); i++) {
      const key = format(d, "yyyy-MM-dd");
      m.set(key, (m.get(key) ?? 0) + 1);
      d = addDays(d, 1);
    }
  }
  return m;
}
