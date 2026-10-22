import { DecisionPackInputSchema, IdeaDecisionPackOutputSchema } from "../../ideas/schemas";
import { defineIdeaJob, objectResponseSchema, reviewSystemBoundary } from "./helpers";

export const ideaDecisionPackJob = defineIdeaJob({
  key: "idea.decision_pack",
  inputSchema: DecisionPackInputSchema,
  outputSchema: IdeaDecisionPackOutputSchema,
  systemPrompt: `${reviewSystemBoundary} Assemble a reviewer packet from normalized analysis and explicit evidence: summary, evidence, unresolved questions, risks, controls, options, tradeoffs, recommendation, and a human decision checklist. Do not make the final decision or change status.`,
  responseJsonSchema: objectResponseSchema({ summary: { type: "string" }, evidence: { type: "array", items: { type: "string" }, maxItems: 30 }, unresolvedQuestions: { type: "array", items: { type: "object" }, maxItems: 20 }, risks: { type: "array", items: { type: "object" }, maxItems: 20 }, controls: { type: "array", items: { type: "string" }, maxItems: 20 }, options: { type: "array", items: { type: "object" }, maxItems: 10 }, recommendation: { type: "string" }, humanChecklist: { type: "array", items: { type: "string" }, maxItems: 20 } }, ["summary", "evidence", "unresolvedQuestions", "risks", "controls", "options", "recommendation", "humanChecklist"]),
});
