import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { csvForRecords, parsePage } from "../../../../../src/lib/admin/query";
import { listIdeaExportRows } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = listIdeaExportRows(parsePage(new URL(request.url), 1000));
    const csv = csvForRecords(["id", "reference", "priorityScore", "priorityBand", "department", "benefits", "status", "updatedAt"], page.items.map((row) => [row.id, row.reference, row.priorityScore, row.priorityBand, row.department, row.benefits, row.status, row.updatedAt.toISOString()]));
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="admin-benefits.csv"', "cache-control": "no-store", "x-request-id": id, ...(page.nextAfter ? { "x-next-after": String(page.nextAfter) } : {}) } });
  } catch (error) { return adminApiError(error, id); }
}
