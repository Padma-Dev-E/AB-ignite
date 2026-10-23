"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminEngagementKeys, executeEngagementCommand, listAdminAnnouncements, listAdminCampaigns, listManagedChallenges } from "./engagement-api";

export const useAdminAnnouncements = (page = 1) => useQuery({ queryKey: [...adminEngagementKeys.announcements, page], queryFn: () => listAdminAnnouncements(page) });
export const useAdminCampaigns = (page = 1) => useQuery({ queryKey: [...adminEngagementKeys.campaigns, page], queryFn: () => listAdminCampaigns(page) });
export const useManagedChallenges = (after: number | null = null) => useQuery({ queryKey: [...adminEngagementKeys.challenges, after], queryFn: () => listManagedChallenges(after) });
export function useAdminEngagementCommand() {
  const client = useQueryClient();
  return useMutation({ mutationFn: executeEngagementCommand, retry: false, onSuccess: () => {
    // Refresh every mounted admin/employee view affected by lifecycle changes.
    void client.invalidateQueries({ queryKey: ["admin"] });
    void client.invalidateQueries({ queryKey: ["employee"] });
    void client.invalidateQueries({ queryKey: ["challenges"] });
  } });
}
