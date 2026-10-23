import { auth } from "../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../src/lib/admin/http";
import { parsePage } from "../../../../src/lib/admin/query";
import { createUser, listUsers } from "../../../../src/lib/admin/service";
import { z } from "zod";
import { requestAuditMetadata } from "../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../src/lib/http/errors";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.USERS_READ);
    return ok(await listUsers(parsePage(new URL(request.url), 100)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}

const createSchema = z.strictObject({ name: z.string().trim().min(1).max(120), email: z.email().max(254), department: z.string().trim().min(1).max(120), jobTitle: z.string().trim().max(120).optional(), profile: z.enum(["employee", "reviewer", "business_owner", "control", "management", "admin"]), reason: z.unknown() });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.USERS_MANAGE);
    const { reason, ...input } = createSchema.parse(await request.json());
    return ok(await createUser({ userId: actor.userId, sessionId: actor.sessionId! }, input, reason, requestAuditMetadata(request)), 201, id);
  } catch (error) { return adminApiError(error, id); }
}
