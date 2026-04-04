import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarEvent, eventAttachment } from "@/lib/db/schema";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  fileKey: z.string().min(1).max(512),
  url: z.url().max(2048),
  name: z.string().min(1).max(512),
  mimeType: z.string().max(128).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ev = await db.query.calendarEvent.findFirst({
    where: and(
      eq(calendarEvent.id, parsed.data.eventId),
      eq(calendarEvent.userId, session.user.id),
    ),
  });
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const [row] = await db
    .insert(eventAttachment)
    .values({
      userId: session.user.id,
      eventId: parsed.data.eventId,
      fileKey: parsed.data.fileKey,
      url: parsed.data.url,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType ?? null,
      sizeBytes: parsed.data.sizeBytes ?? null,
    })
    .returning();

  return NextResponse.json({ id: row!.id }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const ev = await db.query.calendarEvent.findFirst({
    where: and(eq(calendarEvent.id, eventId), eq(calendarEvent.userId, session.user.id)),
  });
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.query.eventAttachment.findMany({
    where: and(eq(eventAttachment.eventId, eventId), eq(eventAttachment.userId, session.user.id)),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });

  return NextResponse.json({
    attachments: rows.map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
