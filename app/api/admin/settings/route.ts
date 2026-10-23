import { auth } from "../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../src/lib/admin/http";
import { adminSettingsPatchSchema } from "../../../../src/lib/admin/settings/request-schema";
import { getAdminSettings, updateAdminSettings } from "../../../../src/lib/admin/settings/service";
import { requestAuditMetadata } from "../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(await getAdminSettings(), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function PATCH(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const input = adminSettingsPatchSchema.parse(await request.json()); return ok(await updateAdminSettings({ userId: actor.userId, sessionId: actor.sessionId!, reason: input.reason, ...requestAuditMetadata(request) }, input), 200, id); } catch (error) { return adminApiError(error, id); } }
