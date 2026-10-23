import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { makeStore, type RootState } from "./index";
import { setMobileDrawerOpen } from "./ui-slice";
import { AppProviders } from "../providers/app-providers";

test("stores isolate transient UI state", () => {
  const first = makeStore();
  const second = makeStore();
  first.dispatch(setMobileDrawerOpen(true));
  assert.equal(first.getState().ui.mobileDrawerOpen, true);
  assert.equal(second.getState().ui.mobileDrawerOpen, false);
  assert.deepEqual(Object.keys(first.getState()), ["ui"]);
});

test("providers render children with isolated query and redux dependencies during SSR", () => {
  const clients: unknown[] = [];
  function Probe() {
    const client = useQueryClient();
    clients.push(client);
    const open = useSelector((state: RootState) => state.ui.mobileDrawerOpen);
    return createElement("span", null, open ? "open" : "closed");
  }
  for (let index = 0; index < 2; index++) {
    assert.equal(renderToString(createElement(AppProviders, null, createElement(Probe))), "<span>closed</span>");
  }
  assert.notEqual(clients[0], clients[1]);
});
