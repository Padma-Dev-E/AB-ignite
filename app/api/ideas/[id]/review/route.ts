import { z } from "zod";
import { auth } from "../../../../../auth";
import { recordHumanReview } from "../../../../../src/lib/ideas/repository";
import { transitionIdeaStatus } from "../../../../../src/lib/ideas/workflow";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";

const reviewSchema = z.strictObject({
  decision: z.enum(["approved", "returned", "rejected", "deferred"]),
  reason: z.string().trim().min(5).max(2_000),
  conflictAcknowledged: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id || session.isValid === false) return apiError("unauthorized", "Authentication required.", 401, id);
    if (session.user.role !== "admin") return apiError("forbidden", "Reviewer access required.", 403, id);
    const ideaId = Number((await params).id);
    const input = reviewSchema.parse(await request.json());
    const target = input.decision === "approved" ? "decision" : input.decision;
    const updated = await transitionIdeaStatus({ kind: "admin", id: session.user.id }, ideaId, target, input.reason);
    const review = await recordHumanReview({ ideaId, reviewerId: Number(session.user.id), decision: input.decision, reason: input.reason, conflictAcknowledged: input.conflictAcknowledged });
    return ok({ idea: updated, review }, 201, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
