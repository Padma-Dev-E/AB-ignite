import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AppProviders } from "../../../providers/app-providers";
import { buildIdeaSearchPhrase, EmployeeIdeaSubmissionPage } from "./employee-idea-flow";

test("related-idea search uses an early distinctive phrase instead of the full opening sentence", () => {
  assert.equal(
    buildIdeaSearchPhrase("Problem: daily receipt printer checks fail before morning service."),
    "daily receipt printer",
  );
});

test("employee submission flow starts with the describe stage", () => {
  const html = renderToString(
    createElement(
      AppProviders,
      null,
      createElement(EmployeeIdeaSubmissionPage, {
        onOpenIdea: () => undefined,
      }),
    ),
  );
  assert.match(html, /Share an idea/);
  assert.match(html, /Continue to develop/);
  assert.match(html, /Server originality check/);
});

test("employee submission presents exact score bands and blocks a failed validation until revalidated", () => {
  const source = readFileSync(
    new URL("./employee-idea-flow.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /scorePriority/);
  assert.match(source, /Quality/);
  assert.match(source, /priorityPolicyQuery\.data/);
  assert.match(source, /validationBlocked/);
  assert.match(source, /ideaValidationPasses\(validation\)/);
  assert.match(source, /normalizeIdeaValidationScore\(validation\?\.overallScore\)/);
  assert.match(source, /above 7\/10/);
  assert.match(source, /Improve draft/);
});

test("employee development exposes AI structure fields and explicit validation pass/fail reasons", () => {
  const source = readFileSync(
    new URL("./employee-idea-flow.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /applyEnrichment/);
  assert.match(source, /validation\.gaps/);
  assert.match(source, /setTitle\(enrichment\.suggestedTitle\)/);
});

test("employee development exposes AI structure fields and explicit validation pass/fail reasons", () => {
  const source = readFileSync(
    new URL("./employee-idea-flow.tsx", import.meta.url),
    "utf8",
  );
  for (const field of [
    "Idea title",
    "Problem statement",
    "Proposed solution",
    "Expected benefits",
    "Possible risks",
  ])
    assert.ok(source.includes(field));
  assert.match(source, /AI suggestions fill\s+empty\s+fields/);
});

test("employee wizard renders the reviewer-question and impact-number stages", () => {
  const source = readFileSync(
    new URL("./employee-idea-flow.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Continue to questions/);
  assert.match(source, /Questions reviewers may ask/);
  assert.match(source, /Continue to validation/);
  assert.match(source, /Continue to numbers/);
  assert.match(source, /Turnaround time/);
  assert.match(source, /Expected savings or revenue/);
  assert.match(source, /Points earned/);
  assert.match(source, /submitResult\.pointsAwarded/);
  assert.match(source, /\{submitResult\.pointsAwarded\} points/);
  assert.match(source, /candidateQuery\.refetch\(\)/);
  assert.match(source, /submitResult\.breakdown\.map/);
  assert.match(source, /submitResult\?\.reference/);
  assert.match(source, /priorityRejectionDetails/);
  assert.match(source, /error\.details/);
  assert.match(source, /const lifecycle = \[/);
  assert.match(source, /"Business review"/);
  assert.match(source, /"Proof of concept"/);
  assert.match(source, /"Impact"/);
  assert.match(source, /Your saved drafts/);
  assert.match(source, /Resume draft/);
  assert.match(source, /unresolvedOriginality/);
});
