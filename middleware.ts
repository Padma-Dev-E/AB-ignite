import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./src/auth/config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session?.user ? "/private" : "/login", request.url));
  }

  if (pathname === "/login" && session?.user) {
    return NextResponse.redirect(new URL("/private", request.url));
  }

  if (pathname.startsWith("/private") && !session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!session?.user) return NextResponse.redirect(new URL("/login", request.url));
    if (session.user.role !== "admin") return NextResponse.redirect(new URL("/private", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/login", "/private/:path*", "/admin/:path*"],
};
