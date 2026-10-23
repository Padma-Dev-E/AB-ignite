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
import { calculateIdeaPriority, IdeaInputSchema, IdeaListQuerySchema, IdeaUpdateSchema } from "../src/lib/ideas/schemas";
import { getIdeaMinimumScore, getIdeaSubmissionDetails, saveIdeaSubmission, setIdeaMinimumScore } from "../src/lib/ideas/repository";

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
  // Reward and audit records are append-only in production; do not cascade-delete
  // their owning users during tests because immutable triggers must remain active.
});

test("idea list query validates filters and clamps pagination", () => {
  assert.deepEqual(IdeaListQuerySchema.parse({ page: "2", pageSize: "100", search: "  bank  " }), {
    page: 2,
    pageSize: 50,
    search: "bank",
    mine: false,
  });
  assert.throws(() => IdeaListQuerySchema.parse({ page: "0" }));
  assert.throws(() => IdeaListQuerySchema.parse({ mine: "invalid" }));
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
  assert.equal(comment.author?.id, otherUserId);
  const listed = await listIdeaComments(returnedIdeaId, { page: 1, pageSize: 10 });
  assert.equal(listed.items.some((item) => item.id === comment.id), true);
  const [idea] = await db.select({ comments: ideas.comments }).from(ideas).where(eq(ideas.id, returnedIdeaId)).all();
  assert.equal(idea.comments, 1);
  assert.equal((await db.select().from(ideaComments).where(eq(ideaComments.id, comment.id)).all()).length, 1);
});

test("idea update schema rejects unknown fields and invalid content", () => {
  assert.throws(() => IdeaUpdateSchema.parse({ title: "x", unknown: true }));
  assert.throws(() => IdeaUpdateSchema.parse({ summary: "too short" }));
  assert.throws(() => IdeaUpdateSchema.parse({}));
});

test("impact priority uses the required 30/30/40 weights and exposes its breakdown", () => {
  const result = calculateIdeaPriority({ turnaround: 3, volume: 2, value: 1 });
  assert.equal(result.score, 1.9);
  assert.deepEqual(result.breakdown.map((item) => item.weight), [0.3, 0.3, 0.4]);
  assert.equal(result.band, "Qualify");
});

test("idea input validates and stores all five reviewer answers and required metric values", async () => {
  const input = IdeaInputSchema.parse({
    kind: "idea", title: "Five answer idea", summary: "An idea with complete supporting answers and measurable value.", category: "Operations",
    answers: { beneficiaries: "Customers", currentProcess: "Manual", needed: "Automation", risks: "Incorrect routing", successMeasure: "Fewer delays" },
    metrics: { turnaround: 2, volume: 3, value: 1, valueExplanation: "Conservative estimate" },
  });
  assert.throws(() => IdeaInputSchema.parse({ ...input, answers: { beneficiaries: "Only one" } }));
  const [created] = await db.insert(ideas).values({ authorId: ownerId, title: input.title, summary: input.summary, category: input.category, reference: `ANSWERS-${Date.now()}` }).returning().all();
  try {
    const saved = await saveIdeaSubmission({ kind: "user", id: String(ownerId) }, created.id, { answers: input.answers!, metrics: input.metrics! });
    const details = await getIdeaSubmissionDetails(created.id);
    assert.equal(saved.score, 1.9);
    assert.deepEqual(details?.answers, input.answers);
    assert.deepEqual(details?.metrics, input.metrics);
  } finally { await db.delete(ideas).where(eq(ideas.id, created.id)); }
});

test("minimum submission score is configurable and rejects out of range values", async () => {
  const before = await getIdeaMinimumScore();
  try {
    assert.equal(await setIdeaMinimumScore({ kind: "admin", id: String(ownerId) }, 2.4), 2.4);
    assert.equal(await getIdeaMinimumScore(), 2.4);
    await assert.rejects(setIdeaMinimumScore({ kind: "user", id: String(ownerId) }, 1));
    await assert.rejects(setIdeaMinimumScore({ kind: "admin", id: String(ownerId) }, 4));
  } finally { await setIdeaMinimumScore({ kind: "admin", id: String(ownerId) }, before); }
});
