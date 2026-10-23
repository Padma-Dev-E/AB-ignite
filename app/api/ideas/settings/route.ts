import { auth } from "../../../../auth";
import { getIdeaMinimumScore, setIdeaMinimumScore } from "../../../../src/lib/ideas/repository";
import { apiError, handleApiError, ok, requestId } from "../../../../src/lib/http/errors";
import { z } from "zod";

const schema = z.strictObject({ minimumScore: z.number().min(0).max(3) });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    return ok({ minimumScore: await getIdeaMinimumScore() }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    if (session.user.role !== "admin") return apiError("forbidden", "Administrator access required.", 403, id);
    const { minimumScore } = schema.parse(await request.json());
    await setIdeaMinimumScore({ kind: "admin", id: session.user.id }, minimumScore);
    return ok({ minimumScore }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}
