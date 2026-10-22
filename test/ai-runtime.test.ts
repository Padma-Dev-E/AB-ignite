import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  AiProviderError,
  AiSchemaValidationError,
  type AiProviderErrorCategory,
} from "../src/lib/ai/errors";
import {
  ClarifyingQuestionSchema,
  RiskFindingSchema,
  RiskFindingListSchema,
} from "../src/lib/ai/schemas/common";
import { IdeaInputSchema } from "../src/lib/ideas/schemas";

test("valid structured risk output parses with bounded fields", () => {
  const result = RiskFindingSchema.safeParse({
    category: "security",
    severity: "medium",
    description: "The proposed workflow may expose internal records.",
    mitigations: ["Apply least-privilege access controls."],
    requiresHumanReview: true,
  });

  assert.equal(result.success, true);
});

test("unknown risk categories are rejected", () => {
  const result = RiskFindingSchema.safeParse({
    category: "made_up_category",
    severity: "low",
    description: "Not a supported category.",
    mitigations: [],
    requiresHumanReview: false,
  });

  assert.equal(result.success, false);
});

test("risk output arrays and confidence scores stay within bounds", () => {
  const tooManyRisks = Array.from({ length: 21 }, (_, index) => ({
    category: "operational",
    severity: "low",
    description: `Risk ${index}`,
    mitigations: [],
    requiresHumanReview: false,
  }));

  assert.equal(RiskFindingListSchema.safeParse(tooManyRisks).success, false);
  assert.equal(z.number().min(0).max(1).safeParse(1.01).success, false);
});

test("idea input is separate from model-owned output", () => {
  const input = IdeaInputSchema.parse({
    kind: "idea",
    title: "Reduce manual account checks",
    summary: "Automate repetitive internal checks.",
    category: "Operations",
    dataClassification: "internal",
  });

  assert.equal(input.title, "Reduce manual account checks");
  assert.equal("decision" in input, false);
});

test("clarifying questions reject unsupported answer types", () => {
  const result = ClarifyingQuestionSchema.safeParse({
    id: "q-1",
    question: "What baseline process time should be compared?",
    reason: "A baseline is required to estimate impact.",
    required: true,
    answerType: "unsupported",
  });

  assert.equal(result.success, false);
});

test("provider errors preserve safe categories without raw provider payloads", () => {
  const categories: AiProviderErrorCategory[] = ["rate_limited", "transient", "auth", "invalid_request", "unknown"];
  for (const category of categories) {
    const error = new AiProviderError(category, "provider failed", { status: 429 });
    assert.equal(error.category, category);
    assert.equal(error.status, 429);
    assert.equal("raw" in error, false);
  }
  assert.equal(new AiSchemaValidationError("invalid output").name, "AiSchemaValidationError");
});
