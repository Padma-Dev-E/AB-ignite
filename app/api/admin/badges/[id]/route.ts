import { z } from "zod";
import { auth } from "../../../../../auth";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { updateAdminBadgeRule } from "../../../../../src/lib/rewards/badge-admin";
import { adminContext, idempotencyKey, requestAuditMetadata, rewardApiError } from "../../../../../src/lib/rewards/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await adminContext(await auth());
    const badgeId = Number((await params).id);
    const { reason, ...input } = z.record(z.string(), z.unknown()).parse(await request.json());
    const result = await updateAdminBadgeRule({ userId: context.userId, sessionId: context.sessionId!, reason, ...requestAuditMetadata(request) }, badgeId, input, idempotencyKey(request));
    return ok(result, 200, id);
  } catch (error) { return rewardApiError(error, id); }
}
