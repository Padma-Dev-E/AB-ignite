import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../db/connection";
import { refreshTokens } from "../db/schema";
import { refreshTokenTtlSeconds } from "./config";

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newRawToken() {
  return randomBytes(32).toString("base64url");
}

function expiryFrom(now: Date) {
  return new Date(now.getTime() + refreshTokenTtlSeconds * 1000);
}

type RefreshMetadata = { userAgent?: string | null; ipAddress?: string | null };

function insertRefreshToken(executor: typeof db, userId: number, now: Date, rotatedFromId: number | null) {
  const rawToken = newRawToken();
  const [record] = executor.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt: expiryFrom(now),
    rotatedFromId,
  }).returning({ id: refreshTokens.id, expiresAt: refreshTokens.expiresAt }).all();
  return { rawToken, record };
}

export async function issueRefreshToken(userId: number, _metadata?: RefreshMetadata) {
  return { userId, ...insertRefreshToken(db, userId, new Date(), null) };
}

export async function rotateRefreshToken(rawToken: string, _metadata?: RefreshMetadata) {
  const now = new Date();
  return db.transaction((tx) => {
    const [current] = tx.select().from(refreshTokens).where(and(
      eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, now),
    )).limit(1).all();
    if (!current) return null;
    tx.update(refreshTokens).set({ revokedAt: now, updatedAt: now }).where(eq(refreshTokens.id, current.id)).run();
    return { userId: current.userId, ...insertRefreshToken(tx as unknown as typeof db, current.userId, now, current.id) };
  });
}

export async function revokeRefreshToken(rawToken: string) {
  return db.update(refreshTokens).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(
    eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)),
    isNull(refreshTokens.revokedAt),
  )).run();
}
