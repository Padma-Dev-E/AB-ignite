import { auth } from "../../../../auth";
import { employeeContext, rewardApiError } from "../../../../src/lib/rewards/http";
import { getBadgeProgress } from "../../../../src/lib/rewards/service";
import { ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const context = await employeeContext(await auth());
    return ok(await getBadgeProgress(context.userId), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
