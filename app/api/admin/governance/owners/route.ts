import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import { listBusinessOwners } from "../../../../../src/lib/admin/governance/service";
import { ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.GOVERNANCE_READ);
    const page = parsePage(new URL(request.url), 100);
    return ok(await listBusinessOwners({ userId: actor.userId, sessionId: actor.sessionId! }, page.limit, page.after), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
