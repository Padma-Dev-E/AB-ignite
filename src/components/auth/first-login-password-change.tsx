"use client";

import React, { useState } from "react";
import { Button, Card } from "../ui";
import { passwordInput, passwordPolicyHint } from "../../features/account/password-policy";

export function FirstLoginPasswordChange({ onChangePassword }: { onChangePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    const parsed = passwordInput.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.message === "Invalid input" || issue?.path[0] === "newPassword" ? `${passwordPolicyHint} Choose a password different from your current password.` : "Enter your current password.");
      return;
    }

    setPending(true);
    setError("");
    try {
      await onChangePassword(parsed.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change your password. Please try again.");
      setPending(false);
    }
  };

  return <main className="login-background grid min-h-screen place-items-center p-4 sm:p-6">
    <Card as="div" className="w-full max-w-[460px] overflow-hidden p-0">
      <div className="bg-navy leading-[0]"><img src="/brand-header.jpg" alt="AB Ignite" className="block h-auto w-full" /></div>
      <div className="p-6 sm:px-7 sm:pb-7">
        <h1 className="text-[28px] font-medium tracking-[-.02em]">Change your password</h1>
        <p className="mt-1 text-sm leading-6 text-muted">Set a new password to continue. You’ll be asked to sign in again after it is changed.</p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <label className="block"><span className="field-label">Current password</span><input className="input" type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={pending} /></label>
          <label className="block"><span className="field-label">New password</span><input className="input" type="password" autoComplete="new-password" aria-describedby="first-password-policy" required minLength={10} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={pending} /></label>
          <label className="block"><span className="field-label">Confirm new password</span><input className="input" type="password" autoComplete="new-password" required maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={pending} /></label>
          <p id="first-password-policy" className="text-sm text-muted">{passwordPolicyHint}</p>
          {error && <p className="text-[13.5px] font-medium text-[#c22b45]" role="alert">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={pending}>{pending ? "Saving password…" : "Change password"}</Button>
        </form>
      </div>
    </Card>
  </main>;
}
