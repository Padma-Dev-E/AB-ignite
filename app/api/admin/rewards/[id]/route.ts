import { z } from "zod";
import { auth } from "../../../../../auth";
import { adminContext, requestAuditMetadata, rewardApiError } from "../../../../../src/lib/rewards/http";
import { updateReward } from "../../../../../src/lib/rewards/service";
import { requirePrivilegedReason } from "../../../../../src/lib/auth/authorization";
import { apiError, ok, requestId } from "../../../../../src/lib/http/errors";

const updateSchema = z.strictObject({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(500).nullable().optional(), kind: z.enum(["catalogue", "earned"]), cost: z.number().int().min(0), emoji: z.string().trim().max(20).nullable().optional(), active: z.boolean(), reason: z.unknown() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const context = await adminContext(await auth());
    const rewardId = Number((await params).id);
    if (!Number.isInteger(rewardId) || rewardId < 1) return apiError("validation_error", "Invalid reward ID.", 400, id);
    const input = updateSchema.parse(await request.json());
    const reason = requirePrivilegedReason(input.reason);
    return ok(await updateReward({ ...input, reason, rewardId, actorUserId: context.userId, sessionId: context.sessionId, ...requestAuditMetadata(request) }), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
