import { auth } from "../../../../auth";
import { apiError, ok, requestId } from "../../../../src/lib/http/errors";
import { feedbackAdmin, libraryApiError } from "../../../../src/lib/articles/http";
import { listAdminFeedbackPage } from "../../../../src/lib/admin/service";
import { AdminInputError, parsePage } from "../../../../src/lib/admin/query";
export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await feedbackAdmin(await auth(), request, id);
    return ok(listAdminFeedbackPage(parsePage(new URL(request.url), 10)), 200, id);
  } catch (error) { return error instanceof AdminInputError ? apiError(error.code, error.message, error.status, id) : libraryApiError(error, id); }
}
