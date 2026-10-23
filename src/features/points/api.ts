import { apiFetch } from "../../lib/api/client";
import type { EmployeePointsSummary } from "./types";

export function getPointsSummary() {
  return apiFetch<EmployeePointsSummary>("/api/points/summary");
}
