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

async function sessionToken(userId: number) {
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
      accessTokenExpires: Date.now() + accessTokenTtlSeconds * 1000,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const rawToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))?.slice(REFRESH_COOKIE_NAME.length + 1);
  const userId = session?.user?.id ? Number(session.user.id) : NaN;

  const result = rawToken
    ? await rotateRefreshToken(decodeURIComponent(rawToken), { userAgent: request.headers.get("user-agent") })
    : Number.isInteger(userId) ? await issueRefreshToken(userId, { userAgent: request.headers.get("user-agent") }) : null;

  if (!result) return NextResponse.json({ ok: false, error: "Refresh token is invalid or expired." }, { status: 401 });

  const token = await sessionToken(result.userId ?? userId);
  if (!token) return NextResponse.json({ ok: false, error: "User no longer exists." }, { status: 401 });

  const response = NextResponse.json({ ok: true, expiresAt: result.record.expiresAt });
  response.cookies.set(REFRESH_COOKIE_NAME, result.rawToken, { ...cookieOptions, expires: result.record.expiresAt });
  response.cookies.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, expires: new Date(Date.now() + refreshTokenTtlSeconds * 1000) });
  return response;
}

export async function DELETE(request: Request) {
  const rawToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))?.slice(REFRESH_COOKIE_NAME.length + 1);
  if (rawToken) await revokeRefreshToken(decodeURIComponent(rawToken));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
