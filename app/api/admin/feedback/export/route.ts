import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { csvForRecords, parsePage } from "../../../../../src/lib/admin/query";
import { listFeedbackExportRows } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = listFeedbackExportRows(parsePage(new URL(request.url), 1000));
    const csv = csvForRecords(["id", "campaignId", "userId", "userName", "department", "category", "message", "response", "createdAt", "respondedAt"], page.items.map((row) => [row.id, row.campaignId, row.userId, row.userName, row.department, row.category, row.message, row.response, row.createdAt.toISOString(), row.respondedAt?.toISOString() ?? null]));
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="admin-feedback.csv"', "cache-control": "no-store", "x-request-id": id, ...(page.nextAfter ? { "x-next-after": String(page.nextAfter) } : {}) } });
  } catch (error) { return adminApiError(error, id); }
}
