import { z } from "zod";
import { auth } from "../../../../auth";
import { employeeContext, idempotencyKey, requestAuditMetadata, rewardApiError } from "../../../../src/lib/rewards/http";
import { getRedemptions, requestRedemption } from "../../../../src/lib/rewards/service";
import { apiError, ok, requestId } from "../../../../src/lib/http/errors";

const createSchema = z.strictObject({ rewardId: z.number().int().positive(), idempotencyKey: z.string().trim().max(200).optional() });
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const context = await employeeContext(await auth());
    const query = pageSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return ok(await getRedemptions(context.userId, query.page, query.pageSize), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const context = await employeeContext(await auth());
    const input = createSchema.parse(await request.json());
    const key = idempotencyKey(request, input.idempotencyKey);
    if (!key) return apiError("validation_error", "An Idempotency-Key header is required.", 400, id);
    return ok(await requestRedemption({ userId: context.userId, rewardId: input.rewardId, idempotencyKey: key, actorUserId: context.userId, sessionId: context.sessionId, ...requestAuditMetadata(request) }), 201, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
