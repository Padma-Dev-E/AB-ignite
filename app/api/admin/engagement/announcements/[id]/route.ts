import { auth } from "../../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../../src/lib/admin/http";
import { setAnnouncementPinned } from "../../../../../../src/lib/admin/engagement/service";
import { idempotencyKey, requestAuditMetadata } from "../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../src/lib/http/errors";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const body = z.strictObject({ pinned: z.boolean(), reason: z.unknown() }).parse(await request.json()); const { reason, pinned } = body; return ok(setAnnouncementPinned({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, Number((await params).id), pinned, idempotencyKey(request)), 200, id); } catch (error) { return adminApiError(error, id); } }
