import { auth } from "../../../../auth";
import { getIdeaMinimumScore } from "../../../../src/lib/ideas/repository";
import { loadPriorityPolicy } from "../../../../src/lib/ideas/priority-policy-store";
import { apiError, handleApiError, ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    return ok({ ...loadPriorityPolicy(), minimumScore: await getIdeaMinimumScore() }, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
