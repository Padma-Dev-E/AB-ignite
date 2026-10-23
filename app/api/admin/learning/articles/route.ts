import { z } from "zod";
import { auth } from "../../../../../auth";
import {
  adminAccess,
  adminApiError,
  CAPABILITIES,
} from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import {
  createAdminArticle,
  listAdminArticles,
} from "../../../../../src/lib/admin/learning/service";
import {
  idempotencyKey,
  requestAuditMetadata,
} from "../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../src/lib/http/errors";
const article = z.strictObject({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(2000),
  body: z.string().trim().min(1).max(30000),
  category: z.string().trim().min(1).max(100),
  topic: z.string().trim().max(120).nullable().optional(),
  publisher: z.string().trim().min(1).max(200),
  difficulty: z.string().trim().min(1).max(60),
  readingMinutes: z.number().int().min(1).max(600),
  publishedLabel: z.string().trim().max(100).nullable().optional(),
  url: z.string().trim().max(2048).nullable().optional(),
  published: z.boolean(),
  contentType: z.enum(["internal", "external"]),
  categoryCode: z.string().trim().min(1).max(80),
});
export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    return ok(
      await listAdminArticles(parsePage(new URL(request.url), 100)),
      200,
      id,
    );
  } catch (error) {
    return adminApiError(error, id);
  }
}
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    const input = z
      .strictObject({ ...article.shape, reason: z.unknown() })
      .parse(await request.json());
    const { reason, ...data } = input;
    return ok(
      await createAdminArticle(
        {
          userId: actor.userId,
          sessionId: actor.sessionId!,
          reason,
          ...requestAuditMetadata(request),
        },
        data,
        idempotencyKey(request),
      ),
      201,
      id,
    );
  } catch (error) {
    return adminApiError(error, id);
  }
}
