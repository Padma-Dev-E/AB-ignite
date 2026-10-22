import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, pageTitle, isActiveNav } from "../src/lib/navigation.js";

test("navigation keeps the reference app sections in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((item) => item.label),
    ["Community", "Share an idea", "Ignite Your Knowledge", "Library", "Rewards", "My account"],
  );
});

test("navigation resolves page titles and active states", () => {
  assert.equal(pageTitle("community"), "Community");
  assert.equal(pageTitle("idea"), "Idea");
  assert.equal(pageTitle("article"), "Library");
  assert.equal(pageTitle("unknown"), "Community");
  assert.equal(isActiveNav("learn", "quiz"), true);
  assert.equal(isActiveNav("library", "article"), true);
  assert.equal(isActiveNav("rewards", "community"), false);
});
