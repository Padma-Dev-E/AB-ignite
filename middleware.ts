import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, canAccessAdminWorkspace, forcedPasswordChangePathAllowed, postLoginPath } from "./src/auth/config";
import { stripSessionCookie } from "./src/auth/session-cookies";

const { auth } = NextAuth(authConfig);

const authorizeRequest = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;
  const retiredDemoSession = Boolean(session?.user?.email?.endsWith("@demo.abignite.invalid"));

  if (session?.isValid === false || retiredDemoSession) {
    if (pathname.startsWith("/api/auth/")) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Authentication required." } }, { status: 401 });
    }
    if (pathname !== "/login") return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/") {
    const destination = session?.user?.mustChangePassword
      ? "/change-password"
      : session?.user ? postLoginPath(session.user.role) : "/login";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (pathname === "/change-password") {
    if (!session?.user) return NextResponse.redirect(new URL("/login", request.url));
    if (!session.user.mustChangePassword) {
      return NextResponse.redirect(new URL(postLoginPath(session.user.role), request.url));
    }
  }

  if (session?.isValid !== false && session?.user?.mustChangePassword && !forcedPasswordChangePathAllowed(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Change your password before continuing." } }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  const authenticatedLogin = pathname === "/login" && Boolean(session?.user && session.isValid !== false && !retiredDemoSession);
  if (authenticatedLogin && session?.user) {
    return NextResponse.redirect(new URL(
      session.user.mustChangePassword ? "/change-password" : postLoginPath(session.user.role),
      request.url,
    ));
  }

  if (pathname.startsWith("/private") && !session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!session?.user) return NextResponse.redirect(new URL("/login", request.url));
    if (!canAccessAdminWorkspace(session.user.role)) return NextResponse.redirect(new URL("/private", request.url));
  }

  if (pathname.startsWith("/private/admin") && !canAccessAdminWorkspace(session?.user?.role)) {
    return NextResponse.redirect(new URL("/private", request.url));
  }

  return NextResponse.next();
});

export default async function middleware(...args: Parameters<typeof authorizeRequest>) {
  const response = (await authorizeRequest(...args)) ?? NextResponse.next();
  // Auth.js re-signs the request's JWT on every middleware hit. A response that
  // finishes after /api/auth/refresh can otherwise replace its newly rotated JWT.
  return stripSessionCookie(response);
}

export const config = {
  matcher: ["/", "/login", "/change-password", "/private/:path*", "/admin/:path*", "/api/:path*"],
};
