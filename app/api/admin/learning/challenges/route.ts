import { z } from "zod";
import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { challengeCreateSchema, createChallenge } from "../../../../../src/lib/admin/learning/authoring";
import { listAdminChallengePage } from "../../../../../src/lib/admin/service";
import { parsePage } from "../../../../../src/lib/admin/query";
import { idempotencyKey, requestAuditMetadata } from "../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(listAdminChallengePage(parsePage(new URL(request.url), 10)), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function POST(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const body = z.strictObject({ ...challengeCreateSchema.shape, reason: z.unknown() }).parse(await request.json()); const { reason, ...input } = body; return ok(createChallenge({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, input, idempotencyKey(request)), 201, id); } catch (error) { return adminApiError(error, id); } }
