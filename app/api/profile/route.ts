import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Session } from "next-auth";
import { auth } from "../../../auth";
import { db } from "../../../src/db/connection";
import { users } from "../../../src/db/schema";
import { apiError, handleApiError, ok, requestId } from "../../../src/lib/http/errors";

const updateSchema = z.strictObject({ name: z.string().trim().min(1).max(120).optional(), department: z.string().trim().min(1).max(120).optional(), jobTitle: z.string().trim().max(120).nullable().optional() });

function safeUser(user: typeof users.$inferSelect) { const { passwordHash: _passwordHash, ...safe } = user; return safe; }
function userIdOf(session: Session | null) { const id = Number(session?.user?.id); return session?.user?.id && Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth(); const userId = userIdOf(session);
    if (!userId || session?.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1).all();
    if (!user) return apiError("unauthorized", "Authentication required.", 401, id);
    return ok(safeUser(user), 200, id);
  } catch (error) { return handleApiError(error, id); }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth(); const userId = userIdOf(session);
    if (!userId || session?.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    const input = updateSchema.parse(await request.json());
    if (!Object.keys(input).length) return apiError("validation_error", "At least one profile field is required.", 400, id);
    const [user] = await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, userId)).returning().all();
    if (!user) return apiError("unauthorized", "Authentication required.", 401, id);
    return ok(safeUser(user), 200, id);
  } catch (error) { return handleApiError(error, id); }
}
