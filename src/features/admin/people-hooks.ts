"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPerson, listPeople, listPersonSessions, peopleQueryKeys, resetPersonPassword, resetPersonSignInSecurity, revokePersonSession, updatePersonActivation, updatePersonRole, type AdminProfile } from "./people-api";

export function usePeopleUsers() {
  return useInfiniteQuery({ queryKey: peopleQueryKeys.users, queryFn: ({ pageParam }) => listPeople(pageParam), initialPageParam: null as number | null, getNextPageParam: (lastPage) => lastPage.nextAfter ?? undefined });
}
export function useCreatePerson() { return usePeopleMutation((input: { name: string; email: string; department: string; jobTitle?: string; profile: AdminProfile; reason: string }) => createPerson(input)); }

export function usePersonSessions(userId: number | null) {
  return useQuery({ queryKey: userId === null ? [...peopleQueryKeys.users, "no-user"] : peopleQueryKeys.sessions(userId), queryFn: () => listPersonSessions(userId!), enabled: userId !== null });
}

function usePeopleMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
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
export function useResetPersonPassword() {
  return usePeopleMutation(({ userId, reason }: { userId: number; reason: string }) => resetPersonPassword(userId, reason));
}
export function useRevokePersonSession() {
  return usePeopleMutation(({ userId, sessionId, reason }: { userId: number; sessionId: number; reason: string }) => revokePersonSession(userId, sessionId, reason));
}
