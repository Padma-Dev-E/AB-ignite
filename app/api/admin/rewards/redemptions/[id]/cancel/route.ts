import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { adminContext, idempotencyKey, rewardApiError } from "../../../../../../../src/lib/rewards/http";
import { cancelRedemption } from "../../../../../../../src/lib/rewards/service";
import { requirePrivilegedReason } from "../../../../../../../src/lib/auth/authorization";
import { apiError, ok, requestId } from "../../../../../../../src/lib/http/errors";

const schema = z.strictObject({ reason: z.unknown(), idempotencyKey: z.string().trim().max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await adminContext(await auth());
    const redemptionId = Number((await params).id);
    if (!Number.isInteger(redemptionId) || redemptionId < 1) return apiError("validation_error", "Invalid redemption ID.", 400, id);
    const input = schema.parse(await request.json());
    const key = idempotencyKey(request, input.idempotencyKey);
    if (!key) return apiError("validation_error", "An Idempotency-Key header is required.", 400, id);
    const reason = requirePrivilegedReason(input.reason);
    return ok(await cancelRedemption({ actorUserId: context.userId, sessionId: context.sessionId, redemptionId, reason, idempotencyKey: key }), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
