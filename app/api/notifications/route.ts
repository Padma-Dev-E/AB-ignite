import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Session } from "next-auth";
import { auth } from "../../../auth";
import { db } from "../../../src/db/connection";
import { notifications } from "../../../src/db/schema";
import { apiError, handleApiError, ok, requestId } from "../../../src/lib/http/errors";

const querySchema = z.strictObject({
  page: z.preprocess((value) => value === undefined || value === "" ? 1 : Number(value), z.number().int().min(1)),
  pageSize: z.preprocess((value) => value === undefined || value === "" ? 20 : Math.min(Number(value), 50), z.number().int().min(1)),
  unreadOnly: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  }, z.boolean().default(false)),
});
const updateSchema = z.strictObject({ id: z.number().int().positive().optional(), read: z.boolean().default(true), all: z.boolean().default(false) });

function userIdOf(session: Session | null) { const id = Number(session?.user?.id); return session?.user?.id && Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth(); const userId = userIdOf(session);
    if (!userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const where = query.unreadOnly ? and(eq(notifications.userId, userId), eq(notifications.isRead, false)) : eq(notifications.userId, userId);
    const offset = (query.page - 1) * query.pageSize;
    const [items, countRows, unreadRows] = await Promise.all([
      db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(query.pageSize).offset(offset).all(),
      db.select({ count: sql<number>`count(*)` }).from(notifications).where(where).all(),
      db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))).all(),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize), unreadCount: Number(unreadRows[0]?.count ?? 0) }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth(); const userId = userIdOf(session);
    if (!userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const input = updateSchema.parse(await request.json());
    if (!input.id && !input.all) return apiError("validation_error", "A notification ID or all=true is required.", 400, id);
    if (input.all) await db.update(notifications).set({ isRead: input.read, updatedAt: new Date() }).where(eq(notifications.userId, userId)).run();
    else await db.update(notifications).set({ isRead: input.read, updatedAt: new Date() }).where(and(eq(notifications.id, input.id!), eq(notifications.userId, userId))).run();
    return ok({ updated: true }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}
