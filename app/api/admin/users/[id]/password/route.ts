import { z } from "zod";
import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../src/lib/admin/query";
import { resetUserPassword } from "../../../../../../src/lib/admin/service";
import { requestAuditMetadata } from "../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

const schema = z.strictObject({ reason: z.unknown() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.USERS_MANAGE);
    const { reason } = schema.parse(await request.json());
    return ok(await resetUserPassword({ userId: actor.userId, sessionId: actor.sessionId! }, positiveId((await params).id), reason, requestAuditMetadata(request)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
