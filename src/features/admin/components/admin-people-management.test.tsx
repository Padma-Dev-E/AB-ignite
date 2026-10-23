import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { adminQueryKeys } from "../api";
import { AdminPeopleManagement, TemporaryPasswordNotice } from "./admin-people-management";

test("create-user form requires identity, department and audited reason, and offers the supported roles", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  const markup = renderToStaticMarkup(<QueryClientProvider client={queryClient}><AdminPeopleManagement /></QueryClientProvider>);

  assert.match(markup, /<summary[^>]*>Create user<\/summary>/);
  assert.match(markup, /<span class="field-label">Name<\/span><input[^>]*required=""/);
  assert.match(markup, /<span class="field-label">Email<\/span><input[^>]*required=""[^>]*type="email"/);
  assert.match(markup, /<span class="field-label">Department<\/span><input[^>]*required=""/);
  assert.match(markup, /<span class="field-label">Role<\/span><select/);
  assert.match(markup, /<option value="employee"[^>]*>employee<\/option>/);
  assert.match(markup, /<option value="back_office">back office<\/option>/);
  assert.match(markup, /<option value="business_owner">business owner<\/option>/);
  assert.match(markup, /Audited reason/);
  queryClient.clear();
});

test("create-user form blocks submission when policy leaves no selectable role", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  queryClient.setQueryData(adminQueryKeys.settings, { priority: { roles: JSON.stringify(["unsupported_role"]) }, pointRules: [], recommendationRules: [], levels: [], departments: [] });
  const markup = renderToStaticMarkup(<QueryClientProvider client={queryClient}><AdminPeopleManagement /></QueryClientProvider>);

  assert.match(markup, /No user roles are allowed by the current access policy/);
  assert.match(markup, /<select[^>]*disabled=""/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Create user<\/button>/);
  queryClient.clear();
});

test("temporary password notice says every role must change it at first sign-in", () => {
  const markup = renderToStaticMarkup(<TemporaryPasswordNotice email="new.user@example.test" password="one-time-secret" onDismiss={() => undefined} />);

  assert.match(markup, /Temporary password for new\.user@example\.test/);
  assert.match(markup, /one-time-secret/);
  assert.match(markup, /mustChangePassword requirement applies to every role: the user must change this password at first sign-in before accessing the app\./);
  assert.match(markup, /approved bank channel/);
  assert.match(markup, /Dismiss password/);
});

test("temporary password notice dismiss button clears the one-time display", () => {
  let dismissed = false;
  const tree = TemporaryPasswordNotice({ email: "new.user@example.test", password: "one-time-secret", onDismiss: () => { dismissed = true; } });
  const children = React.Children.toArray((tree as React.ReactElement<{ children: React.ReactNode }>).props.children);
  const buttonGroup = children.find((child) => React.isValidElement(child) && child.type === "div");
  assert.ok(React.isValidElement(buttonGroup));
  const button = React.Children.toArray((buttonGroup as React.ReactElement<{ children: React.ReactNode }>).props.children).find((child) => React.isValidElement(child) && child.type === "button");
  assert.ok(React.isValidElement(button));
  (button as React.ReactElement<{ onClick: () => void }>).props.onClick();
  assert.equal(dismissed, true);
});
