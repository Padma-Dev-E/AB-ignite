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
  points: integer().notNull().default(0),
  rank: integer(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text().notNull(),
  expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
  revokedAt: integer({ mode: "timestamp_ms" }),
  rotatedFromId: integer(),
  ...timestamps,
}, (table) => [
  uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
  index("refresh_tokens_user_idx").on(table.userId),
  index("refresh_tokens_expiry_idx").on(table.expiresAt),
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

export const ideaComments = sqliteTable("idea_comments", {
  id: integer().primaryKey({ autoIncrement: true }),
  ideaId: integer().notNull().references(() => ideas.id, { onDelete: "cascade" }),
  authorId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text().notNull(),
  ...timestamps,
}, (table) => [index("idea_comments_idea_idx").on(table.ideaId)]);

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

export const usersRelations = relations(users, ({ many }) => ({
  ideas: many(ideas),
  comments: many(ideaComments),
  notifications: many(notifications),
  rewards: many(userRewards),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  author: one(users, { fields: [ideas.authorId], references: [users.id] }),
  comments: many(ideaComments),
}));

export const ideaCommentsRelations = relations(ideaComments, ({ one }) => ({
  idea: one(ideas, { fields: [ideaComments.ideaId], references: [ideas.id] }),
  author: one(users, { fields: [ideaComments.authorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const userRewardsRelations = relations(userRewards, ({ one }) => ({
  user: one(users, { fields: [userRewards.userId], references: [users.id] }),
  reward: one(rewards, { fields: [userRewards.rewardId], references: [rewards.id] }),
}));

export const schema = {
  users,
  refreshTokens,
  ideas,
  ideaComments,
  notifications,
  articles,
  quizzes,
  rewards,
  userRewards,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = "admin" | "user";
export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
