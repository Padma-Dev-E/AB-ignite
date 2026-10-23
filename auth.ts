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
import { authorizeCredentialLogin } from "./src/auth/credentials-login";
import { stripSessionCookie } from "./src/auth/session-cookies";

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

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        return authorizeCredentialLogin(credentials, request, {
          async findUser(email) {
            const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
            return user ?? null;
          },
          verifyPassword,
          recordLoginFailure,
          recordLoginSuccess,
          issueSession: issueRefreshToken,
          appendAudit: appendAuditEvent,
        });
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
        token.name = user.name;
        token.email = user.email;
        token.mustChangePassword = user.mustChangePassword;
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
        if (!current || current.email.endsWith("@demo.abignite.invalid") || !current.isActive || current.sessionVersion !== token.sessionVersion || (sessionId !== null && (!session || !isSessionActive(session, current)))) {
          token.sessionRevoked = true;
        } else {
          token.role = current.role;
          token.name = current.name;
          token.email = current.email;
          token.mustChangePassword = current.mustChangePassword;
          token.sessionVersion = current.sessionVersion;
          token.sessionRevoked = false;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role;
      if (token.sessionId) session.user.sessionId = token.sessionId;
      session.user.mustChangePassword = token.mustChangePassword === true;
      session.accessTokenExpires = token.accessTokenExpires;
      session.isValid = token.sessionRevoked !== true;
      return session;
    },
  },
});

export const { auth, signIn, signOut } = nextAuth;

// SessionProvider refetches /api/auth/session on focus. Auth.js reissues the
// request JWT there too, so a delayed response could undo a refresh rotation.
const { GET, POST } = nextAuth.handlers;
export const handlers = {
  GET: async (...args: Parameters<typeof GET>) => {
    const response = await GET(...args);
    return args[0].nextUrl.pathname === "/api/auth/session" ? stripSessionCookie(response) : response;
  },
  POST: async (...args: Parameters<typeof POST>) => {
    const response = await POST(...args);
    return args[0].nextUrl.pathname === "/api/auth/session" ? stripSessionCookie(response) : response;
  },
};
