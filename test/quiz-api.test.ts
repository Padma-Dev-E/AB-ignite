import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

const routes = [
  "app/api/quizzes/route.ts",
  "app/api/quizzes/[id]/route.ts",
  "app/api/quizzes/[id]/attempts/route.ts",
  "app/api/quizzes/attempts/[id]/route.ts",
  "app/api/quizzes/attempts/[id]/submit/route.ts",
  "app/api/quizzes/journey/route.ts",
  "app/api/quizzes/rankings/route.ts",
  "app/api/challenges/route.ts",
  "app/api/challenges/[id]/join/route.ts",
];

test("quiz routes use Auth.js, shared request envelopes, and safe error mapping", async () => {
  for (const path of routes) {
    const route = await source(path);
    assert.match(route, /auth/);
    assert.match(route, /quizContext/);
    assert.match(route, /requestId\(/);
    assert.match(route, /ok\(/);
    assert.match(route, /quizApiError/);
  }
});

test("quiz mutations use bounded validation and idempotency", async () => {
  const start = await source("app/api/quizzes/[id]/attempts/route.ts");
  const submit = await source("app/api/quizzes/attempts/[id]/submit/route.ts");
  const join = await source("app/api/challenges/[id]/join/route.ts");
  assert.match(start, /idempotencySchema/);
  assert.match(start, /requestAuditMetadata/);
  assert.match(submit, /submitAnswersSchema/);
  assert.match(submit, /requestAuditMetadata/);
  assert.match(join, /idempotencySchema/);
  assert.match(join, /requestAuditMetadata/);
  assert.match(submit, /submitQuizAttempt/);
  assert.doesNotMatch(submit, /isCorrect/);
});

test("quiz routes map failures through the shared safe error boundary", async () => {
  const http = await source("src/lib/quizzes/http.ts");
  assert.match(http, /status >= 500/);
  assert.match(http, /An unexpected server error occurred/);
  assert.match(http, /handleApiError/);
});
