import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarEvent, eventTag, recurrenceRule, reminder } from "@/lib/db/schema";

const patchBody = z.object({
  title: z.string().min(1).max(512).optional(),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(512).nullable().optional(),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().optional(),
  allDay: z.boolean().optional(),
  timeZone: z.string().max(64).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.query.calendarEvent.findFirst({
    where: and(eq(calendarEvent.id, id), eq(calendarEvent.userId, session.user.id)),
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.isRecurrenceMaster) {
    return NextResponse.json(
      { error: "Serien-Master nicht direkt verschieben — nutze Einzelausnahme (demnächst)." },
      { status: 409 },
    );
  }

  const b = parsed.data;
  const startAt = b.startAt ? new Date(b.startAt) : undefined;
  const endAt = b.endAt ? new Date(b.endAt) : undefined;
  if (startAt && endAt && endAt <= startAt) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }
  if ((startAt || endAt) && (!startAt || !endAt)) {
    const s = startAt ?? existing.startAt;
    const e = endAt ?? existing.endAt;
    if (e <= s) return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(calendarEvent)
      .set({
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.location !== undefined ? { location: b.location } : {}),
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
        ...(b.allDay !== undefined ? { allDay: b.allDay } : {}),
        ...(b.timeZone !== undefined ? { timeZone: b.timeZone } : {}),
        ...(b.color !== undefined ? { color: b.color } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(calendarEvent.id, id), eq(calendarEvent.userId, session.user.id)));

    if (b.tagIds) {
      await tx.delete(eventTag).where(eq(eventTag.eventId, id));
      if (b.tagIds.length) {
        await tx.insert(eventTag).values(b.tagIds.map((tagId) => ({ eventId: id, tagId })));
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.query.calendarEvent.findFirst({
    where: and(eq(calendarEvent.id, id), eq(calendarEvent.userId, session.user.id)),
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ruleId = existing.recurrenceRuleId;

  await db.transaction(async (tx) => {
    await tx.delete(reminder).where(eq(reminder.eventId, id));
    await tx.delete(eventTag).where(eq(eventTag.eventId, id));
    await tx.delete(calendarEvent).where(eq(calendarEvent.id, id));
    if (ruleId) {
      await tx.delete(recurrenceRule).where(eq(recurrenceRule.id, ruleId));
    }
  });

  return NextResponse.json({ ok: true });
}
