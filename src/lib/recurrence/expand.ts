import { addDays, addMonths, addWeeks, addYears, isBefore, min } from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import type { calendarEvent, recurrenceRule } from "@/lib/db/schema";

type EventRow = InferSelectModel<typeof calendarEvent>;
type RuleRow = InferSelectModel<typeof recurrenceRule>;

export type ExpandedOccurrence = {
  id: string;
  masterId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  timeZone: string | null;
  color: string;
  tagIds: string[];
  isExpandedInstance: true;
};

function durationMs(start: Date, end: Date) {
  return end.getTime() - start.getTime();
}

/** Expand masters with recurrence into [windowStart, windowEnd). Best-effort: DAILY, WEEKLY, MONTHLY, YEARLY. */
export function expandRecurringInWindow(
  master: EventRow,
  rule: RuleRow,
  windowStart: Date,
  windowEnd: Date,
  tagIds: string[],
): ExpandedOccurrence[] {
  if (!master.recurrenceRuleId || !rule) return [];
  const len = durationMs(master.startAt, master.endAt);
  const until = rule.until ? min([rule.until, windowEnd]) : windowEnd;
  const cap = rule.count ?? 500;
  const out: ExpandedOccurrence[] = [];
  let cursor = master.startAt;
  let n = 0;

  while (cursor < windowStart && n < cap * 2) {
    const step = Math.max(1, rule.interval);
    switch (rule.frequency) {
      case "DAILY":
        cursor = addDays(cursor, step);
        break;
      case "WEEKLY":
        cursor = addWeeks(cursor, step);
        break;
      case "MONTHLY":
        cursor = addMonths(cursor, step);
        break;
      case "YEARLY":
        cursor = addYears(cursor, step);
        break;
      default:
        cursor = addWeeks(cursor, step);
        break;
    }
    n++;
  }

  n = 0;
  while (isBefore(cursor, until) && n < cap && out.length < 400) {
    const occEnd = new Date(cursor.getTime() + len);
    if (occEnd > windowStart && cursor < windowEnd) {
      out.push({
        id: `${master.id}::${cursor.toISOString()}`,
        masterId: master.id,
        title: master.title,
        description: master.description,
        location: master.location,
        startAt: cursor,
        endAt: occEnd,
        allDay: master.allDay,
        timeZone: master.timeZone,
        color: master.color,
        tagIds,
        isExpandedInstance: true,
      });
    }

    const step = Math.max(1, rule.interval);
    switch (rule.frequency) {
      case "DAILY":
        cursor = addDays(cursor, step);
        break;
      case "WEEKLY":
        cursor = addWeeks(cursor, step);
        break;
      case "MONTHLY":
        cursor = addMonths(cursor, step);
        break;
      case "YEARLY":
        cursor = addYears(cursor, step);
        break;
      default:
        cursor = addWeeks(cursor, step);
        break;
    }
    n++;
    if (isBefore(until, master.startAt)) break;
  }

  return out;
}

