import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AppProviders } from "../../../providers/app-providers";
import { EmployeeIdeaSubmissionPage } from "./employee-idea-flow";

test("employee submission flow starts with the describe stage", () => {
  const html = renderToString(createElement(
    AppProviders,
    null,
    createElement(EmployeeIdeaSubmissionPage, { onOpenIdea: () => undefined }),
  ));

  assert.match(html, /Share an idea/);
  assert.match(html, /Continue to develop/);
  assert.match(html, /Server originality check/);
});
