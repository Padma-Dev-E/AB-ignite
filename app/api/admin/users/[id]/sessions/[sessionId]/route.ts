import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../../src/lib/admin/query";
import { revokeUserSession } from "../../../../../../../src/lib/admin/service";
import { requestAuditMetadata } from "../../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../../src/lib/http/errors";

const schema = z.strictObject({ reason: z.unknown() });

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SESSIONS_REVOKE);
    const { reason } = schema.parse(await request.json());
    const ids = await params;
    return ok(revokeUserSession({ userId: actor.userId, sessionId: actor.sessionId! }, positiveId(ids.id), positiveId(ids.sessionId), reason, requestAuditMetadata(request)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
