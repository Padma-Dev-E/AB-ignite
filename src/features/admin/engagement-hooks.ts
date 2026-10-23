"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminEngagementKeys, executeEngagementCommand, listAdminAnnouncements, listAdminCampaigns, listManagedChallenges } from "./engagement-api";

export const useAdminAnnouncements = () => useQuery({ queryKey: adminEngagementKeys.announcements, queryFn: listAdminAnnouncements });
export const useAdminCampaigns = () => useQuery({ queryKey: adminEngagementKeys.campaigns, queryFn: listAdminCampaigns });
export const useManagedChallenges = () => useQuery({ queryKey: adminEngagementKeys.challenges, queryFn: listManagedChallenges });
export function useAdminEngagementCommand() {
  const client = useQueryClient();
  return useMutation({ mutationFn: executeEngagementCommand, retry: false, onSuccess: () => {
    // Refresh every mounted admin/employee view affected by lifecycle changes.
    void client.invalidateQueries({ queryKey: ["admin"] });
    void client.invalidateQueries({ queryKey: ["employee"] });
    void client.invalidateQueries({ queryKey: ["challenges"] });
  } });
}
