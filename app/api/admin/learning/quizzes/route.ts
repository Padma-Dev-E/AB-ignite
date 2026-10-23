import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import { listAdminQuizPage } from "../../../../../src/lib/admin/service";
import { createQuiz, quizCreateSchema } from "../../../../../src/lib/admin/learning/authoring";
import { idempotencyKey, requestAuditMetadata } from "../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { z } from "zod";
export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(listAdminQuizPage(parsePage(new URL(request.url), 10)), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function POST(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const body = z.strictObject({ ...quizCreateSchema.shape, reason: z.unknown() }).parse(await request.json()); const { reason, ...input } = body; return ok(createQuiz({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, input, idempotencyKey(request)), 201, id); } catch (error) { return adminApiError(error, id); } }
