import { z } from "zod";
import { auth } from "../../../../../auth";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { libraryContext, libraryApiError } from "../../../../../src/lib/articles/http";
import { completeArticle, LibraryError } from "../../../../../src/lib/articles/service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try { const context = await libraryContext(await auth(), request, id); const articleId = Number((await params).id); if (!Number.isInteger(articleId) || articleId < 1) throw new LibraryError("Invalid article id.", "VALIDATION_ERROR", 400); const body = z.object({ idempotencyKey: z.string().trim().min(8).max(200).optional() }).parse(await request.json()); const key = request.headers.get("idempotency-key") ?? body.idempotencyKey; if (!key) throw new LibraryError("An idempotency key is required.", "VALIDATION_ERROR", 400); return ok(await completeArticle(context, articleId, key), 200, id); }
  catch (error) { return libraryApiError(error, id); }
}
