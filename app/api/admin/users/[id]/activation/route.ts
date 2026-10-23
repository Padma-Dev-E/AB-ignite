import { z } from "zod";
import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../src/lib/admin/query";
import { setUserActive } from "../../../../../../src/lib/admin/service";
import { requestAuditMetadata } from "../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

const inputSchema = z.strictObject({ active: z.boolean(), reason: z.unknown() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.USERS_MANAGE);
    const input = inputSchema.parse(await request.json());
    return ok(setUserActive({ userId: actor.userId, sessionId: actor.sessionId! }, positiveId((await params).id), input.active, input.reason, requestAuditMetadata(request)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
