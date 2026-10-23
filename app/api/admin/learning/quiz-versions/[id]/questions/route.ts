import { auth } from "../../../../../../../auth";
import {
  adminAccess,
  adminApiError,
  CAPABILITIES,
} from "../../../../../../../src/lib/admin/http";
import { positiveId, AdminNotFoundError } from "../../../../../../../src/lib/admin/query";
import {
  getAdminQuizQuestions,
  updateAdminQuestion,
} from "../../../../../../../src/lib/admin/learning/service";
import {
  addQuestion,
  questionCreateSchema,
} from "../../../../../../../src/lib/admin/learning/authoring";
import {
  idempotencyKey,
  requestAuditMetadata,
} from "../../../../../../../src/lib/rewards/http";
import { ok, requestId } from "../../../../../../../src/lib/http/errors";
import { z } from "zod";
const schema = z.strictObject({
  questionId: z.number().int().positive(),
  reason: z.unknown(),
  prompt: z.string().trim().min(1).max(3000),
  topic: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(1000),
  points: z.number().int().min(0).max(10000),
  options: z
    .array(
      z.strictObject({
        optionKey: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(500),
        sortOrder: z.number().int().min(0).max(100),
        isCorrect: z.boolean(),
      }),
    )
    .min(2)
    .max(10)
    .refine(
      (options) => options.filter((option) => option.isCorrect).length === 1,
    ),
});
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = requestId(_request);
  try {
    await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    return ok(
      await getAdminQuizQuestions(positiveId((await params).id)),
      200,
      id,
    );
  } catch (error) {
    return adminApiError(error, id);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    const input = schema.parse(await request.json());
    const { reason, questionId, ...question } = input;
    const versionId = positiveId((await params).id);
    const questions = await getAdminQuizQuestions(versionId);
    if (!questions.some((item) => item.id === questionId)) {
      throw new AdminNotFoundError("Question not found in this quiz version.");
    }
    return ok(
      await updateAdminQuestion(
        {
          userId: actor.userId,
          sessionId: actor.sessionId!,
          reason,
          ...requestAuditMetadata(request),
        },
        questionId,
        question,
        idempotencyKey(request),
      ),
      200,
      id,
    );
  } catch (error) {
    return adminApiError(error, id);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = requestId(request);
  try {
    const actor = await adminAccess(await auth(), CAPABILITIES.SETTINGS_MANAGE);
    const body = questionCreateSchema
      .safeExtend({ reason: z.unknown() })
      .parse(await request.json());
    const { reason, ...question } = body;
    return ok(
      addQuestion(
        {
          userId: actor.userId,
          sessionId: actor.sessionId!,
          reason,
          ...requestAuditMetadata(request),
        },
        positiveId((await params).id),
        question,
        idempotencyKey(request),
      ),
      201,
      id,
    );
  } catch (error) {
    return adminApiError(error, id);
  }
}
