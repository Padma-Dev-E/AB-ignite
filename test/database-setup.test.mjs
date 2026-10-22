import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("database setup defines the core AB Ignite persistence tables", async () => {
  const schema = await readFile(new URL("../src/db/schema.ts", import.meta.url), "utf8");
  for (const table of ["users", "ideas", "idea_comments", "notifications", "articles", "quizzes", "rewards", "user_rewards"]) {
    assert.match(schema, new RegExp(`sqliteTable\\(\\"${table}\\"`));
  }
});

test("database setup includes a migration config and local database example", async () => {
  const config = await readFile(new URL("../drizzle.config.ts", import.meta.url), "utf8");
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(config, /dialect:\s*["']sqlite["']/);
  assert.match(config, /schema:\s*["']\.\/src\/db\/schema\.ts["']/);
  assert.match(env, /DATABASE_URL=\.\/data\/ab-ignite\.db/);
});
