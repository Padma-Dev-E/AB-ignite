import { auth } from "../../../../auth";
import { ok, requestId } from "../../../../src/lib/http/errors";
import { employeeContext, rewardApiError } from "../../../../src/lib/rewards/http";
import { getEmployeePointsSummary } from "../../../../src/lib/rewards/service";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const context = await employeeContext(await auth());
    return ok(await getEmployeePointsSummary(context.userId), 200, id);
  } catch (error) {
    return rewardApiError(error, id);
  }
}
