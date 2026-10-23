"use client";

import { signOut } from "next-auth/react";
import { FirstLoginPasswordChange } from "../../src/components/auth/first-login-password-change";
import { apiFetch } from "../../src/lib/api/client";

export default function ChangePasswordPage() {
  async function changePassword(input: { currentPassword: string; newPassword: string }) {
    const result = await apiFetch<{ changed: boolean; sessionsRevoked: boolean }>("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!result.changed || !result.sessionsRevoked) throw new Error("Password change was not confirmed. Please try again.");
    await signOut({ callbackUrl: "/login" });
  }

  return <FirstLoginPasswordChange onChangePassword={changePassword} />;
}
