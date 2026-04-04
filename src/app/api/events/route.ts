import { and, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarEvent, eventTag, recurrenceRule, reminder } from "@/lib/db/schema";
import { expandRecurringInWindow } from "@/lib/recurrence/expand";

const createBody = z.object({
  title: z.string().min(1).max(512),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(512).nullable().optional(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  allDay: z.boolean().optional(),
  timeZone: z.string().max(64).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  reminders: z.array(z.object({ offsetMinutes: z.number().int().min(0).max(10080) })).optional(),
  recurrence: z
    .object({
      frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]),
      interval: z.number().int().min(1).max(365).optional(),
      until: z.iso.datetime().nullable().optional(),
      count: z.number().int().min(1).max(500).nullable().optional(),
      byWeekday: z.array(z.number().int().min(0).max(6)).nullable().optional(),
      customRRule: z.string().max(2048).nullable().optional(),
    })
    .optional(),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const fromS = url.searchParams.get("from");
  const toS = url.searchParams.get("to");
  if (!fromS || !toS) {
    return NextResponse.json({ error: "from and to (ISO) required" }, { status: 400 });
  }
  const fromDate = new Date(fromS);
  const toDate = new Date(toS);
  if (Number.isNaN(+fromDate) || Number.isNaN(+toDate) || fromDate >= toDate) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }

  const userId = session.user.id;

  const singles = await db.query.calendarEvent.findMany({
    where: and(
      eq(calendarEvent.userId, userId),
      eq(calendarEvent.isRecurrenceMaster, false),
      isNull(calendarEvent.recurrenceRuleId),
      lt(calendarEvent.startAt, toDate),
      gt(calendarEvent.endAt, fromDate),
    ),
    with: {
      eventTags: { with: { tag: true } },
      reminders: true,
    },
  });

  const masters = await db.query.calendarEvent.findMany({
    where: and(
      eq(calendarEvent.userId, userId),
      eq(calendarEvent.isRecurrenceMaster, true),
      isNotNull(calendarEvent.recurrenceRuleId),
    ),
    with: {
      recurrenceRule: true,
      eventTags: { with: { tag: true } },
    },
  });

  const expanded: ReturnType<typeof expandRecurringInWindow> = [];
  for (const m of masters) {
    if (!m.recurrenceRule) continue;
    const tagIds = m.eventTags.map((et: { tagId: string }) => et.tagId);
    expanded.push(
      ...expandRecurringInWindow(m, m.recurrenceRule, fromDate, toDate, tagIds),
    );
  }

  const simplePayload = singles.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    timeZone: e.timeZone,
    color: e.color ?? "#6366f1",
    tagIds: e.eventTags.map((t: { tagId: string }) => t.tagId),
    reminders: e.reminders.map((r: { id: string; offsetMinutes: number }) => ({
      id: r.id,
      offsetMinutes: r.offsetMinutes,
    })),
    isExpandedInstance: false as const,
  }));

  const expandedPayload = expanded.map((e) => ({
    id: e.id,
    masterId: e.masterId,
    title: e.title,
    description: e.description,
    location: e.location,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    timeZone: e.timeZone,
    color: e.color ?? "#6366f1",
    tagIds: e.tagIds,
    reminders: [] as { id: string; offsetMinutes: number }[],
    isExpandedInstance: true as const,
  }));

  return NextResponse.json({ events: [...simplePayload, ...expandedPayload] });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const b = parsed.data;
  const userId = session.user.id;
  const startAt = new Date(b.startAt);
  const endAt = new Date(b.endAt);

  if (endAt <= startAt) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

  const tagIds = b.tagIds ?? [];

  const created = await db.transaction(async (tx) => {
    let ruleId: string | null = null;
    if (b.recurrence) {
      const [rule] = await tx
        .insert(recurrenceRule)
        .values({
          userId,
          frequency: b.recurrence.frequency,
          interval: b.recurrence.interval ?? 1,
          byWeekday: b.recurrence.byWeekday ?? null,
          until: b.recurrence.until ? new Date(b.recurrence.until) : null,
          count: b.recurrence.count ?? null,
          customRRule: b.recurrence.customRRule ?? null,
        })
        .returning();
      ruleId = rule!.id;
    }

    const [ev] = await tx
      .insert(calendarEvent)
      .values({
        userId,
        title: b.title,
        description: b.description ?? null,
        location: b.location ?? null,
        startAt,
        endAt,
        allDay: b.allDay ?? false,
        timeZone: b.timeZone ?? null,
        color: b.color ?? "#6366f1",
        recurrenceRuleId: ruleId,
        isRecurrenceMaster: Boolean(b.recurrence),
      })
      .returning();

    if (tagIds.length) {
      await tx.insert(eventTag).values(tagIds.map((tagId) => ({ eventId: ev!.id, tagId })));
    }

    if (b.reminders?.length) {
      await tx.insert(reminder).values(
        b.reminders.map((r) => ({
          userId,
          eventId: ev!.id,
          offsetMinutes: r.offsetMinutes,
        })),
      );
    }

    return ev!;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
