import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/connection";
import { ideaComments, ideaSupports, ideaVersions, ideas, users } from "../src/db/schema";
import {
  createIdeaComment,
  listIdeaComments,
  listIdeas,
  supportIdea,
  updateReturnedIdea,
} from "../src/lib/ideas/repository";
import { IdeaListQuerySchema, IdeaUpdateSchema } from "../src/lib/ideas/schemas";

let ownerId = 0;
let otherUserId = 0;
let returnedIdeaId = 0;
let publicIdeaId = 0;

before(async () => {
  const [owner] = await db.insert(users).values({
    name: "Task 2 Owner",
    email: `task-2-owner-${Date.now()}@example.test`,
    role: "user",
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  ownerId = owner.id;

  const [other] = await db.insert(users).values({
    name: "Task 2 Other",
    email: `task-2-other-${Date.now()}@example.test`,
    role: "user",
    passwordHash: "test-hash",
  }).returning({ id: users.id }).all();
  otherUserId = other.id;

  const [returned] = await db.insert(ideas).values({
    authorId: ownerId,
    title: "Returned task two idea",
    summary: "An idea that needs more evidence before it can be screened again.",
    category: "Operations",
    status: "returned",
    reference: `TASK2-RETURNED-${Date.now()}`,
  }).returning({ id: ideas.id }).all();
  returnedIdeaId = returned.id;

  const [publicIdea] = await db.insert(ideas).values({
    authorId: otherUserId,
    title: "Discoverable task two idea",
    summary: "A second idea used to prove stable ordering and pagination behavior.",
    category: "Customer",
    reference: `TASK2-PUBLIC-${Date.now()}`,
  }).returning({ id: ideas.id }).all();
  publicIdeaId = publicIdea.id;
});

after(async () => {
  if (returnedIdeaId) await db.delete(ideas).where(eq(ideas.id, returnedIdeaId));
  if (publicIdeaId) await db.delete(ideas).where(eq(ideas.id, publicIdeaId));
  if (ownerId) await db.delete(users).where(eq(users.id, ownerId));
  if (otherUserId) await db.delete(users).where(eq(users.id, otherUserId));
});

test("idea list query validates filters and clamps pagination", () => {
  assert.deepEqual(IdeaListQuerySchema.parse({ page: "2", pageSize: "100", search: "  bank  " }), {
    page: 2,
    pageSize: 50,
    search: "bank",
    mine: false,
  });
  assert.throws(() => IdeaListQuerySchema.parse({ page: "0" }));
});

test("idea list returns stable pages and total count", async () => {
  const result = await listIdeas({ kind: "user", id: String(ownerId) }, { page: 1, pageSize: 1 });
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 1);
  assert.equal(result.items.length, 1);
  assert.ok(result.total >= 2);
  assert.ok(result.items[0].createdAt >= result.items.at(-1)!.createdAt);
});

test("only the owner can update a returned idea and each edit creates a new version", async () => {
  await assert.rejects(
    updateReturnedIdea({ kind: "user", id: String(otherUserId) }, returnedIdeaId, {
      title: "Unauthorized update",
      summary: "This update must not cross the idea ownership boundary.",
    }),
    /not found|authorized/i,
  );

  const result = await updateReturnedIdea({ kind: "user", id: String(ownerId) }, returnedIdeaId, {
    title: "Returned idea resubmitted with evidence",
    summary: "This returned idea now includes the evidence requested by the reviewer.",
    problem: "The current process requires duplicate manual work.",
  });
  assert.equal(result.idea.title, "Returned idea resubmitted with evidence");
  assert.equal(result.idea.status, "returned");
  assert.equal(result.version.version, 1);
  assert.equal(result.version.title, result.idea.title);
});

test("support is idempotent for one user and increments the aggregate once", async () => {
  const first = await supportIdea({ kind: "user", id: String(otherUserId) }, returnedIdeaId);
  const duplicate = await supportIdea({ kind: "user", id: String(otherUserId) }, returnedIdeaId);
  assert.equal(first.supported, true);
  assert.equal(duplicate.supported, true);
  assert.equal(duplicate.supports, first.supports);
  assert.equal((await db.select().from(ideaSupports).where(eq(ideaSupports.ideaId, returnedIdeaId)).all()).length, 1);
});

test("comments are owned by the authenticated author and update the denormalized count", async () => {
  const comment = await createIdeaComment({ kind: "user", id: String(otherUserId) }, returnedIdeaId, "A useful clarification.");
  assert.equal(comment.body, "A useful clarification.");
  const listed = await listIdeaComments(returnedIdeaId, { page: 1, pageSize: 10 });
  assert.equal(listed.items.some((item) => item.id === comment.id), true);
  const [idea] = await db.select({ comments: ideas.comments }).from(ideas).where(eq(ideas.id, returnedIdeaId)).all();
  assert.equal(idea.comments, 1);
  assert.equal((await db.select().from(ideaComments).where(eq(ideaComments.id, comment.id)).all()).length, 1);
});

test("idea update schema rejects unknown fields and invalid content", () => {
  assert.throws(() => IdeaUpdateSchema.parse({ title: "x", unknown: true }));
  assert.throws(() => IdeaUpdateSchema.parse({ summary: "too short" }));
});
