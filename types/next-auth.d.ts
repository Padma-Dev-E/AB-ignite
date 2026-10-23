import "next-auth";
import "next-auth/jwt";
import type { UserProfile } from "../src/db/schema";

declare module "next-auth" {
  interface User {
    role: "admin" | "user";
    profile: UserProfile;
    sessionId?: string;
    sessionVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
      profile: UserProfile;
      sessionId?: string;
    } & Session["user"];
    accessTokenExpires?: number;
    isValid?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "user";
    profile?: UserProfile;
    sessionId?: string;
    sessionVersion?: number;
    sessionRevoked?: boolean;
    accessTokenExpires?: number;
  }
}
