import { z } from "zod";
import { auth } from "../../../../../auth";
import { adminContext, rewardApiError } from "../../../../../src/lib/rewards/http";
import { getAdminRedemptions } from "../../../../../src/lib/rewards/service";
import { ok, requestId } from "../../../../../src/lib/http/errors";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20), status: z.enum(["requested", "fulfilled", "cancelled"]).optional() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminContext(await auth());
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return ok(await getAdminRedemptions(query.page, query.pageSize, query.status), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
