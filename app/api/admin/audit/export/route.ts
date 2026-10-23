import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, auditFilters, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { csvForSafeAudit } from "../../../../../src/lib/audit/export";
import { listAuditEvents } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const url = new URL(request.url);
    const filters = auditFilters(url, 1000);
    const page = await listAuditEvents(filters);
    return new Response(csvForSafeAudit(page.items), { status: 200, headers: {
      "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="admin-audit.csv"',
      "cache-control": "no-store", "x-request-id": id,
      ...(page.nextAfter ? { "x-next-after": String(page.nextAfter) } : {}),
    } });
  } catch (error) { return adminApiError(error, id); }
}
