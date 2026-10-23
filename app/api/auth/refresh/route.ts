import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "../../../../auth";
import { db } from "../../../../src/db";
import { users } from "../../../../src/db/schema";
import {
  accessTokenTtlSeconds,
  authSecret,
  REFRESH_COOKIE_NAME,
  refreshTokenTtlSeconds,
  secureCookies,
  SESSION_COOKIE_NAME,
} from "../../../../src/auth/config";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "../../../../src/auth/refresh";

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
    token: {
      sub: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      sessionId: String(sessionId),
      sessionVersion,
      accessTokenExpires: Date.now() + accessTokenTtlSeconds * 1000,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const rawToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))?.slice(REFRESH_COOKIE_NAME.length + 1);
  const userId = session?.user?.id ? Number(session.user.id) : NaN;
  const metadata = requestMetadata(request);

  const result = rawToken
    ? await rotateRefreshToken(decodeURIComponent(rawToken), metadata)
    : Number.isInteger(userId) && session?.isValid !== false ? await issueRefreshToken(userId, metadata) : null;

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
