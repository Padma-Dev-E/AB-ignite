import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import { listAdminQuizzes } from "../../../../../src/lib/admin/learning/service";
import { ok, requestId } from "../../../../../src/lib/http/errors";
export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(await listAdminQuizzes(parsePage(new URL(request.url), 100)), 200, id); } catch (error) { return adminApiError(error, id); } }
