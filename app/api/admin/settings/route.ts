import { z } from "zod";
import { auth } from "../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../src/lib/admin/http";
import { getAdminSettings, updateAdminSettings } from "../../../../src/lib/admin/settings/service";
import { requestAuditMetadata } from "../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../src/lib/http/errors";

const schema = z.strictObject({
  reason: z.unknown(),
  priority: z.record(z.string().max(80), z.string().max(4000)).optional(),
  pointRules: z.array(z.strictObject({ code: z.string().trim().min(1).max(80), points: z.number().int().min(0).max(100000), active: z.boolean() })).max(100).optional(),
  recommendationRules: z.array(z.strictObject({ topic: z.string().trim().min(1).max(120), thresholdPercent: z.number().int().min(0).max(100), reasonTemplate: z.string().trim().min(1).max(500), active: z.boolean() })).max(200).optional(),
});

export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); return ok(await getAdminSettings(), 200, id); } catch (error) { return adminApiError(error, id); } }
export async function PATCH(request: Request) { const id = requestId(request); try { const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE); const input = schema.parse(await request.json()); return ok(await updateAdminSettings({ userId: actor.userId, sessionId: actor.sessionId!, reason: input.reason, ...requestAuditMetadata(request) }, input), 200, id); } catch (error) { return adminApiError(error, id); } }
