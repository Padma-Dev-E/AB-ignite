export const CAPABILITIES = {
  IDEAS_READ: "ideas.read",
  IDEAS_WRITE: "ideas.write",
  PROFILE_READ: "profile.read",
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  AUDIT_READ: "audit.read",
  AUDIT_EXPORT: "audit.export",
  SESSIONS_READ: "sessions.read",
  SESSIONS_REVOKE: "sessions.revoke",
  SETTINGS_MANAGE: "settings.manage",
  AI_RUNS_READ: "ai.runs.read",
  AI_RUNS_MANAGE: "ai.runs.manage",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
export type UserRole = "admin" | "user";

const roleCapabilities: Record<UserRole, readonly Capability[]> = {
  user: [CAPABILITIES.IDEAS_READ, CAPABILITIES.IDEAS_WRITE, CAPABILITIES.PROFILE_READ],
  admin: Object.values(CAPABILITIES),
};

export function capabilitiesForRole(role: UserRole): readonly Capability[] {
  return [...roleCapabilities[role]];
}

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return roleCapabilities[role].includes(capability);
}
