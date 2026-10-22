import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("auth schema has explicit roles and hashed refresh-token storage", async () => {
  const schema = await source("src/db/schema.ts");
  assert.match(schema, /role:\s*text\(\{\s*enum:\s*\["admin",\s*"user"\]/s);
  assert.match(schema, /sqliteTable\("refresh_tokens"/);
  assert.match(schema, /tokenHash:\s*text\(\)\.notNull\(\)/);
  assert.match(schema, /expiresAt:\s*integer\(\{\s*mode:\s*"timestamp_ms"\s*\}\)\.notNull\(\)/s);
});

test("auth configuration carries role in JWT/session and uses credentials", async () => {
  const auth = await source("auth.ts");
  assert.match(auth, /Credentials\(/);
  assert.match(auth, /session:\s*\{\s*strategy:\s*"jwt"/s);
  assert.match(auth, /token\.role\s*=\s*user\.role/);
  assert.match(auth, /session\.user\.role\s*=\s*token\.role/);
  assert.match(auth, /argon2|verifyPassword/);
});

test("protected layout and refresh endpoint are present", async () => {
  await access(new URL("app/private/layout.tsx", root));
  await access(new URL("app/api/auth/[...nextauth]/route.ts", root));
  await access(new URL("app/api/auth/refresh/route.ts", root));
  const env = await source(".env.example");
  for (const variable of ["AUTH_SECRET", "AUTH_ACCESS_TOKEN_TTL_SECONDS", "AUTH_REFRESH_TOKEN_TTL_SECONDS"]) {
    assert.match(env, new RegExp(`^${variable}=`, "m"));
  }
});

test("seed path defines the requested default admin without storing plaintext", async () => {
  const seed = await source("src/db/seed.ts");
  assert.match(seed, /admin@admin\.com/);
  assert.match(seed, /Test@123/);
  assert.match(seed, /hashPassword/);
  assert.doesNotMatch(seed, /password:\s*['"]Test@123['"]/);
});
