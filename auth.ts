import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { and, eq } from "drizzle-orm";
import { db } from "./src/db";
import { refreshTokens, users } from "./src/db/schema";
import { accessTokenTtlSeconds, authConfig, refreshTokenTtlSeconds } from "./src/auth/config";
import { isLoginLocked, nextLoginFailure, successfulLoginState, isSessionActive } from "./src/auth/security-core";
import { issueRefreshToken } from "./src/auth/refresh";
import { verifyPassword } from "./src/auth/password";
import { appendAuditEvent } from "./src/lib/audit/service";

function requestMetadata(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

function recordLoginFailure(userId: number, now: Date) {
  return db.transaction((tx) => {
    const [current] = tx.select().from(users).where(eq(users.id, userId)).limit(1).all();
    if (!current) return null;
    const next = nextLoginFailure(current, now);
    tx.update(users).set({
      failedLoginAttempts: next.failedLoginAttempts,
      lockedUntil: next.lockedUntil,
      lastFailedLoginAt: now,
      lastSeenAt: now,
      updatedAt: now,
    }).where(eq(users.id, userId)).run();
    return next;
  });
}

function recordLoginSuccess(userId: number, now: Date) {
  const state = successfulLoginState(now);
  db.update(users).set({
    failedLoginAttempts: state.failedLoginAttempts,
    lockedUntil: state.lockedUntil,
    lastLoginAt: state.lastLoginAt,
    lastSeenAt: now,
    updatedAt: now,
  }).where(eq(users.id, userId)).run();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const metadata = requestMetadata(request);
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) {
          appendAuditEvent({ action: "auth.login.failed", metadata: { reasonCode: "invalid_credentials" }, ...metadata });
          return null;
        }

        if (user.email.endsWith("@demo.abignite.invalid")) return null;

        const now = new Date();
        if (!user.isActive || isLoginLocked(user, now)) {
          appendAuditEvent({ actorUserId: user.id, action: "auth.login.locked", metadata: { reasonCode: user.isActive ? "locked" : "inactive" }, ...metadata });
          return null;
        }

        if (!(await verifyPassword(user.passwordHash, password))) {
          const next = recordLoginFailure(user.id, now);
          appendAuditEvent({
            actorUserId: user.id,
            action: "auth.login.failed",
            metadata: { reasonCode: next?.lockedUntil ? "lockout" : "invalid_credentials", attempts: next?.failedLoginAttempts ?? 0 },
            ...metadata,
          });
          return null;
        }

        recordLoginSuccess(user.id, now);
        const issued = await issueRefreshToken(user.id, metadata);
        if (!issued) return null;
        appendAuditEvent({ actorUserId: user.id, sessionId: issued.record.id, action: "auth.login.succeeded", ...metadata });

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          profile: user.profile,
          sessionId: String(issued.record.id),
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: refreshTokenTtlSeconds },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.profile = user.profile;
        token.name = user.name;
        token.email = user.email;
        token.sessionId = user.sessionId;
        token.sessionVersion = user.sessionVersion;
        token.accessTokenExpires = Date.now() + accessTokenTtlSeconds * 1000;
      }

      if (token.sub) {
        const userId = Number(token.sub);
        const [current] = db.select().from(users).where(eq(users.id, userId)).limit(1).all();
        const sessionId = token.sessionId ? Number(token.sessionId) : null;
        const [session] = sessionId
          ? db.select().from(refreshTokens).where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId))).limit(1).all()
          : [];
        if (!current || !current.isActive || current.sessionVersion !== token.sessionVersion || (sessionId !== null && (!session || !isSessionActive(session, current)))) {
          token.sessionRevoked = true;
        } else {
          token.role = current.role;
          token.profile = current.profile;
          token.name = current.name;
          token.email = current.email;
          token.sessionVersion = current.sessionVersion;
          token.sessionRevoked = false;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role;
      if (token.profile) session.user.profile = token.profile;
      if (token.sessionId) session.user.sessionId = token.sessionId;
      session.accessTokenExpires = token.accessTokenExpires;
      session.isValid = token.sessionRevoked !== true;
      return session;
    },
  },
});
