import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
};

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull(),
  role: text({ enum: ["admin", "user"] }).notNull().default("user"),
  department: text().notNull().default("Other"),
  jobTitle: text(),
  passwordHash: text().notNull(),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  failedLoginAttempts: integer().notNull().default(0),
  lockedUntil: integer({ mode: "timestamp_ms" }),
  lastFailedLoginAt: integer({ mode: "timestamp_ms" }),
  lastLoginAt: integer({ mode: "timestamp_ms" }),
  lastSeenAt: integer({ mode: "timestamp_ms" }),
  sessionVersion: integer().notNull().default(0),
  deactivatedAt: integer({ mode: "timestamp_ms" }),
  points: integer().notNull().default(0),
  rank: integer(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text().notNull(),
  expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
  idleExpiresAt: integer({ mode: "timestamp_ms" }),
  absoluteExpiresAt: integer({ mode: "timestamp_ms" }),
  ipHash: text(),
  userAgentHash: text(),
  lastSeenAt: integer({ mode: "timestamp_ms" }),
  sessionVersion: integer().notNull().default(0),
  revokedAt: integer({ mode: "timestamp_ms" }),
  revocationReason: text(),
  rotatedFromId: integer(),
  ...timestamps,
}, (table) => [
  uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
  index("refresh_tokens_user_idx").on(table.userId),
  index("refresh_tokens_expiry_idx").on(table.expiresAt),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: integer().primaryKey({ autoIncrement: true }),
  actorUserId: integer().references(() => users.id, { onDelete: "set null" }),
  sessionId: integer().references(() => refreshTokens.id, { onDelete: "set null" }),
  action: text().notNull(),
  targetType: text(),
  targetId: text(),
  reason: text(),
  metadataJson: text(),
  ipHash: text(),
  userAgentHash: text(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("audit_events_actor_idx").on(table.actorUserId, table.createdAt),
  index("audit_events_action_idx").on(table.action, table.createdAt),
  index("audit_events_target_idx").on(table.targetType, table.targetId, table.createdAt),
]);

export const ideas = sqliteTable("ideas", {
  id: integer().primaryKey({ autoIncrement: true }),
  authorId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text({ enum: ["idea", "problem"] }).notNull().default("idea"),
  title: text().notNull(),
  summary: text().notNull(),
  problem: text(),
  solution: text(),
  benefits: text(),
  risks: text(),
  category: text().notNull(),
  status: text({ enum: ["screening", "returned", "business_review", "control_review", "decision", "poc", "implementation", "implemented", "rejected", "deferred"] }).notNull().default("screening"),
  priorityBand: text({ enum: ["Watch", "Qualify", "Priority"] }),
  priorityScore: real(),
  reference: text().notNull(),
  challengeId: integer(),
  buildsOnId: integer(),
  supports: integer().notNull().default(0),
  comments: integer().notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("ideas_reference_unique").on(table.reference),
  index("ideas_author_idx").on(table.authorId),
  index("ideas_status_idx").on(table.status),
]);

export const ideaVersions = sqliteTable("idea_versions", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  authorId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  version: integer().notNull(),
  kind: text({ enum: ["idea", "problem"] }).notNull(),
  title: text().notNull(),
  summary: text().notNull(),
  problem: text(),
  solution: text(),
  benefits: text(),
  risks: text(),
  category: text().notNull(),
  dataClassification: text({ enum: ["public", "internal", "confidential", "restricted"] }).notNull().default("internal"),
  contentHash: text().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("idea_versions_idea_version_unique").on(table.ideaId, table.version),
  index("idea_versions_idea_idx").on(table.ideaId, table.createdAt),
]);

export const aiRuns = sqliteTable("ai_runs", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  ideaVersionId: integer().references(() => ideaVersions.id, { onDelete: "set null" }),
  jobKey: text().notNull(),
  jobVersion: text().notNull(),
  promptVersion: text().notNull(),
  model: text().notNull(),
  status: text({ enum: ["queued", "running", "succeeded", "failed", "timed_out", "cancelled"] }).notNull().default("queued"),
  idempotencyKey: text().notNull(),
  correlationId: text().notNull(),
  requestedBy: integer().references(() => users.id, { onDelete: "set null" }),
  inputHash: text().notNull(),
  attemptCount: integer().notNull().default(0),
  resultJson: text(),
  usageJson: text(),
  finishReason: text(),
  errorCode: text(),
  errorMessage: text(),
  workerId: text(),
  availableAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  startedAt: integer({ mode: "timestamp_ms" }),
  completedAt: integer({ mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("ai_runs_idempotency_unique").on(table.idempotencyKey),
  index("ai_runs_idea_idx").on(table.ideaId, table.createdAt),
  index("ai_runs_status_available_idx").on(table.status, table.availableAt),
  index("ai_runs_correlation_idx").on(table.correlationId),
]);

export const ideaAiResults = sqliteTable("idea_ai_results", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  ideaVersionId: integer().references(() => ideaVersions.id, { onDelete: "set null" }),
  runId: integer().notNull().references(() => aiRuns.id, { onDelete: "cascade" }),
  jobKey: text().notNull(),
  jobVersion: text().notNull(),
  resultJson: text().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("idea_ai_results_run_unique").on(table.runId),
  index("idea_ai_results_idea_idx").on(table.ideaId, table.createdAt),
]);

export const ideaEvents = sqliteTable("idea_events", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  ideaVersionId: integer().references(() => ideaVersions.id, { onDelete: "set null" }),
  actorType: text({ enum: ["user", "admin", "system", "ai"] }).notNull(),
  actorId: integer().references(() => users.id, { onDelete: "set null" }),
  eventType: text().notNull(),
  fromStatus: text({ enum: ["screening", "returned", "business_review", "control_review", "decision", "poc", "implementation", "implemented", "rejected", "deferred"] }),
  toStatus: text({ enum: ["screening", "returned", "business_review", "control_review", "decision", "poc", "implementation", "implemented", "rejected", "deferred"] }),
  correlationId: text(),
  metadataJson: text(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("idea_events_idea_idx").on(table.ideaId, table.createdAt),
  index("idea_events_correlation_idx").on(table.correlationId),
]);

export const ideaReviews = sqliteTable("idea_reviews", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  reviewerId: integer().references(() => users.id, { onDelete: "set null" }),
  decision: text({ enum: ["approved", "returned", "rejected", "deferred"] }).notNull(),
  reason: text().notNull(),
  conflictAcknowledged: integer({ mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [index("idea_reviews_idea_idx").on(table.ideaId, table.createdAt)]);

export const ideaComments = sqliteTable("idea_comments", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  authorId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text().notNull(),
  ...timestamps,
}, (table) => [index("idea_comments_idea_idx").on(table.ideaId)]);

export const ideaSupports = sqliteTable("idea_supports", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("idea_supports_idea_user_unique").on(table.ideaId, table.userId),
  index("idea_supports_idea_idx").on(table.ideaId),
  index("idea_supports_user_idx").on(table.userId),
]);

export const notifications = sqliteTable("notifications", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text().notNull(),
  title: text().notNull(),
  body: text(),
  link: text(),
  isRead: integer({ mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [index("notifications_user_idx").on(table.userId, table.isRead)]);

export const articles = sqliteTable("articles", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  summary: text().notNull(),
  body: text().notNull(),
  category: text().notNull(),
  topic: text(),
  publisher: text().notNull(),
  difficulty: text().notNull(),
  readingMinutes: integer().notNull(),
  publishedLabel: text(),
  url: text(),
  ...timestamps,
}, (table) => [index("articles_category_idx").on(table.category)]);

export const quizzes = sqliteTable("quizzes", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  category: text().notNull(),
  difficulty: text().notNull(),
  objective: text().notNull(),
  passMark: integer().notNull(),
  pointsPerQuestion: integer().notNull(),
  questionCount: integer().notNull(),
  timeLimitSeconds: integer(),
  ...timestamps,
}, (table) => [index("quizzes_category_idx").on(table.category)]);

export const rewards = sqliteTable("rewards", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  description: text(),
  kind: text().notNull(),
  cost: integer().notNull(),
  emoji: text(),
  active: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const userRewards = sqliteTable("user_rewards", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  rewardId: integer().notNull().references(() => rewards.id, { onDelete: "cascade" }),
  status: text().notNull().default("earned"),
  redeemedAt: integer({ mode: "timestamp_ms" }),
  ...timestamps,
}, (table) => [uniqueIndex("user_rewards_user_reward_unique").on(table.userId, table.rewardId)]);

export const pointRules = sqliteTable("point_rules", {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  description: text(),
  points: integer().notNull(),
  active: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("point_rules_code_unique").on(table.code),
  index("point_rules_active_idx").on(table.active),
]);

export const pointsLedger = sqliteTable("points_ledger", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer().notNull(),
  eventType: text().notNull(),
  sourceType: text().notNull(),
  sourceId: text(),
  idempotencyKey: text().notNull(),
  metadataJson: text(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("points_ledger_idempotency_unique").on(table.idempotencyKey),
  index("points_ledger_user_created_idx").on(table.userId, table.createdAt),
  index("points_ledger_source_idx").on(table.sourceType, table.sourceId),
]);

export const pointsBalances = sqliteTable("points_balances", {
  userId: integer().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer().notNull().default(0),
  totalEarned: integer().notNull().default(0),
  totalSpent: integer().notNull().default(0),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const levels = sqliteTable("levels", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  description: text(),
  minimumPoints: integer().notNull(),
  sortOrder: integer().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("levels_minimum_points_unique").on(table.minimumPoints),
  uniqueIndex("levels_sort_order_unique").on(table.sortOrder),
]);

export const badges = sqliteTable("badges", {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  description: text().notNull(),
  ruleJson: text().notNull(),
  active: integer({ mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("badges_code_unique").on(table.code),
  index("badges_active_idx").on(table.active),
]);

export const userBadges = sqliteTable("user_badges", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer().notNull().references(() => badges.id, { onDelete: "cascade" }),
  awardedAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  metadataJson: text(),
}, (table) => [
  uniqueIndex("user_badges_user_badge_unique").on(table.userId, table.badgeId),
  index("user_badges_user_awarded_idx").on(table.userId, table.awardedAt),
]);

export const rewardVersions = sqliteTable("reward_versions", {
  id: integer().primaryKey({ autoIncrement: true }),
  rewardId: integer().notNull().references(() => rewards.id, { onDelete: "cascade" }),
  version: integer().notNull(),
  name: text().notNull(),
  description: text(),
  kind: text().notNull(),
  cost: integer().notNull(),
  emoji: text(),
  active: integer({ mode: "boolean" }).notNull(),
  createdBy: integer().references(() => users.id, { onDelete: "set null" }),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("reward_versions_reward_version_unique").on(table.rewardId, table.version),
  index("reward_versions_reward_created_idx").on(table.rewardId, table.createdAt),
]);

export const redemptions = sqliteTable("redemptions", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  rewardId: integer().notNull().references(() => rewards.id, { onDelete: "restrict" }),
  rewardVersionId: integer().notNull().references(() => rewardVersions.id, { onDelete: "restrict" }),
  rewardName: text().notNull(),
  rewardDescription: text(),
  cost: integer().notNull(),
  status: text({ enum: ["requested", "fulfilled", "cancelled"] }).notNull().default("requested"),
  idempotencyKey: text().notNull(),
  requestedAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  fulfilledAt: integer({ mode: "timestamp_ms" }),
  cancelledAt: integer({ mode: "timestamp_ms" }),
  handledBy: integer().references(() => users.id, { onDelete: "set null" }),
  cancellationReason: text(),
  ...timestamps,
}, (table) => [
  uniqueIndex("redemptions_idempotency_unique").on(table.idempotencyKey),
  index("redemptions_user_created_idx").on(table.userId, table.createdAt),
  index("redemptions_status_created_idx").on(table.status, table.createdAt),
]);

export const rewardEvents = sqliteTable("reward_events", {
  id: integer().primaryKey({ autoIncrement: true }),
  redemptionId: integer().notNull().references(() => redemptions.id, { onDelete: "cascade" }),
  actorUserId: integer().references(() => users.id, { onDelete: "set null" }),
  eventType: text().notNull(),
  fromStatus: text(),
  toStatus: text(),
  idempotencyKey: text().notNull(),
  metadataJson: text(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("reward_events_idempotency_unique").on(table.idempotencyKey),
  index("reward_events_redemption_created_idx").on(table.redemptionId, table.createdAt),
]);

export const usersRelations = relations(users, ({ many }) => ({
  ideas: many(ideas),
  ideaVersions: many(ideaVersions),
  comments: many(ideaComments),
  notifications: many(notifications),
  supports: many(ideaSupports),
  rewards: many(userRewards),
  refreshTokens: many(refreshTokens),
  auditEvents: many(auditEvents),
  aiRuns: many(aiRuns),
  ideaEvents: many(ideaEvents),
  ideaReviews: many(ideaReviews),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, { fields: [auditEvents.actorUserId], references: [users.id] }),
  session: one(refreshTokens, { fields: [auditEvents.sessionId], references: [refreshTokens.id] }),
}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  author: one(users, { fields: [ideas.authorId], references: [users.id] }),
  comments: many(ideaComments),
  supports: many(ideaSupports),
  versions: many(ideaVersions),
  aiRuns: many(aiRuns),
  aiResults: many(ideaAiResults),
  events: many(ideaEvents),
  reviews: many(ideaReviews),
}));

export const ideaVersionsRelations = relations(ideaVersions, ({ one, many }) => ({
  idea: one(ideas, { fields: [ideaVersions.ideaId], references: [ideas.id] }),
  author: one(users, { fields: [ideaVersions.authorId], references: [users.id] }),
  aiRuns: many(aiRuns),
  aiResults: many(ideaAiResults),
  events: many(ideaEvents),
}));

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  idea: one(ideas, { fields: [aiRuns.ideaId], references: [ideas.id] }),
  ideaVersion: one(ideaVersions, { fields: [aiRuns.ideaVersionId], references: [ideaVersions.id] }),
  requester: one(users, { fields: [aiRuns.requestedBy], references: [users.id] }),
  result: one(ideaAiResults, { fields: [aiRuns.id], references: [ideaAiResults.runId] }),
}));

export const ideaAiResultsRelations = relations(ideaAiResults, ({ one }) => ({
  idea: one(ideas, { fields: [ideaAiResults.ideaId], references: [ideas.id] }),
  ideaVersion: one(ideaVersions, { fields: [ideaAiResults.ideaVersionId], references: [ideaVersions.id] }),
  run: one(aiRuns, { fields: [ideaAiResults.runId], references: [aiRuns.id] }),
}));

export const ideaEventsRelations = relations(ideaEvents, ({ one }) => ({
  idea: one(ideas, { fields: [ideaEvents.ideaId], references: [ideas.id] }),
  ideaVersion: one(ideaVersions, { fields: [ideaEvents.ideaVersionId], references: [ideaVersions.id] }),
  actor: one(users, { fields: [ideaEvents.actorId], references: [users.id] }),
}));

export const ideaReviewsRelations = relations(ideaReviews, ({ one }) => ({
  idea: one(ideas, { fields: [ideaReviews.ideaId], references: [ideas.id] }),
  reviewer: one(users, { fields: [ideaReviews.reviewerId], references: [users.id] }),
}));

export const ideaCommentsRelations = relations(ideaComments, ({ one }) => ({
  idea: one(ideas, { fields: [ideaComments.ideaId], references: [ideas.id] }),
  author: one(users, { fields: [ideaComments.authorId], references: [users.id] }),
}));

export const ideaSupportsRelations = relations(ideaSupports, ({ one }) => ({
  idea: one(ideas, { fields: [ideaSupports.ideaId], references: [ideas.id] }),
  user: one(users, { fields: [ideaSupports.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const userRewardsRelations = relations(userRewards, ({ one }) => ({
  user: one(users, { fields: [userRewards.userId], references: [users.id] }),
  reward: one(rewards, { fields: [userRewards.rewardId], references: [rewards.id] }),
}));

export const pointRulesRelations = relations(pointRules, () => ({}));

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
  user: one(users, { fields: [pointsLedger.userId], references: [users.id] }),
}));

export const pointsBalancesRelations = relations(pointsBalances, ({ one }) => ({
  user: one(users, { fields: [pointsBalances.userId], references: [users.id] }),
}));

export const levelsRelations = relations(levels, () => ({}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
}));

export const rewardVersionsRelations = relations(rewardVersions, ({ one, many }) => ({
  reward: one(rewards, { fields: [rewardVersions.rewardId], references: [rewards.id] }),
  creator: one(users, { fields: [rewardVersions.createdBy], references: [users.id] }),
  redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one, many }) => ({
  user: one(users, { fields: [redemptions.userId], references: [users.id] }),
  reward: one(rewards, { fields: [redemptions.rewardId], references: [rewards.id] }),
  rewardVersion: one(rewardVersions, { fields: [redemptions.rewardVersionId], references: [rewardVersions.id] }),
  handler: one(users, { fields: [redemptions.handledBy], references: [users.id] }),
  events: many(rewardEvents),
}));

export const rewardEventsRelations = relations(rewardEvents, ({ one }) => ({
  redemption: one(redemptions, { fields: [rewardEvents.redemptionId], references: [redemptions.id] }),
  actor: one(users, { fields: [rewardEvents.actorUserId], references: [users.id] }),
}));

export const schema = {
  users,
  refreshTokens,
  auditEvents,
  ideas,
  ideaVersions,
  aiRuns,
  ideaAiResults,
  ideaEvents,
  ideaReviews,
  ideaComments,
  ideaSupports,
  notifications,
  articles,
  quizzes,
  rewards,
  userRewards,
  pointRules,
  pointsLedger,
  pointsBalances,
  levels,
  badges,
  userBadges,
  rewardVersions,
  redemptions,
  rewardEvents,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = "admin" | "user";
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type IdeaVersion = typeof ideaVersions.$inferSelect;
export type NewIdeaVersion = typeof ideaVersions.$inferInsert;
export type AiRun = typeof aiRuns.$inferSelect;
export type NewAiRun = typeof aiRuns.$inferInsert;
export type IdeaAiResult = typeof ideaAiResults.$inferSelect;
export type IdeaEvent = typeof ideaEvents.$inferSelect;
export type IdeaReview = typeof ideaReviews.$inferSelect;
export type IdeaComment = typeof ideaComments.$inferSelect;
export type IdeaSupport = typeof ideaSupports.$inferSelect;
export type PointRule = typeof pointRules.$inferSelect;
export type PointsLedgerEntry = typeof pointsLedger.$inferSelect;
export type PointsBalance = typeof pointsBalances.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type RewardVersion = typeof rewardVersions.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type RewardEvent = typeof rewardEvents.$inferSelect;
