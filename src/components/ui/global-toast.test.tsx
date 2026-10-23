import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addGlobalToast, dismissGlobalToast, GlobalToastProvider, MAX_GLOBAL_TOASTS, useGlobalToast, type GlobalToast } from "./global-toast";

test("toast queue remains bounded and manual dismissal targets one message", () => {
  let queue: GlobalToast[] = [];
  for (let id = 1; id <= 5; id += 1) queue = addGlobalToast(queue, { id, kind: id % 2 ? "success" : "error", message: `Message ${id}`, durationMs: 5000 });
  assert.equal(queue.length, MAX_GLOBAL_TOASTS);
  assert.deepEqual(queue.map((item) => item.id), [3, 4, 5]);
  assert.deepEqual(dismissGlobalToast(queue, 4).map((item) => item.id), [3, 5]);
});

test("toast hook is available to descendants and requires the provider", () => {
  function Consumer() {
    const toast = useGlobalToast();
    return createElement("span", null, typeof toast.success === "function" && typeof toast.error === "function" && typeof toast.dismiss === "function" ? "ready" : "missing");
  }
  assert.match(renderToStaticMarkup(createElement(GlobalToastProvider, null, createElement(Consumer))), /ready/);
  assert.throws(() => renderToStaticMarkup(createElement(Consumer)), /GlobalToastProvider/);
});
