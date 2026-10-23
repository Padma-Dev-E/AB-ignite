import { auth } from "../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../src/lib/admin/http";
import { getAdminAnalytics } from "../../../../src/lib/admin/service";
import { ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.AUDIT_READ); return ok(await getAdminAnalytics(), 200, id); } catch (error) { return adminApiError(error, id); } }
