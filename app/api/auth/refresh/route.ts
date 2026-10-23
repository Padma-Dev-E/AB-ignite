import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "../../../../auth";
import { db } from "../../../../src/db";
import { refreshTokens, users } from "../../../../src/db/schema";
import {
  accessTokenTtlSeconds,
  authSecret,
  REFRESH_COOKIE_NAME,
  refreshTokenTtlSeconds,
  secureCookies,
  SESSION_COOKIE_NAME,
} from "../../../../src/auth/config";
import { hashRefreshToken, issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "../../../../src/auth/refresh";
import { createSessionTokenPayload } from "../../../../src/auth/session-token";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureCookies,
  path: "/",
};

function requestMetadata(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

async function sessionToken(userId: number, sessionId: number, sessionVersion: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  return encode({
    secret: authSecret,
    salt: SESSION_COOKIE_NAME,
    maxAge: refreshTokenTtlSeconds,
    token: createSessionTokenPayload(user, sessionId, sessionVersion, Date.now() + accessTokenTtlSeconds * 1000),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const rawToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))?.slice(REFRESH_COOKIE_NAME.length + 1);
  const userId = session?.user?.id ? Number(session.user.id) : NaN;
  const sessionId = session?.user?.sessionId ? Number(session.user.sessionId) : NaN;
  const authenticated = Number.isSafeInteger(userId) && session?.isValid !== false && !session?.user?.email?.endsWith("@demo.abignite.invalid");
  const metadata = requestMetadata(request);
  const decodedToken = rawToken ? decodeURIComponent(rawToken) : null;
  const cookieSession = decodedToken && authenticated && Number.isSafeInteger(sessionId)
    ? db.select({ id: refreshTokens.id, userId: refreshTokens.userId }).from(refreshTokens).where(eq(refreshTokens.tokenHash, hashRefreshToken(decodedToken))).limit(1).get()
    : null;
  const matchesAuthenticatedSession = cookieSession?.id === sessionId && cookieSession.userId === userId;
  if (decodedToken && authenticated && !matchesAuthenticatedSession) await revokeRefreshToken(decodedToken, "replaced_on_login");
  const result = decodedToken && (!authenticated || matchesAuthenticatedSession)
    ? await rotateRefreshToken(decodedToken, metadata)
    : authenticated ? await issueRefreshToken(userId, metadata) : null;

  if (!result) return NextResponse.json({ ok: false, error: "Refresh token is invalid or expired." }, { status: 401 });

  const token = await sessionToken(result.userId ?? userId, result.record.id, result.record.sessionVersion);
  if (!token) return NextResponse.json({ ok: false, error: "User no longer exists." }, { status: 401 });

  const sessionExpiresAt = result.record.absoluteExpiresAt ?? result.record.expiresAt;
  const response = NextResponse.json({ ok: true, expiresAt: sessionExpiresAt });
  response.cookies.set(REFRESH_COOKIE_NAME, result.rawToken, { ...cookieOptions, expires: sessionExpiresAt });
  response.cookies.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, expires: sessionExpiresAt });
  return response;
}

export async function DELETE(request: Request) {
  const rawToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))?.slice(REFRESH_COOKIE_NAME.length + 1);
  if (rawToken) await revokeRefreshToken(decodeURIComponent(rawToken), "logout");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
