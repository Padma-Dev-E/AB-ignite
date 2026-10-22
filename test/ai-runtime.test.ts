import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  AiProviderError,
  AiTimeoutError,
  AiProviderOutputError,
  AiSchemaValidationError,
  type AiProviderErrorCategory,
} from "../src/lib/ai/errors";
import { createGeminiProvider } from "../src/lib/ai/gemini-provider-core";
import type { AiConfig } from "../src/lib/ai/config";
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

function testConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    apiKey: "test-key",
    model: "test-model",
    timeoutMs: 100,
    maxAttempts: 3,
    retryInitialDelayMs: 0,
    retryMaxDelayMs: 0,
    maxOutputTokens: 256,
    temperature: 0,
    maxInputChars: 1_000,
    maxOutputBytes: 1_000,
    allowedDataClassification: "internal",
    logSensitive: false,
    rateLimitPerUser: 20,
    globalConcurrency: 2,
    retentionDays: 90,
    ...overrides,
  };
}

test("Gemini adapter requests bounded structured JSON and maps the response", async () => {
  let request: Record<string, unknown> | undefined;
  const provider = createGeminiProvider(testConfig(), {
    clientFactory: () => ({
      models: {
        generateContent: async (value: Record<string, unknown>) => {
          request = value;
          return {
            text: '{"ok":true}',
            usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
            candidates: [{ finishReason: "STOP" }],
          };
        },
      },
    }),
  });

  const response = await provider.generateStructured({
    model: "override-model",
    systemPrompt: "Return JSON only.",
    userContent: "{\"input\":\"safe\"}",
    responseMimeType: "application/json",
    responseJsonSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    maxOutputTokens: 256,
    temperature: 0,
    timeoutMs: 100,
  });

  assert.equal(response.text, '{"ok":true}');
  assert.deepEqual(response.usage, { inputTokens: 4, outputTokens: 2 });
  assert.equal(response.finishReason, "STOP");
  assert.equal(request?.model, "override-model");
  assert.equal((request?.config as { responseMimeType: string }).responseMimeType, "application/json");
  assert.deepEqual((request?.config as { responseJsonSchema: unknown }).responseJsonSchema, {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
  });
});

test("Gemini adapter rejects malformed or oversized structured output", async () => {
  const malformed = createGeminiProvider(testConfig(), {
    clientFactory: () => ({ models: { generateContent: async () => ({ text: "not-json" }) } }),
  });
  await assert.rejects(
    malformed.generateStructured({
      model: "test-model",
      systemPrompt: "Return JSON.",
      userContent: "input",
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
      maxOutputTokens: 256,
      temperature: 0,
      timeoutMs: 100,
    }),
    (error: unknown) => error instanceof AiProviderOutputError,
  );

  const oversized = createGeminiProvider(testConfig({ maxOutputBytes: 4 }), {
    clientFactory: () => ({ models: { generateContent: async () => ({ text: '{"too":"large"}' }) } }),
  });
  await assert.rejects(
    oversized.generateStructured({
      model: "test-model",
      systemPrompt: "Return JSON.",
      userContent: "input",
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
      maxOutputTokens: 256,
      temperature: 0,
      timeoutMs: 100,
    }),
    (error: unknown) => error instanceof AiProviderOutputError,
  );
});

test("Gemini adapter retries transient failures only within the configured attempt bound", async () => {
  let calls = 0;
  const provider = createGeminiProvider(testConfig({ maxAttempts: 3 }), {
    clientFactory: () => ({
      models: {
        generateContent: async () => {
          calls += 1;
          if (calls < 3) throw Object.assign(new Error("temporary outage with test-key"), { status: 503 });
          return { text: '{"ok":true}' };
        },
      },
    }),
  });

  await provider.generateStructured({
    model: "test-model",
    systemPrompt: "Return JSON.",
    userContent: "input",
    responseMimeType: "application/json",
    responseJsonSchema: { type: "object" },
    maxOutputTokens: 256,
    temperature: 0,
    timeoutMs: 100,
  });
  assert.equal(calls, 3);
});

test("Gemini adapter maps provider status and timeout without leaking the API key", async () => {
  const rateLimited = createGeminiProvider(testConfig(), {
    clientFactory: () => ({
      models: { generateContent: async () => { throw Object.assign(new Error("bad test-key"), { status: 429 }); } },
    }),
  });
  await assert.rejects(
    rateLimited.generateStructured({
      model: "test-model", systemPrompt: "Return JSON.", userContent: "input", responseMimeType: "application/json",
      responseJsonSchema: { type: "object" }, maxOutputTokens: 256, temperature: 0, timeoutMs: 100,
    }),
    (error: unknown) => error instanceof AiProviderError && error.category === "rate_limited" && !error.message.includes("test-key"),
  );

  const timedOut = createGeminiProvider(testConfig({ timeoutMs: 10 }), {
    clientFactory: () => ({ models: { generateContent: async () => new Promise(() => {}) } }),
  });
  await assert.rejects(
    timedOut.generateStructured({
      model: "test-model", systemPrompt: "Return JSON.", userContent: "input", responseMimeType: "application/json",
      responseJsonSchema: { type: "object" }, maxOutputTokens: 256, temperature: 0, timeoutMs: 10,
    }),
    (error: unknown) => error instanceof AiTimeoutError,
  );
});
