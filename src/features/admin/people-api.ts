import { apiFetch } from "../../lib/api/client";
import type { AdminUser } from "./types";

export type AdminUserSession = {
  id: number;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  sessionVersion: number;
  isActive: boolean;
};

export const peopleQueryKeys = {
  users: ["admin", "people", "users"] as const,
  search: (query: string) => ["admin", "people", "users", "search", query] as const,
  sessions: (userId: number) => ["admin", "people", "users", userId, "sessions"] as const,
};

export function listPeople(after: number | null = null, search = "") {
  const params = new URLSearchParams({ limit: "10" });
  if (after !== null) params.set("after", String(after));
  if (search.trim()) params.set("q", search.trim());
  return apiFetch<{ items: AdminUser[]; nextAfter: number | null }>(`/api/admin/users?${params}`);
}

export function listPersonSessions(userId: number) {
  return apiFetch<{ items: AdminUserSession[]; nextAfter: number | null }>(`/api/admin/users/${userId}/sessions?limit=10`);
}

function json(body: unknown): RequestInit {
  return { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export type AdminRole = AdminUser["role"];
export function createPerson(input: { name: string; email: string; department: string; jobTitle?: string; role: AdminRole; reason: string }) {
  return apiFetch<{ user: AdminUser; temporaryPassword: string }>("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
}
export function updatePersonRole(userId: number, role: AdminRole, reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/role`, json({ role: role, reason }));
}

export function updatePersonActivation(userId: number, active: boolean, reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/activation`, json({ active, reason }));
}

export function resetPersonSignInSecurity(userId: number, reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/reset`, { ...json({ reason }), method: "POST" });
}
export function resetPersonPassword(userId: number, reason: string) {
  return apiFetch<{ temporaryPassword: string }>(`/api/admin/users/${userId}/password`, { ...json({ reason }), method: "POST" });
}
export function revokePersonSession(userId: number, sessionId: number, reason: string) {
  return apiFetch<{ id: number; revokedAt: string }>(`/api/admin/users/${userId}/sessions/${sessionId}`, { ...json({ reason }), method: "DELETE" });
}
