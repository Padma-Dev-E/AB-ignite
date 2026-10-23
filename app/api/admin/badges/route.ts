import { z } from "zod";
import { auth } from "../../../../auth";
import { ok, requestId } from "../../../../src/lib/http/errors";
import { createAdminBadgeRule, listAdminBadgeRules } from "../../../../src/lib/rewards/badge-admin";
import { adminContext, idempotencyKey, requestAuditMetadata, rewardApiError } from "../../../../src/lib/rewards/http";
import { db } from "../../../../src/db/connection";
import { badges } from "../../../../src/db/schema";
import { sql } from "drizzle-orm";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminContext(await auth());
    const url = new URL(request.url);
    const limit = z.coerce.number().int().min(1).max(10).parse(url.searchParams.get("limit") ?? "10");
    const afterRaw = url.searchParams.get("after");
    const after = afterRaw === null ? null : z.coerce.number().int().positive().safe().parse(afterRaw);
    const page = await listAdminBadgeRules({ limit, after });
    const total = db.select({ count: sql<number>`count(*)` }).from(badges).get()!.count;
    return ok({ ...page, total }, 200, id);
  } catch (error) { return rewardApiError(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const context = await adminContext(await auth());
    const { reason, ...input } = z.record(z.string(), z.unknown()).parse(await request.json());
    const result = await createAdminBadgeRule({ userId: context.userId, sessionId: context.sessionId!, reason, ...requestAuditMetadata(request) }, input, idempotencyKey(request));
    return ok(result, 201, id);
  } catch (error) { return rewardApiError(error, id); }
}
