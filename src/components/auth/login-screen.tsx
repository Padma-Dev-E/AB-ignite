"use client";

import React, { useState } from "react";
import { Button, Card, Field } from "../ui";

export function LoginScreen({ onCredentials }: { onCredentials: (credentials: { email: string; password: string }) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onCredentials({ email: normalizedEmail, password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return <main className="login-background grid min-h-screen place-items-center p-4 sm:p-6">
    <Card as="div" className="w-full max-w-[460px] overflow-hidden p-0">
      <div className="bg-navy leading-[0]"><img src="/brand-header.jpg" alt="AB Ignite" className="block h-auto w-full" /></div>
      <div className="p-6 sm:px-7 sm:pb-7">
        <h1 className="text-[28px] font-medium tracking-[-.02em]">Sign in</h1>
        <p className="mt-[-2px] text-[15px] text-muted">Share ideas, improve what exists, and shape what’s next.</p>
        <form className="mt-[18px]" onSubmit={signIn} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.com" required />
          <Field label="Password" type="password" value={password} onChange={setPassword} className="mt-3" required />
          {error && <p className="mt-3 text-[13.5px] font-medium text-[#c22b45]" role="alert">{error}</p>}
          <Button type="submit" variant="primary" className="mt-3 w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        </form>
      </div>
    </Card>
  </main>;
}
