import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { learningQueryKeys } from "../hooks";
import { LearningRanking } from "./learning-social";

function ranking(items: Array<{ rank: number; name: string; department: string; points: number }>) {
  const client = new QueryClient();
  client.setQueryData(learningQueryKeys.rankings("bank"), { scope: "bank", items });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(LearningRanking)));
}

test("ranking renders real podium and remaining rows without inventing participants", () => {
  const html = ranking([
    { rank: 4, name: "Fourth colleague", department: "Operations", points: 17 },
    { rank: 2, name: "Second colleague", department: "Banking", points: 54 },
    { rank: 1, name: "First colleague", department: "Technology", points: 83 },
    { rank: 3, name: "Third colleague", department: "Transformation", points: 26 },
  ]);
  assert.match(html, /Top three champions/);
  assert.match(html, /More champions/);
  assert.ok(html.indexOf("First colleague") < html.indexOf("Second colleague"));
  assert.ok(html.indexOf("Third colleague") < html.indexOf("Fourth colleague"));
  assert.match(html, /83/);
  assert.match(html, /aria-pressed="true"/);
  const sparse = ranking([{ rank: 1, name: "Only colleague", department: "Operations", points: 7 }]);
  assert.match(sparse, /Only colleague/);
  assert.doesNotMatch(sparse, /More champions|🥈|🥉/);
});

test("empty ranking explains there are no entries", () => {
  assert.match(ranking([]), /No ranking entries are available yet/);
});
