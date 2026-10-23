import assert from "node:assert/strict";
import test, { before } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// Work against a private snapshot: no fixtures or deletions touch application data.
let db: typeof import("../src/db/connection").db;
let users: typeof import("../src/db/schema").users;
let ideas: typeof import("../src/db/schema").ideas;
let ideaSupports: typeof import("../src/db/schema").ideaSupports;
let listIdeas: typeof import("../src/lib/ideas/repository").listIdeas;
let getIdeaById: typeof import("../src/lib/ideas/repository").getIdeaById;

before(async () => {
  const directory = mkdtempSync(join(tmpdir(), "idea-author-projection-"));
  const source = new Database(process.env.DATABASE_URL?.replace(/^file:/, "") ?? "data/ab-ignite.db", { readonly: true });
  const databasePath = join(directory, "test.db");
  await source.backup(databasePath);
  source.close();
  process.env.DATABASE_URL = databasePath;
  ({ db } = await import("../src/db/connection"));
  ({ users, ideas, ideaSupports } = await import("../src/db/schema"));
  ({ listIdeas, getIdeaById } = await import("../src/lib/ideas/repository"));
});

test("real list and detail project only safe author fields and preserve filters, pages and viewer support", async () => {
  const tag = `author-projection-${Date.now()}`;
  const [owner, viewer] = db.insert(users).values([
    { name: "Maya Haddad", department: "Operations", email: `${tag}-owner@example.test`, passwordHash: "private-owner-hash" },
    { name: "Raghad Aljadid", department: "Technology", email: `${tag}-viewer@example.test`, passwordHash: "private-viewer-hash" },
  ]).returning().all();
  const created = db.insert(ideas).values([
    { authorId: owner.id, title: `${tag} first`, summary: "First projection fixture", category: "Operations", reference: `${tag}-1`, status: "returned" },
    { authorId: viewer.id, title: `${tag} second`, summary: "Second projection fixture", category: "Operations", reference: `${tag}-2`, status: "returned" },
  ]).returning().all();
  db.insert(ideaSupports).values({ ideaId: created[0].id, userId: viewer.id }).run();
  const actor = { kind: "user" as const, id: String(viewer.id) };
  const query = { page: 1, pageSize: 1, search: tag, category: "Operations", status: "returned" as const };
  const first = await listIdeas(actor, query);
  const second = await listIdeas(actor, { ...query, page: 2 });
  assert.deepEqual([first.total, first.totalPages, first.pageSize, second.page], [2, 2, 1, 2]);
  assert.equal(first.items[0].id, created[1].id);
  assert.equal(second.items[0].id, created[0].id);
  assert.equal(first.items[0].supported, false);
  assert.equal(second.items[0].supported, true);
  const expected = { id: owner.id, name: "Maya Haddad", department: "Operations" };
  assert.deepEqual(second.items[0].author, expected);
  const detail = await getIdeaById(created[0].id);
  assert.deepEqual(detail?.author, expected);
  assert.deepEqual(Object.keys(detail!.author!).sort(), ["department", "id", "name"]);
  assert.equal(JSON.stringify(second).includes("private-owner-hash"), false);
  assert.equal(JSON.stringify(detail).includes(owner.email), false);
  const mine = await listIdeas(actor, { ...query, mine: true });
  assert.equal(mine.total, 1);
  assert.equal(mine.items[0].author?.id, viewer.id);
  const ownerView = await listIdeas({ kind: "user", id: String(owner.id) }, { ...query, pageSize: 10 });
  assert.ok(ownerView.items.every((item) => item.supported === false));
  assert.equal(await getIdeaById(-1), null);
  assert.equal(await getIdeaById(2147483647), null);
});
