import { z } from "zod";
import {
  ClarifyingQuestionSchema,
  DuplicateCandidateSchema,
  EstimatedImpactSchema,
  NextActionSchema,
  RecommendedRouteSchema,
  RiskFindingListSchema,
} from "../ai/schemas/common";

export const IdeaInputSchema = z.strictObject({
  kind: z.enum(["idea", "problem"]),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(2_000),
  problem: z.string().trim().max(5_000).optional(),
  solution: z.string().trim().max(5_000).optional(),
  benefits: z.string().trim().max(5_000).optional(),
  risks: z.string().trim().max(5_000).optional(),
  category: z.string().trim().min(1).max(120),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});

export type IdeaInput = z.infer<typeof IdeaInputSchema>;

const paginationNumber = (fallback: number, max?: number) => z.preprocess(
  (value) => value === undefined || value === "" ? fallback : Number(value),
  z.number().int().min(1).transform((value) => max ? Math.min(value, max) : value),
);

export const IdeaListQuerySchema = z.strictObject({
  page: paginationNumber(1),
  pageSize: paginationNumber(20, 50),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["screening", "returned", "business_review", "control_review", "decision", "poc", "implementation", "implemented", "rejected", "deferred"]).optional(),
  mine: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  }, z.boolean().default(false)),
});

export type IdeaListQuery = z.infer<typeof IdeaListQuerySchema>;

export const IdeaUpdateSchema = z.strictObject({
  kind: z.enum(["idea", "problem"]).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  summary: z.string().trim().min(10).max(2_000).optional(),
  problem: z.string().trim().max(5_000).nullable().optional(),
  solution: z.string().trim().max(5_000).nullable().optional(),
  benefits: z.string().trim().max(5_000).nullable().optional(),
  risks: z.string().trim().max(5_000).nullable().optional(),
  category: z.string().trim().min(1).max(120).optional(),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: "At least one field is required.",
});

export type IdeaUpdate = z.infer<typeof IdeaUpdateSchema>;

export const IdeaCommentSchema = z.strictObject({
  body: z.string().trim().min(1).max(2_000),
});

export const CommentListQuerySchema = z.strictObject({
  page: paginationNumber(1),
  pageSize: paginationNumber(20, 50),
});

export type CommentListQuery = z.infer<typeof CommentListQuerySchema>;

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const ideaStatusSchema = z.enum(["screening", "returned", "business_review", "control_review", "decision", "poc", "implementation", "implemented", "rejected", "deferred"]);

export const IdeaAnalysisInputSchema = IdeaInputSchema.extend({
  reference: boundedText(120).optional(),
  evidence: z.array(boundedText(1_000)).max(20).default([]),
  relatedIdeas: z.array(boundedText(200)).max(20).default([]),
});

const scoreSchema = z.strictObject({ score: z.number().min(0).max(5), rationale: boundedText(1_000) });

export const IdeaValidationOutputSchema = z.strictObject({
  decision: z.enum(["accept", "needs_clarification", "needs_human_review", "reject"]),
  recommendedStatus: ideaStatusSchema,
  confidence: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(100),
  scores: z.strictObject({
    novelty: scoreSchema,
    problemClarity: scoreSchema,
    customerImpact: scoreSchema,
    employeeImpact: scoreSchema,
    strategicAlignment: scoreSchema,
    feasibility: scoreSchema,
    value: scoreSchema,
    risk: scoreSchema,
    urgency: scoreSchema,
    scalability: scoreSchema,
  }),
  strengths: z.array(boundedText(500)).max(20),
  gaps: z.array(boundedText(500)).max(20),
  assumptions: z.array(boundedText(500)).max(20),
  questions: z.array(ClarifyingQuestionSchema).max(20),
  risks: RiskFindingListSchema,
  duplicates: z.array(DuplicateCandidateSchema).max(20),
  recommendedRoute: RecommendedRouteSchema,
  estimatedImpact: EstimatedImpactSchema,
  nextActions: z.array(NextActionSchema).max(20),
  auditSummary: boundedText(2_000),
});

export const IdeaPreflightOutputSchema = z.strictObject({
  decision: z.enum(["allow", "needs_human_review", "block"]),
  safeToProcess: z.boolean(),
  missingFields: z.array(boundedText(200)).max(20),
  piiFound: z.boolean(),
  secretFound: z.boolean(),
  promptInjectionDetected: z.boolean(),
  duplicateCandidates: z.array(DuplicateCandidateSchema).max(20),
  notes: z.array(boundedText(500)).max(20),
});

export const IdeaEnrichmentOutputSchema = z.strictObject({
  suggestedTitle: boundedText(200),
  conciseSummary: boundedText(1_000),
  problemStatement: boundedText(2_000),
  valueStatement: boundedText(2_000),
  tags: z.array(boundedText(80)).max(20),
  taxonomy: z.array(boundedText(120)).max(10),
  affectedTeams: z.array(boundedText(120)).max(20),
  assumptions: z.array(boundedText(500)).max(20),
});

export const IdeaQuestionsOutputSchema = z.strictObject({
  completeness: z.number().min(0).max(1),
  questions: z.array(ClarifyingQuestionSchema).max(20),
});

export const IdeaRiskOutputSchema = z.strictObject({
  overallRisk: z.enum(["low", "medium", "high", "critical", "unknown"]),
  risks: RiskFindingListSchema,
  controlReviews: z.array(boundedText(120)).max(20),
  requiredMitigations: z.array(boundedText(500)).max(20),
  summary: boundedText(2_000),
});

export const IdeaRouteOutputSchema = z.strictObject({
  recommendedRoute: RecommendedRouteSchema,
  priorityBand: z.enum(["Watch", "Qualify", "Priority"]),
  priorityScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  rationale: boundedText(1_500),
});

export const IdeaSimilarOutputSchema = z.strictObject({
  duplicates: z.array(DuplicateCandidateSchema).max(20),
  relatedThemes: z.array(boundedText(120)).max(20),
  rationale: boundedText(2_000),
});

export const IdeaEstimateOutputSchema = z.strictObject({
  estimatedImpact: EstimatedImpactSchema,
  assumptions: z.array(boundedText(500)).max(20),
  confidence: z.number().min(0).max(1),
  evidenceGaps: z.array(boundedText(500)).max(20),
});

export const IdeaDecisionPackOutputSchema = z.strictObject({
  summary: boundedText(2_000),
  evidence: z.array(boundedText(1_000)).max(30),
  unresolvedQuestions: z.array(ClarifyingQuestionSchema).max(20),
  risks: RiskFindingListSchema,
  controls: z.array(boundedText(500)).max(20),
  options: z.array(z.strictObject({ name: boundedText(120), description: boundedText(1_000), tradeoffs: z.array(boundedText(500)).max(10) })).max(10),
  recommendation: z.enum(["proceed_to_review", "return_for_clarification", "defer", "do_not_proceed"]),
  humanChecklist: z.array(boundedText(500)).max(20),
});

export const IdeaImpactMetricSchema = z.strictObject({
  name: boundedText(160),
  baseline: boundedText(300),
  target: boundedText(300),
  owner: boundedText(120),
  measurementWindow: boundedText(200),
});

export const IdeaImpactPlanOutputSchema = z.strictObject({
  metrics: z.array(IdeaImpactMetricSchema).max(20),
  instrumentationNeeds: z.array(boundedText(500)).max(20),
  successCriteria: z.array(boundedText(500)).max(20),
  failureCriteria: z.array(boundedText(500)).max(20),
  confidence: z.number().min(0).max(1),
  measurementOwner: boundedText(120),
});

export const DecisionPackInputSchema = IdeaAnalysisInputSchema.extend({
  normalizedAnalysis: z.record(z.string(), z.unknown()).default({}),
});

export const ImpactPlanInputSchema = IdeaAnalysisInputSchema.extend({
  normalizedAnalysis: z.record(z.string(), z.unknown()).default({}),
  currentMetrics: z.array(boundedText(500)).max(20).default([]),
});

export type IdeaAnalysisInput = z.infer<typeof IdeaAnalysisInputSchema>;
export type IdeaValidationOutput = z.infer<typeof IdeaValidationOutputSchema>;
export type IdeaPreflightOutput = z.infer<typeof IdeaPreflightOutputSchema>;
export type IdeaEnrichmentOutput = z.infer<typeof IdeaEnrichmentOutputSchema>;
export type IdeaQuestionsOutput = z.infer<typeof IdeaQuestionsOutputSchema>;
export type IdeaRiskOutput = z.infer<typeof IdeaRiskOutputSchema>;
export type IdeaRouteOutput = z.infer<typeof IdeaRouteOutputSchema>;
export type IdeaSimilarOutput = z.infer<typeof IdeaSimilarOutputSchema>;
export type IdeaEstimateOutput = z.infer<typeof IdeaEstimateOutputSchema>;
export type IdeaDecisionPackOutput = z.infer<typeof IdeaDecisionPackOutputSchema>;
export type IdeaImpactPlanOutput = z.infer<typeof IdeaImpactPlanOutputSchema>;
