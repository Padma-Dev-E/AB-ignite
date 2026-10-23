import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../../src/lib/admin/query";
import { listTransformationQueue, requireGovernanceRole } from "../../../../../../src/lib/admin/governance/service";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

export async function GET(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.GOVERNANCE_READ); await requireGovernanceRole({ userId: actor.userId, sessionId: actor.sessionId! }, ["back_office"]); const page = parsePage(new URL(request.url), 100); return ok(await listTransformationQueue(page.limit, page.after), 200, id); } catch (error) { return adminApiError(error, id); } }
