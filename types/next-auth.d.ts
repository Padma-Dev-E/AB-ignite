import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "admin" | "user";
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
    } & Session["user"];
    accessTokenExpires?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "user";
    accessTokenExpires?: number;
  }
}
