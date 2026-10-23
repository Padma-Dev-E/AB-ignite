"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmployeeProfile, updateEmployeeProfile, type EmployeeProfileUpdate } from "./profile-api";

export const employeeProfileQueryKeys = { profile: ["employee", "profile"] as const };

export function useEmployeeProfile() {
  return useQuery({ queryKey: employeeProfileQueryKeys.profile, queryFn: getEmployeeProfile });
}

export function useUpdateEmployeeProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EmployeeProfileUpdate>) => updateEmployeeProfile(input),
    onSuccess: (profile) => { client.setQueryData(employeeProfileQueryKeys.profile, profile); },
  });
}
