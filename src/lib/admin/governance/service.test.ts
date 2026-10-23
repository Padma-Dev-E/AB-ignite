import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../../../db/connection";
import { ideaReviews, ideas, refreshTokens, users } from "../../../db/schema";
import { decideGovernance, getEvaluation, listRoutedEvaluations, requireGovernanceProfile } from "./service";

test("transformation and owner decisions enforce profiles and current assignment", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  function principal(profile: "employee" | "reviewer" | "business_owner" | "management") {
    const user = db.insert(users).values({ name: profile, email: `${profile}-${stamp}@example.test`, role: "user", profile, passwordHash: "test" }).returning({ id: users.id }).get();
    const session = db.insert(refreshTokens).values({ userId: user.id, tokenHash: `${profile}-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
    return { userId: user.id, sessionId: session.id };
  }
  const employee = principal("employee");
  const reviewer = principal("reviewer");
  const owner = principal("business_owner");
  const management = principal("management");
  const idea = db.insert(ideas).values({ authorId: employee.userId, title: "RBAC idea", summary: "Test", category: "Technology", reference: `ABI-RBAC-${stamp}` }).returning({ id: ideas.id }).get();
  await assert.rejects(requireGovernanceProfile(employee, ["reviewer"]));
  await assert.rejects(listRoutedEvaluations(employee));
  await assert.rejects(decideGovernance(management, idea.id, "route", "send for review", owner.userId));
  await assert.rejects(decideGovernance(reviewer, idea.id, "route", "send for review", employee.userId));
  await decideGovernance(reviewer, idea.id, "route", "send for review", owner.userId);
  assert.equal((await listRoutedEvaluations(owner)).items.some((item) => item.id === idea.id), true);
  assert.equal((await getEvaluation(idea.id, owner)).idea.id, idea.id);
  await assert.rejects(decideGovernance(reviewer, idea.id, "confirm", "final confirmation"));
  await assert.rejects(decideGovernance(reviewer, idea.id, "approve", "owner only"));
  await decideGovernance(owner, idea.id, "approve", "business case approved");
  assert.ok(db.select().from(ideaReviews).all().some((review) => review.ideaId === idea.id && review.reviewerId === owner.userId));
  await decideGovernance(reviewer, idea.id, "confirm", "accepted for proof of concept");
});
