"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPeople, listPersonSessions, peopleQueryKeys, resetPersonSignInSecurity, updatePersonActivation, updatePersonRole, type AdminProfile } from "./people-api";

export function usePeopleUsers() {
  return useQuery({ queryKey: peopleQueryKeys.users, queryFn: listPeople });
}

export function usePersonSessions(userId: number | null) {
  return useQuery({ queryKey: userId === null ? [...peopleQueryKeys.users, "no-user"] : peopleQueryKeys.sessions(userId), queryFn: () => listPersonSessions(userId!), enabled: userId !== null });
}

function usePeopleMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: peopleQueryKeys.users }),
      client.invalidateQueries({ queryKey: ["admin", "users"] }),
      client.invalidateQueries({ queryKey: ["admin", "people", "users"] }),
    ]);
  } });
}

export function useUpdatePersonRole() {
  return usePeopleMutation(({ userId, profile, reason }: { userId: number; profile: AdminProfile; reason: string }) => updatePersonRole(userId, profile, reason));
}

export function useUpdatePersonActivation() {
  return usePeopleMutation(({ userId, active, reason }: { userId: number; active: boolean; reason: string }) => updatePersonActivation(userId, active, reason));
}

export function useResetPersonSignInSecurity() {
  return usePeopleMutation(({ userId, reason }: { userId: number; reason: string }) => resetPersonSignInSecurity(userId, reason));
}
