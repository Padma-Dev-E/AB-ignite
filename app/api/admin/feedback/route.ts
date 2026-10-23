import { desc, eq } from "drizzle-orm";
import { auth } from "../../../../auth";
import { db } from "../../../../src/db/connection";
import { feedbackResponses, users } from "../../../../src/db/schema";
import { ok, requestId } from "../../../../src/lib/http/errors";
import { feedbackAdmin, libraryApiError } from "../../../../src/lib/articles/http";
export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await feedbackAdmin(await auth(), request, id);
    const rows = await db.select({ id: feedbackResponses.id, campaignId: feedbackResponses.campaignId, userId: feedbackResponses.userId, userName: users.name, category: feedbackResponses.category, message: feedbackResponses.message, response: feedbackResponses.response, createdAt: feedbackResponses.createdAt, respondedAt: feedbackResponses.respondedAt }).from(feedbackResponses).innerJoin(users, eq(users.id, feedbackResponses.userId)).orderBy(desc(feedbackResponses.createdAt)).limit(100).all();
    return ok({ items: rows }, 200, id);
  } catch (error) { return libraryApiError(error, id); }
}
