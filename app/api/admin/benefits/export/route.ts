import { auth } from "../../../../../auth";
import {
  adminAccess,
  adminApiError,
  CAPABILITIES,
} from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import {
  exportCsvResponse,
  BENEFITS_EXPORT_HEADERS,
} from "../../../../../src/lib/admin/export";
import { listIdeaExportRows } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT);
    const page = listIdeaExportRows(parsePage(new URL(request.url), 1000));
    return exportCsvResponse({
      filename: "admin-benefits.csv",
      headers: BENEFITS_EXPORT_HEADERS,
      rows: page.items.map((row) => [
        row.id,
        row.reference,
        row.priorityScore,
        row.priorityBand,
        row.department,
        row.benefits,
        row.status,
        row.updatedAt.toISOString(),
      ]),
      requestId: id,
      nextAfter: page.nextAfter,
    });
  } catch (error) {
    return adminApiError(error, id);
  }
}
