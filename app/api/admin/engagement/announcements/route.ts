import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { createAnnouncement } from "../../../../../src/lib/admin/engagement/service";
import { listAdminAnnouncementPage, parseAdminOffsetPage } from "../../../../../src/lib/admin/service";
import { idempotencyKey, requestAuditMetadata } from "../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../src/lib/http/errors";
import { z } from "zod";

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(listAdminAnnouncementPage(parseAdminOffsetPage(new URL(request.url))), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function POST(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const body = z.strictObject({ title: z.string(), body: z.string(), reason: z.unknown() }).parse(await request.json()); const { reason, ...input } = body; return ok(createAnnouncement({ userId: actor.userId, sessionId: actor.sessionId!, reason, ...requestAuditMetadata(request) }, input, idempotencyKey(request)), 201, id); } catch (error) { return adminApiError(error, id); } }
