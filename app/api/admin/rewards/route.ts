import { z } from "zod";
import { auth } from "../../../../auth";
import { adminContext, rewardApiError } from "../../../../src/lib/rewards/http";
import { createReward, getAdminCatalogue } from "../../../../src/lib/rewards/service";
import { requirePrivilegedReason } from "../../../../src/lib/auth/authorization";
import { apiError, ok, requestId } from "../../../../src/lib/http/errors";

const createSchema = z.strictObject({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(500).nullable().optional(), kind: z.enum(["redeem", "earned"]), cost: z.number().int().min(0), emoji: z.string().trim().max(20).nullable().optional(), active: z.boolean().default(true), reason: z.unknown() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminContext(await auth());
    return ok(await getAdminCatalogue(), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const context = await adminContext(await auth());
    const input = createSchema.parse(await request.json());
    const reason = requirePrivilegedReason(input.reason);
    return ok(await createReward({ ...input, reason, actorUserId: context.userId, sessionId: context.sessionId }), 201, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
