import { asc, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scratchTodo } from "@/lib/db/schema";

const postBody = z.object({
  text: z.string().trim().min(1).max(512),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.scratchTodo.findMany({
    where: eq(scratchTodo.userId, session.user.id),
    orderBy: [asc(scratchTodo.sortOrder), asc(scratchTodo.createdAt)],
  });

  return NextResponse.json({
    todos: rows.map((r) => ({
      id: r.id,
      text: r.text,
      done: r.done,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = postBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [agg] = await db
    .select({ m: max(scratchTodo.sortOrder) })
    .from(scratchTodo)
    .where(eq(scratchTodo.userId, session.user.id));

  const nextOrder = (agg?.m ?? -1) + 1;

  const [row] = await db
    .insert(scratchTodo)
    .values({
      userId: session.user.id,
      text: parsed.data.text,
      sortOrder: nextOrder,
    })
    .returning();

  return NextResponse.json(
    {
      todo: {
        id: row!.id,
        text: row!.text,
        done: row!.done,
        createdAt: row!.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
