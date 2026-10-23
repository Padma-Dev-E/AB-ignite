import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, auditFilters, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { csvForAudit } from "../../../../../src/lib/admin/query";
import { listAuditEvents } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = await listAuditEvents(auditFilters(new URL(request.url), 1000));
    return new Response(csvForAudit(page.items), { status: 200, headers: {
      "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="admin-audit.csv"',
      "cache-control": "no-store", "x-request-id": id,
      ...(page.nextAfter ? { "x-next-after": String(page.nextAfter) } : {}),
    } });
  } catch (error) { return adminApiError(error, id); }
}
