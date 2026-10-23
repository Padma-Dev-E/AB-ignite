import { auth } from "../../../../../auth";
import {
  adminAccess,
  adminApiError,
  CAPABILITIES,
} from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import {
  exportCsvResponse,
  FEEDBACK_EXPORT_HEADERS,
} from "../../../../../src/lib/admin/export";
import { listFeedbackExportRows } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = listFeedbackExportRows(parsePage(new URL(request.url), 1000));
    return exportCsvResponse({
      filename: "admin-feedback.csv",
      headers: FEEDBACK_EXPORT_HEADERS,
      rows: page.items.map((row) => [
        row.id,
        row.campaignId,
        row.userId,
        row.userName,
        row.department,
        row.category,
        row.message,
        row.response,
        row.createdAt.toISOString(),
        row.respondedAt?.toISOString() ?? null,
      ]),
      requestId: id,
      nextAfter: page.nextAfter,
    });
  } catch (error) {
    return adminApiError(error, id);
  }
}
