import { z } from "zod";
import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../src/lib/admin/query";
import { challengeUpdateSchema, updateChallenge } from "../../../../../../src/lib/admin/learning/authoring";
import { idempotencyKey, requestAuditMetadata } from "../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    const body = z.strictObject({ title: z.string().trim().min(1).max(240).optional(), question: z.string().trim().min(1).max(3000).optional(), deadlineAt: z.iso.datetime({ offset: true }).optional(), active: z.boolean().optional(), reason: z.unknown() }).parse(await request.json());
    const { reason, ...input } = body;
    return ok(updateChallenge({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, positiveId((await params).id), challengeUpdateSchema.parse(input), idempotencyKey(request)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
