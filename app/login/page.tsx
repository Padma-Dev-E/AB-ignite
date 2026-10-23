"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "../../src/components/auth/login-screen";

export default function LoginPage() {
  const router = useRouter();

  async function authenticate({ email, password }: { email: string; password: string }) {
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result || result.error || !result.ok) throw new Error("Invalid email or password.");

    const refresh = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    if (!refresh.ok) throw new Error("Unable to establish a secure session.");
    const session = await getSession();
    router.replace(session?.user?.role === "admin" ? "/private/admin" : "/private");
    router.refresh();
  }

  async function joinDemo(details: { name: string; department: string }) {
    const response = await fetch("/api/demo/session", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(details) });
    if (!response.ok) throw new Error(response.status === 403 ? "Demo entry is unavailable." : "Unable to create a demo session. Please try again.");
    router.replace("/private");
    router.refresh();
  }

  return <LoginScreen onEnter={joinDemo} onCredentials={authenticate} />;
}
