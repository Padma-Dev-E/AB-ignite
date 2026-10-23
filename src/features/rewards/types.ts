export type Reward = { id: number; name: string; description: string | null; kind: "redeem" | "earned"; cost: number; emoji: string | null; active: boolean };
export type RewardsBalance = { userId: number; balance: number; totalEarned: number; totalSpent: number; updatedAt: string };
export type RewardLevel = { id: number; name: string; minimumPoints: number; [key: string]: unknown } | null;
export type BadgeProgress = { id: number; name: string; description: string | null; awarded: unknown | null; [key: string]: unknown };
export type EmployeeRewards = { balance: RewardsBalance; level: RewardLevel; redeemable: Reward[]; earned: Reward[]; badges: BadgeProgress[] };
export type Redemption = { id: number; userId: number; rewardId: number; rewardVersionId: number; rewardName: string; rewardDescription: string | null; cost: number; status: "requested" | "fulfilled" | "cancelled"; idempotencyKey: string; requestedAt: string; fulfilledAt: string | null; cancelledAt: string | null; createdAt: string; updatedAt: string };
export type RedemptionPage = { items: Redemption[]; page: number; pageSize: number; total: number; totalPages: number };
export type RedemptionResult = { redemption: Redemption; event: unknown | null; balance: RewardsBalance };
