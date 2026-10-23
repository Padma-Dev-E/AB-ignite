"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addIdeaComment, createIdea, getIdea, ideaQueryKeys, listIdeaComments, listIdeas, saveIdeaSubmission, submitIdea, supportIdea, updateIdea } from "./api";
import type { IdeaCreateInput, IdeaListParams, IdeaSubmissionInput, IdeaUpdateInput } from "./types";

export function useIdeas(params: IdeaListParams = {}) { return useQuery({ queryKey: ideaQueryKeys.list(params), queryFn: () => listIdeas(params) }); }
export function useCreateIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: IdeaCreateInput) => createIdea(input), onSuccess: () => { void client.invalidateQueries({ queryKey: ideaQueryKeys.all }); } });
}
export function useSubmitIdea() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, versionId }: { id: number; versionId?: number }) => submitIdea(id, versionId), onSuccess: (_data, variables) => {
    void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) });
    void client.invalidateQueries({ queryKey: ideaQueryKeys.all });
  } });
}
export function useSaveIdeaSubmission() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: IdeaSubmissionInput }) => saveIdeaSubmission(id, input), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: ideaQueryKeys.detail(variables.id) }); } });
}
export function useIdea(id: number, enabled = true) { return useQuery({ queryKey: ideaQueryKeys.detail(id), queryFn: () => getIdea(id), enabled: enabled && id > 0 }); }
export function useIdeaComments(id: number, params: { page?: number; pageSize?: number } = {}) { return useQuery({ queryKey: ideaQueryKeys.comments(id, params), queryFn: () => listIdeaComments(id, params), enabled: id > 0 }); }
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
