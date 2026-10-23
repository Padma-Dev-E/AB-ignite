export type Reward = { id: number; name: string; description: string | null; kind: "catalogue" | "earned"; cost: number; emoji: string | null; active: boolean };
export type AdminReward = Reward & { createdAt: string; updatedAt: string };
export type AdminRewardWriteResult = { reward: AdminReward; version: AdminReward & { rewardId: number; version: number; createdBy: number } };
export type RewardsBalance = { userId: number; balance: number; totalEarned: number; updatedAt: string };
export type RewardLevel = { id: number; name: string; minimumPoints: number; [key: string]: unknown } | null;
export type BadgeProgress = { id: number; name: string; description: string | null; ruleJson?: string; awarded: unknown | null; [key: string]: unknown };
export type EmployeeRewards = { balance: RewardsBalance; level: RewardLevel; catalogue: Reward[]; earned: Reward[]; badges: BadgeProgress[] };
