import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { parsePage, positiveId } from "../../../../../../src/lib/admin/query";
import { listUserSessions } from "../../../../../../src/lib/admin/service";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.SESSIONS_READ);
    return ok(await listUserSessions(positiveId((await params).id), parsePage(new URL(request.url), 10)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
