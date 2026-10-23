import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../../../src/lib/admin/query";
import { decideGovernance } from "../../../../../../../src/lib/admin/governance/service";
import { ok, requestId } from "../../../../../../../src/lib/http/errors";

const schema = z.object({ action: z.enum(["route", "return", "reject", "defer", "approve", "not_recommended", "confirm"]), reason: z.string().trim().min(1).max(500), businessOwnerId: z.number().int().positive().optional() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ ideaId: string }> }) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.GOVERNANCE_MANAGE); const ideaId = positiveId((await params).ideaId); const body = schema.parse(await request.json()); return ok(await decideGovernance({ userId: actor.userId, sessionId: actor.sessionId!, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") }, ideaId, body.action, body.reason, body.businessOwnerId), 200, id); } catch (error) { return adminApiError(error, id); } }
