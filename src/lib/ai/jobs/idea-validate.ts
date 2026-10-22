import { z } from "zod";
import { IdeaValidationOutputSchema } from "../../ideas/schemas";
import { defineIdeaJob, ideaInputSchema, jsonDuplicate, jsonImpact, jsonNextAction, jsonQuestion, jsonRiskFinding, jsonRoute, jsonScores, objectResponseSchema, reviewSystemBoundary } from "./helpers";

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
    scores: jsonScores, strengths: { type: "array", items: { type: "string" } }, gaps: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } }, questions: { type: "array", items: jsonQuestion }, risks: { type: "array", items: jsonRiskFinding },
    duplicates: { type: "array", items: jsonDuplicate }, recommendedRoute: jsonRoute, estimatedImpact: jsonImpact, nextActions: { type: "array", items: jsonNextAction }, auditSummary: { type: "string" },
  }, ["decision", "recommendedStatus", "confidence", "overallScore", "scores", "strengths", "gaps", "assumptions", "questions", "risks", "duplicates", "recommendedRoute", "estimatedImpact", "nextActions", "auditSummary"]),
});

export type IdeaValidateOutput = z.output<typeof humanGatedValidationSchema>;
