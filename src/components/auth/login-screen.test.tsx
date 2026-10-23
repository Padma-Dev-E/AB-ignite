import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginScreen } from "./login-screen";

test("login screen only offers email and password sign in", () => {
  const markup = renderToStaticMarkup(<LoginScreen onCredentials={async () => undefined} />);

  assert.match(markup, /type="email"/);
  assert.match(markup, /type="password"/);
  assert.doesNotMatch(markup, /Join the demo|Your name|Department|sample colleague|Ahmad Nasser|Omar Saleh/);
});
