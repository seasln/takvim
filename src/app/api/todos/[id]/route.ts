import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scratchTodo } from "@/lib/db/schema";

const patchBody = z.object({
  done: z.boolean().optional(),
  text: z.string().trim().min(1).max(512).optional(),
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

  const existing = await db.query.scratchTodo.findFirst({
    where: and(eq(scratchTodo.id, id), eq(scratchTodo.userId, session.user.id)),
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = parsed.data;
  await db
    .update(scratchTodo)
    .set({
      ...(b.done !== undefined ? { done: b.done } : {}),
      ...(b.text !== undefined ? { text: b.text } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(scratchTodo.id, id), eq(scratchTodo.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const res = await db
    .delete(scratchTodo)
    .where(and(eq(scratchTodo.id, id), eq(scratchTodo.userId, session.user.id)))
    .returning({ id: scratchTodo.id });

  if (res.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
