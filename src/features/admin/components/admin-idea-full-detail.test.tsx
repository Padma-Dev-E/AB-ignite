import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminIdeaFullDetail } from "./admin-evaluation";
import type { AdminEvaluationDetail } from "../types";

test("full idea detail shows submitted evidence, answers and KPI explanations", () => {
  const detail = {
    idea: {
      id: 9001, reference: "ABI-FULL-DETAIL", title: "Complete onboarding checks", summary: "Reduce repeated document follow-up.",
      problem: "Staff recheck each document manually.", solution: "Validate document sets before review.", benefits: "Fewer follow-up calls.", risks: "Incorrect checks could delay onboarding.",
      kind: "idea", category: "Customer", status: "poc", priorityBand: "Priority", priorityScore: 2.7,
      aiValidationScore: 8.4, aiValidationAttempts: 1, submittedWithLowAiScore: false, authorId: 10,
      authorName: "Employee", department: "Operations", createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z",
    },
    submission: {
      answers: { beneficiaries: "Small business customers", currentProcess: "Manual review", needed: "Document checklist", risks: "False positives", successMeasure: "Fewer delays" },
      metrics: { turnaround: 3, volume: 2, value: 3 },
      breakdown: [{ key: "turnaround", score: 3, weight: 0.3, explanation: "Save one business day." }],
      score: 2.7, minimumScore: 1.5, validationPassed: true, aiValidationScore: 8.4, aiValidationAttempts: 1,
      submittedWithLowAiScore: false, differentiation: "This validates all documents before the case is opened.", submittedAt: "2026-10-20T00:00:00.000Z",
    },
    assessment: { jobKey: "idea.validate", completedAt: "2026-10-20T00:00:00.000Z", result: { decision: "allow" } },
    route: null, controlReview: null,
  } as unknown as AdminEvaluationDetail;

  const markup = renderToStaticMarkup(<AdminIdeaFullDetail detail={detail} />);
  for (const expected of [
    "Reduce repeated document follow-up.", "Staff recheck each document manually.", "Validate document sets before review.",
    "Fewer follow-up calls.", "Incorrect checks could delay onboarding.", "Small business customers", "Manual review",
    "Document checklist", "False positives", "Fewer delays", "Save one business day.", "This validates all documents before the case is opened.",
  ]) assert.ok(markup.includes(expected), `expected full detail to include: ${expected}`);
});
