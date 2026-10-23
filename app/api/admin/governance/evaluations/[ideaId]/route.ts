import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../src/lib/admin/query";
import { getEvaluation } from "../../../../../../src/lib/admin/governance/service";
import { ok, requestId } from "../../../../../../src/lib/http/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ ideaId: string }> }) { const id = requestId(_request); try { const actor = await adminAccess(await auth(), CAPABILITIES.GOVERNANCE_READ); return ok(await getEvaluation(positiveId((await params).ideaId), { userId: actor.userId, sessionId: actor.sessionId! }), 200, id); } catch (error) { return adminApiError(error, id); } }
