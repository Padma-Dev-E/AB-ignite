import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { apiError, handleApiError, ok } from "../src/lib/http/errors";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("API envelopes include request IDs and never expose provider details", async () => {
  const success = ok({ runId: "1" }, 202, "request-1");
  assert.equal(success.status, 202);
  assert.deepEqual(await success.json(), { data: { runId: "1" }, error: null, requestId: "request-1" });

  const failure = handleApiError(new Error("Gemini API key=secret provider payload"), "request-2");
  assert.equal(failure.status, 500);
  const failureBody = await failure.json() as { error: { code: string } };
  assert.equal(failureBody.error.code, "internal_error");
  assert.doesNotMatch(JSON.stringify(failureBody), /secret|provider payload/);
  assert.equal(apiError("unauthorized", "Authentication required", 401, "request-3").status, 401);
});

test("idea API routes require Auth.js and use authorization boundaries", async () => {
  for (const path of [
    "app/api/ideas/route.ts",
    "app/api/ideas/[id]/submit/route.ts",
    "app/api/ideas/[id]/ai-status/route.ts",
    "app/api/ideas/[id]/decision-pack/route.ts",
    "app/api/ideas/[id]/review/route.ts",
    "app/api/ideas/[id]/ai-retry/route.ts",
    "app/api/admin/ai/runs/route.ts",
  ]) {
    const content = await source(path);
    assert.match(content, /auth\(\)/, `${path} must check Auth.js`);
    assert.match(content, /requestId|apiError|handleApiError/, `${path} must use safe API responses`);
    assert.doesNotMatch(content, /GEMINI_API_KEY|GOOGLE_API_KEY|console\.log\(.*request\.json/);
  }
});

test("frontend remains disconnected from Gemini and API routes", async () => {
  const page = await source("app/page.tsx");
  assert.doesNotMatch(page, /GEMINI|generateContent|\/api\/ideas/);
});

test("idea creation uses one database transaction for aggregate, version, and event", async () => {
  const route = await source("app/api/ideas/route.ts");
  assert.match(route, /db\.transaction/);
});
