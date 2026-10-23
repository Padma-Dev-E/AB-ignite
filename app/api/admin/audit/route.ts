import { auth } from "../../../../auth";
import { adminAccess, adminApiError, auditFilters, CAPABILITIES } from "../../../../src/lib/admin/http";
import { listAuditEvents } from "../../../../src/lib/admin/service";
import { ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_READ);
    return ok(await listAuditEvents(auditFilters(new URL(request.url), 100)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
