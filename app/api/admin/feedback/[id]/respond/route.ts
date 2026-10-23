import { z } from "zod";
import { auth } from "../../../../../../auth";
import { ok, requestId } from "../../../../../../src/lib/http/errors";
import { feedbackAdmin, libraryApiError } from "../../../../../../src/lib/articles/http";
import { respondToFeedback } from "../../../../../../src/lib/articles/service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const id = requestId(request); try { const ctx = await feedbackAdmin(await auth(), request, id); const responseId = Number((await params).id); if (!Number.isInteger(responseId) || responseId < 1) throw new Error("Invalid feedback id"); const body = z.object({ response: z.string().trim().min(1).max(2000) }).parse(await request.json()); return ok(await respondToFeedback(ctx, responseId, body.response), 200, id); } catch (error) { return libraryApiError(error, id); } }
