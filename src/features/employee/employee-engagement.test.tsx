import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
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
