import test from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_FAMILIES } from "../src/lib/ui-system.js";

test("the UI system names one shared component family for repeated interface patterns", () => {
  assert.deepEqual(COMPONENT_FAMILIES, [
    "Button",
    "Card",
    "Field",
    "Hero",
    "IconBox",
    "Pill",
    "Tabs",
  ]);
});
