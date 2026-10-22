"use client";

import { useState } from "react";
import { Button, Card, Field } from "../ui";

function AuthTabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-white p-1" style={{ borderColor: "var(--line)" }}>
    {items.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${active === item ? "bg-blue text-white" : "text-muted hover:bg-[var(--hover)]"}`}>{item}</button>)}
  </div>;
}

function AuthAvatar({ name }: { name: string }) {
  const colors = ["#2F80ED", "#12A383", "#7C5CE0", "#E8891C", "#DB4C7F", "#0E9AD6"];
  const color = colors[name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: color }}>{name.trim()[0]?.toUpperCase() ?? "?"}</span>;
}

export function LoginScreen({ onEnter, onCredentials, showDemo = true }: { onEnter?: (name: string) => void; onCredentials?: (credentials: { email: string; password: string }) => Promise<void>; showDemo?: boolean }) {
  const [tab, setTab] = useState<"demo" | "account">(showDemo ? "demo" : "account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const join = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim()) { setError("Enter your name to join the demo."); return; } onEnter?.(name.trim()); };
  const signIn = async (event: React.FormEvent) => { event.preventDefault(); if (!email.trim() || !password.trim()) { setError("Enter your email and password."); return; } try { if (onCredentials) await onCredentials({ email: email.trim(), password }); else onEnter?.("padmadev"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); } };

  return <main className="login-background grid min-h-screen place-items-center p-4 sm:p-6">
    <Card as="div" className="w-full max-w-[460px] overflow-hidden p-0">
      <div className="bg-navy leading-[0]"><img src="/brand-header.jpg" alt="AB Ignite" className="block h-auto w-full" /></div>
      <div className="p-6 sm:px-7 sm:pb-7">
        <h1 className="text-[28px] font-medium tracking-[-.02em]">{showDemo ? "Welcome" : "Sign in"}</h1>
        <p className="mt-[-2px] text-[15px] text-muted">Share ideas, improve what exists, and shape what’s next.</p>
        {showDemo && <AuthTabs items={["Join the demo", "I have an account"]} active={tab === "demo" ? "Join the demo" : "I have an account"} onChange={(value) => { setTab(value === "Join the demo" ? "demo" : "account"); setError(""); }} />}
        {tab === "demo" ? <form className="mt-4" onSubmit={join}>
          <p className="text-sm leading-6 text-muted">No password needed. Enter your name: your ideas, points and learning are saved under it, and typing the same name later brings you back to your account from any device.</p>
          <label className="mt-4 block"><span className="field-label">Your name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="For example Rami Khalil" /></label>
          <label className="mt-3 block"><span className="field-label">Department</span><select className="input"><option>Technology</option><option>Transformation</option><option>Retail Banking</option><option>Other</option></select></label>
          {error && <p className="mt-3 text-[13.5px] font-medium text-[#c22b45]">{error}</p>}
          <Button type="submit" variant="primary" className="mt-3 w-full">Join the demo</Button>
          <p className="mt-[18px] text-sm text-muted">Or continue as a sample colleague who already has learning history:</p>
          <button type="button" onClick={() => onEnter?.("Ahmad Nasser")} className="mt-2 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left hover:border-blue" style={{ borderColor: "var(--line)" }}><AuthAvatar name="Ahmad Nasser" /><span><b className="font-medium">Ahmad Nasser</b><span className="block text-sm text-muted">Product Analyst, Retail Banking</span></span></button>
          <button type="button" onClick={() => onEnter?.("Omar Saleh")} className="mt-2 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left hover:border-blue" style={{ borderColor: "var(--line)" }}><AuthAvatar name="Omar Saleh" /><span><b className="font-medium">Omar Saleh</b><span className="block text-sm text-muted">Branch Service Lead, Branch Banking</span></span></button>
        </form> : <form className="mt-[18px]" onSubmit={signIn}>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.com" />
          <Field label="Password" type="password" value={password} onChange={setPassword} className="mt-3" />
          {error && <p className="mt-3 text-[13.5px] font-medium text-[#c22b45]">{error}</p>}
          <Button type="submit" variant="primary" className="mt-3 w-full">Sign in</Button>
        </form>}
      </div>
    </Card>
  </main>;
}
