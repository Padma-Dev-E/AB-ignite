import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../../src/lib/admin/query";
import { createQuizVersion } from "../../../../../../../src/lib/admin/learning/authoring";
import { idempotencyKey, requestAuditMetadata } from "../../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../../src/lib/http/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    const { reason } = z.strictObject({ reason: z.unknown() }).parse(await request.json());
    return ok(createQuizVersion({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, positiveId((await params).id), idempotencyKey(request)), 201, id);
  } catch (error) { return adminApiError(error, id); }
}
