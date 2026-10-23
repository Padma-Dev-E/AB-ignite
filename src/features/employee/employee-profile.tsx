"use client";

import React, { useState } from "react";
import { ApiError } from "../../lib/api/client";
import { Button, Card } from "../../components/ui";
import { usePointsSummary } from "../points/hooks";
import { useEmployeeProfile, useUpdateEmployeeProfile } from "./profile-hooks";

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export type EmployeeProfileCardProps = {
  className?: string;
  editable?: boolean;
};

/** Live employee profile with current rewards balance and level. */
export function EmployeeProfileCard({ className = "", editable = true }: EmployeeProfileCardProps) {
  const profileQuery = useEmployeeProfile();
  const rewardsQuery = usePointsSummary();
  const update = useUpdateEmployeeProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  const profile = profileQuery.data;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim(), department: department.trim() });
      setEditing(false);
    } catch { /* mutation error is displayed inline */ }
  }

  return <Card className={className}>
    {profileQuery.isPending ? <p className="text-sm text-muted" role="status">Loading profile…</p> : profileQuery.isError ? <div><h2 className="text-lg font-medium">Profile is temporarily unavailable</h2><p className="mt-1 text-sm text-muted" role="alert">{errorMessage(profileQuery.error)}</p><Button className="mt-3" onClick={() => void profileQuery.refetch()}>Try again</Button></div> : profile && <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-medium uppercase tracking-[.12em] text-blue">Employee profile</p><h2 className="mt-1 text-xl font-medium">{profile.name}</h2><p className="mt-1 text-sm text-muted">{profile.jobTitle ? `${profile.jobTitle} · ` : ""}{profile.department}</p><p className="mt-1 text-sm text-muted">{profile.email}</p></div>
      {editable && !editing && <Button size="small" onClick={() => { setName(profile.name); setDepartment(profile.department); setEditing(true); }}>Edit profile</Button>}
    </div>

    {editing && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
      <label className="block"><span className="field-label">Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
      <label className="block"><span className="field-label">Department</span><input className="input" value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={120} required /></label>
      {update.isError && <p className="text-sm text-[#d6336c] sm:col-span-2" role="alert">{errorMessage(update.error)}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button variant="primary" type="submit" disabled={!name.trim() || !department.trim() || update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button><Button type="button" disabled={update.isPending} onClick={() => setEditing(false)}>Cancel</Button></div>
    </form>}
    </>}

    <div className="mt-5 grid grid-cols-2 gap-2">
      {rewardsQuery.isPending ? <div className="tile col-span-2 text-sm text-muted" role="status">Loading points and level…</div> : rewardsQuery.isError ? <div className="tile col-span-2"><p className="text-sm text-muted" role="alert">Points and level are temporarily unavailable: {errorMessage(rewardsQuery.error)}</p><Button className="mt-2" size="small" onClick={() => void rewardsQuery.refetch()}>Try again</Button></div> : <>
        <div className="tile text-center"><b className="block text-xl font-semibold">{rewardsQuery.data.balance.balance}</b><span className="text-xs text-muted">Points</span></div>
        <div className="tile text-center"><b className="block text-xl font-semibold">{rewardsQuery.data.level?.name ?? "Starting level"}</b><span className="text-xs text-muted">Level</span></div>
      </>}
    </div>
  </Card>;
}
