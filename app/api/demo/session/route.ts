import { randomBytes } from "node:crypto";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../src/db/connection";
import { users } from "../../../../src/db/schema";
import { authSecret, demoAccessEnabled, demoSessionSeconds, REFRESH_COOKIE_NAME, secureCookies, SESSION_COOKIE_NAME, accessTokenTtlSeconds } from "../../../../src/auth/config";
import { demoEmail, DEMO_DEPARTMENTS, normalizeDemoName } from "../../../../src/auth/demo-core";
import { issueRefreshToken } from "../../../../src/auth/refresh";
import { appendAuditEvent } from "../../../../src/lib/audit/service";
import { apiError, requestId } from "../../../../src/lib/http/errors";

export const runtime = "nodejs";

const inputSchema = z.strictObject({ name: z.string(), department: z.enum(DEMO_DEPARTMENTS) });
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: secureCookies, path: "/" };

export async function POST(request: Request) {
  const id = requestId(request);
  if (!demoAccessEnabled) return apiError("demo_disabled", "Demo entry is unavailable.", 403, id);
  if (!authSecret || authSecret.length < 24) return apiError("demo_unavailable", "Demo entry is not configured.", 503, id);
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try { originHost = new URL(origin).host; } catch { return apiError("forbidden", "Invalid request origin.", 403, id); }
    if (originHost !== new URL(request.url).host && originHost !== request.headers.get("host")) return apiError("forbidden", "Invalid request origin.", 403, id);
  }
  let input: z.infer<typeof inputSchema>;
  let name: string;
  try {
    input = inputSchema.parse(await request.json());
    name = normalizeDemoName(input.name);
  } catch {
    return apiError("validation_error", "Enter a valid name and department.", 400, id);
  }
  const email = demoEmail(name, authSecret);
  const metadata = {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
  try {
    const now = new Date();
    db.insert(users).values({ name, email, department: input.department, role: "user", passwordHash: randomBytes(32).toString("hex"), createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: users.email }).run();
    const [user] = db.select().from(users).where(eq(users.email, email)).limit(1).all();
    if (!user || !user.isActive || user.role !== "user") return apiError("demo_unavailable", "Demo profile is unavailable.", 403, id);
    const issued = await issueRefreshToken(user.id, metadata);
    if (!issued) return apiError("demo_unavailable", "Demo session could not be created.", 503, id);
    const token = await encode({ secret: authSecret, salt: SESSION_COOKIE_NAME, maxAge: demoSessionSeconds, token: {
      sub: String(user.id), name: user.name, email: user.email, role: "user", sessionId: String(issued.record.id), sessionVersion: user.sessionVersion,
      accessTokenExpires: Date.now() + accessTokenTtlSeconds * 1000,
    } });
    appendAuditEvent({ actorUserId: user.id, sessionId: issued.record.id, action: "auth.demo.enter", targetType: "user", targetId: user.id, ...metadata });
    const response = NextResponse.json({ data: { name: user.name, department: user.department }, error: null, requestId: id }, { headers: { "cache-control": "no-store" } });
    const expires = issued.record.absoluteExpiresAt ?? issued.record.expiresAt;
    response.cookies.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, expires });
    response.cookies.set(REFRESH_COOKIE_NAME, issued.rawToken, { ...cookieOptions, expires });
    return response;
  } catch {
    return apiError("demo_unavailable", "Demo entry is temporarily unavailable.", 503, id);
  }
}
