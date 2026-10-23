"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addIdeaComment, createIdea, getIdea, getIdeaAiStatus, getIdeaDevelopment, getIdeaPriorityPolicy, ideaQueryKeys, listIdeaComments, listIdeas, queueIdeaDevelopment, saveIdeaSubmission, submitIdea, supportIdea, updateIdea, updateIdeaDraft } from "./api";
import type { IdeaCreateInput, IdeaListParams, IdeaSubmissionInput, IdeaUpdateInput } from "./types";

export function useIdeas(params: IdeaListParams = {}, enabled = true) { return useQuery({ queryKey: ideaQueryKeys.list(params), queryFn: () => listIdeas(params), enabled }); }
export function useIdeaPriorityPolicy() { return useQuery({ queryKey: ["ideas", "priority-policy"] as const, queryFn: getIdeaPriorityPolicy, staleTime: 60_000 }); }
export function useCreateIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: IdeaCreateInput) => createIdea(input), onSuccess: () => { void client.invalidateQueries({ queryKey: ideaQueryKeys.all }); } });
}
export function useSubmitIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, versionId, submitForHumanReview }: { id: number; versionId?: number; submitForHumanReview?: boolean }) => submitIdea(id, versionId, submitForHumanReview), onSuccess: (_data, variables) => {
    void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) });
    void client.invalidateQueries({ queryKey: ideaQueryKeys.all });
  } });
}
export function useSaveIdeaSubmission() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: IdeaSubmissionInput }) => saveIdeaSubmission(id, input), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) }); } });
}
export function useIdea(id: number, enabled = true) { return useQuery({ queryKey: ideaQueryKeys.detail(id), queryFn: () => getIdea(id), enabled: enabled && id > 0 }); }
export function useIdeaAiStatus(id: number, enabled = true) { return useQuery({ queryKey: ["ideas", "ai-status", id] as const, queryFn: () => getIdeaAiStatus(id), enabled: enabled && id > 0, refetchInterval: (query) => { const runs = query.state.data?.runs ?? []; return runs.some((run) => run.status === "queued" || run.status === "running") ? 2000 : false; } }); }
export function useIdeaDevelopment(id: number, enabled = true) { return useQuery({ queryKey: ["ideas", "development", id] as const, queryFn: () => getIdeaDevelopment(id), enabled: enabled && id > 0, refetchInterval: (query) => query.state.data?.runs.some((run) => run.status === "queued" || run.status === "running") ? 2000 : false }); }
export function useUpdateIdeaDraft() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: number; input: IdeaUpdateInput }) => updateIdeaDraft(id, input), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: ["ideas", "development", variables.id] }); } }); }
export function useQueueIdeaDevelopment() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, action }: { id: number; action: "enrich" | "validate" }) => queueIdeaDevelopment(id, action), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: ["ideas", "development", variables.id] }); } }); }
export function useIdeaComments(id: number, params: { page?: number; pageSize?: number } = {}, enabled = true) { return useQuery({ queryKey: ideaQueryKeys.comments(id, params), queryFn: () => listIdeaComments(id, params), enabled: id > 0 && enabled }); }
export function useUpdateIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: IdeaUpdateInput }) => updateIdea(id, input), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) }); void client.invalidateQueries({ queryKey: ideaQueryKeys.all }); } });
}
export function useAddIdeaComment() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: number; body: string }) => addIdeaComment(id, body), onSuccess: (_data, variables) => {
    void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) });
    void client.invalidateQueries({ queryKey: ["ideas", variables.id, "comments"] });
    void client.invalidateQueries({ queryKey: ideaQueryKeys.all });
  } });
}
export function useSupportIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: number) => supportIdea(id), onSuccess: (_data, id) => { void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(id) }); void client.invalidateQueries({ queryKey: ideaQueryKeys.all }); } });
}
