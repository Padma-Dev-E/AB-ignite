import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { AppProviders } from "../../providers/app-providers";
import { EmployeeFeedbackCampaignForm, EmployeeNotificationsPanel } from "./employee-engagement";

test("employee engagement panels render loading states while live data is unresolved", () => {
  const html = renderToString(createElement(AppProviders, null, createElement("div", null,
    createElement(EmployeeFeedbackCampaignForm), createElement(EmployeeNotificationsPanel),
  )));
  assert.match(html, /Loading feedback campaign/);
  assert.match(html, /Loading notifications/);
});

test("notification surfaces stay bounded and expose pagination", () => {
  const source = readFileSync(new URL("./employee-engagement.tsx", import.meta.url), "utf8");
  assert.match(source, /max-h-\[28rem\] overflow-y-auto/);
  assert.match(source, /Load more notifications/);
});
