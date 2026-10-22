import { z } from "zod";
import { IdeaValidationOutputSchema } from "../../ideas/schemas";
import { defineIdeaJob, ideaInputSchema, objectResponseSchema, reviewSystemBoundary } from "./helpers";

const humanGatedValidationSchema = IdeaValidationOutputSchema.transform((value) => {
  const highRisk = value.risks.some((risk) => risk.severity === "high" || risk.severity === "critical");
  if ((highRisk || value.confidence < 0.5) && value.decision !== "needs_human_review") {
    return { ...value, decision: "needs_human_review" as const, recommendedStatus: "business_review" as const };
  }
  return value;
});

export const ideaValidateJob = defineIdeaJob({
  key: "idea.validate",
  inputSchema: ideaInputSchema,
  outputSchema: humanGatedValidationSchema,
  systemPrompt: `${reviewSystemBoundary} Score novelty, problem clarity, customer and employee impact, strategic alignment, feasibility, value, risk, urgency, and scalability from 0 to 5. Return decision support with evidence gaps, risks, questions, route, impact, and next actions. High risk or low confidence must require human review; never make a final bank decision.`,
  responseJsonSchema: objectResponseSchema({
    decision: { type: "string", enum: ["accept", "needs_clarification", "needs_human_review", "reject"] },
    recommendedStatus: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, overallScore: { type: "number", minimum: 0, maximum: 100 },
    scores: { type: "object" }, strengths: { type: "array", items: { type: "string" } }, gaps: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "object" } }, risks: { type: "array", items: { type: "object" } },
    duplicates: { type: "array", items: { type: "object" } }, recommendedRoute: { type: "object" }, estimatedImpact: { type: "object" }, nextActions: { type: "array", items: { type: "object" } }, auditSummary: { type: "string" },
  }, ["decision", "recommendedStatus", "confidence", "overallScore", "scores", "strengths", "gaps", "assumptions", "questions", "risks", "duplicates", "recommendedRoute", "estimatedImpact", "nextActions", "auditSummary"]),
});

export type IdeaValidateOutput = z.output<typeof humanGatedValidationSchema>;
