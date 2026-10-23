import assert from "node:assert/strict";
import test from "node:test";
import { parseQuizResume, reconcileQuizResume, serializeQuizResume } from "./quiz-resume";

const questions = [
  { id: 11, options: [{ optionKey: "a" }, { optionKey: "b" }] },
  { id: 12, options: [{ optionKey: "yes" }, { optionKey: "no" }] },
];

test("a refreshed quiz restores the same attempt, current question, and valid selections", () => {
  const stored = serializeQuizResume({ attemptId: 42, questionIndex: 1, answers: { 11: "b", 12: "yes" } });
  assert.deepEqual(reconcileQuizResume(parseQuizResume(stored), 42, questions), {
    attemptId: 42, questionIndex: 1, answers: { 11: "b", 12: "yes" },
  });
});

test("legacy attempt IDs restore safely without inventing answers", () => {
  assert.deepEqual(parseQuizResume("42"), { attemptId: 42, questionIndex: 0, answers: {} });
});

test("malformed or unsafe session drafts cannot trigger an invalid attempt request", () => {
  for (const raw of ["Infinity", "0", "9007199254740992", "{", JSON.stringify({ attemptId: 0, questionIndex: 0, answers: {} }), JSON.stringify({ attemptId: 42, questionIndex: -1, answers: {} })]) {
    assert.equal(parseQuizResume(raw), null);
  }
});

test("server question set discards stale or tampered selections after reconnect", () => {
  const draft = parseQuizResume(JSON.stringify({ attemptId: 42, questionIndex: 8, answers: { 11: "other", 12: "yes", 13: "a" } }));
  assert.deepEqual(reconcileQuizResume(draft, 42, questions), { attemptId: 42, questionIndex: 1, answers: { 12: "yes" } });
  assert.equal(reconcileQuizResume(draft, 43, questions), null);
});
