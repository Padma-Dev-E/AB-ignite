import { auth } from "../../../../../auth";
import {
  adminAccess,
  adminApiError,
  CAPABILITIES,
} from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import {
  exportCsvResponse,
  IDEAS_EXPORT_HEADERS,
} from "../../../../../src/lib/admin/export";
import { listIdeaExportRows } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = listIdeaExportRows(parsePage(new URL(request.url), 1000));
    return exportCsvResponse({
      filename: "admin-ideas.csv",
      headers: IDEAS_EXPORT_HEADERS,
      rows: page.items.map((row) => [
        row.id,
        row.reference,
        row.status,
        row.priorityBand,
        row.priorityScore,
        row.authorId,
        row.authorName,
        row.department,
        row.title,
        row.summary,
        row.benefits,
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
      ]),
      requestId: id,
      nextAfter: page.nextAfter,
    });
  } catch (error) {
    return adminApiError(error, id);
  }
}
