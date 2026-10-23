import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { setCampaignActive } from "../../../../../src/lib/admin/engagement/service";
import { listAdminCampaignPage, parseAdminOffsetPage } from "../../../../../src/lib/admin/service";
import { idempotencyKey, requestAuditMetadata } from "../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { z } from "zod";

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(listAdminCampaignPage(parseAdminOffsetPage(new URL(request.url))), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function PATCH(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const body = z.strictObject({ campaignId: z.number().int().positive(), active: z.boolean(), reason: z.unknown() }).parse(await request.json()); const { reason, ...input } = body; return ok(setCampaignActive({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, input.campaignId, input.active, idempotencyKey(request)), 200, id); } catch (error) { return adminApiError(error, id); } }
