import { IdeaEnrichmentOutputSchema } from "../../ideas/schemas";
import { defineIdeaJob, ideaInputSchema, objectResponseSchema, reviewSystemBoundary } from "./helpers";

export const ideaEnrichJob = defineIdeaJob({
  key: "idea.enrich",
  inputSchema: ideaInputSchema,
  outputSchema: IdeaEnrichmentOutputSchema,
  systemPrompt: `${reviewSystemBoundary} Improve discoverability and reviewer clarity with a suggested title, concise summary, problem statement, value statement, taxonomy, tags, affected teams, and explicit assumptions. Preserve the submitter's intent and do not overwrite source text.`,
  responseJsonSchema: objectResponseSchema({
    suggestedTitle: { type: "string" }, conciseSummary: { type: "string" }, problemStatement: { type: "string" }, valueStatement: { type: "string" },
    tags: { type: "array", items: { type: "string" }, maxItems: 20 }, taxonomy: { type: "array", items: { type: "string" }, maxItems: 10 }, affectedTeams: { type: "array", items: { type: "string" }, maxItems: 20 }, assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
  }, ["suggestedTitle", "conciseSummary", "problemStatement", "valueStatement", "tags", "taxonomy", "affectedTeams", "assumptions"]),
});
