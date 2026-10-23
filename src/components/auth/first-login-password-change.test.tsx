import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstLoginPasswordChange } from "./first-login-password-change";

test("first-login password screen requires current and policy-compliant new password", () => {
  const markup = renderToStaticMarkup(<FirstLoginPasswordChange onChangePassword={async () => undefined} />);

  assert.match(markup, /Change your password/);
  assert.match(markup, /Current password/);
  assert.match(markup, /New password/);
  assert.match(markup, /At least 10 characters, with upper and lower case letters and a digit/);
  assert.match(markup, /sign in again after it is changed/);
});
