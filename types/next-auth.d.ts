import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "admin" | "user";
    sessionId?: string;
    sessionVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
      sessionId?: string;
    } & Session["user"];
    accessTokenExpires?: number;
    isValid?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "user";
    sessionId?: string;
    sessionVersion?: number;
    sessionRevoked?: boolean;
    accessTokenExpires?: number;
  }
}
