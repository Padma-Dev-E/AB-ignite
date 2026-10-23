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
  sessions: (userId: number) => ["admin", "people", "users", userId, "sessions"] as const,
};

export function listPeople() {
  return apiFetch<{ items: AdminUser[]; nextAfter: number | null }>("/api/admin/users?limit=100");
}

export function listPersonSessions(userId: number) {
  return apiFetch<{ items: AdminUserSession[]; nextAfter: number | null }>(`/api/admin/users/${userId}/sessions?limit=100`);
}

function json(body: unknown): RequestInit {
  return { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function updatePersonRole(userId: number, role: "admin" | "user", reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/role`, json({ role, reason }));
}

export function updatePersonActivation(userId: number, active: boolean, reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/activation`, json({ active, reason }));
}

export function resetPersonSignInSecurity(userId: number, reason: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${userId}/reset`, { ...json({ reason }), method: "POST" });
}
