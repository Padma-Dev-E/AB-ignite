import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AppProviders } from "../../providers/app-providers";
import { EmployeeProfileCard } from "./employee-profile";

test("employee profile card exposes independent live loading states", () => {
  const html = renderToString(createElement(AppProviders, null, createElement(EmployeeProfileCard)));
  assert.match(html, /Loading profile/);
  assert.match(html, /Loading points and level/);
});
