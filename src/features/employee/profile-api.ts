import { apiFetch } from "../../lib/api/client";

export type EmployeeProfile = {
  id: number;
  name: string;
  email: string;
  department: string;
  jobTitle: string | null;
  [key: string]: unknown;
};

export type EmployeeProfileUpdate = Pick<EmployeeProfile, "name" | "department" | "jobTitle">;

export function getEmployeeProfile() {
  return apiFetch<EmployeeProfile>("/api/profile");
}

export function updateEmployeeProfile(input: Partial<EmployeeProfileUpdate>) {
  return apiFetch<EmployeeProfile>("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
