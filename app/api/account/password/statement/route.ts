import { desc, eq } from 'drizzle-orm';
import { auth } from '../../../../../auth';
import { db } from '../../../../../src/db/connection';
import { pointsLedger } from '../../../../../src/db/schema';
import { libraryContext, libraryApiError } from '../../../../../src/lib/articles/http';
import { ok, requestId } from '../../../../../src/lib/http/errors';
export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const ctx = await libraryContext(await auth(), request, id);
    const page = Math.max(1, Math.min(100000, Number(new URL(request.url).searchParams.get('page')) || 1));
    const rows = db.select({ id: pointsLedger.id, amount: pointsLedger.amount, activity: pointsLedger.eventType, createdAt: pointsLedger.createdAt }).from(pointsLedger).where(eq(pointsLedger.userId, ctx.userId)).orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id)).limit(21).offset((Math.floor(page) - 1) * 20).all();
    return ok({ items: rows.slice(0, 20), hasMore: rows.length > 20 }, 200, id);
  } catch (error) { return libraryApiError(error, id); }
}
