import { z } from "zod";
import { auth } from "../../../auth";
import { ok, requestId } from "../../../src/lib/http/errors";
import { libraryContext, libraryApiError } from "../../../src/lib/articles/http";
import { getFeedback, submitFeedback, LibraryError } from "../../../src/lib/articles/service";
export async function GET(request: Request) { const id = requestId(request); try { const ctx = await libraryContext(await auth(), request, id); return ok(await getFeedback(ctx.userId), 200, id); } catch (error) { return libraryApiError(error, id); } }
export async function POST(request: Request) { const id = requestId(request); try { const ctx = await libraryContext(await auth(), request, id); const body = z.object({ category: z.enum(["experience", "ideas", "content", "technical", "other"]), message: z.string().trim().min(1).max(4000), idempotencyKey: z.string().trim().min(8).max(200).optional() }).parse(await request.json()); const key = request.headers.get("idempotency-key") ?? body.idempotencyKey; if (!key) throw new LibraryError("An idempotency key is required.", "VALIDATION_ERROR", 400); return ok(await submitFeedback(ctx, { ...body, idempotencyKey: key }), 201, id); } catch (error) { return libraryApiError(error, id); } }
