import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tag } from "@/lib/db/schema";

const bodySchema = z.object({
  name: z.string().min(1).max(128),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.tag.findMany({
    where: eq(tag.userId, session.user.id),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return NextResponse.json({
    tags: rows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(tag)
      .values({
        userId: session.user.id,
        name: parsed.data.name,
        color: parsed.data.color ?? null,
      })
      .returning();
    return NextResponse.json({ id: row!.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Tag existiert bereits" }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await db
    .delete(tag)
    .where(and(eq(tag.id, id), eq(tag.userId, session.user.id)))
    .returning();
  if (!res.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
