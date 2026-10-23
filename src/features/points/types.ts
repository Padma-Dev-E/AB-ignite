export type PointsBalance = { userId: number; balance: number; totalEarned: number; updatedAt: string };
export type PointsLevel = { id: number; name: string; minimumPoints: number; [key: string]: unknown } | null;
export type BadgeProgress = { id: number; name: string; description: string | null; ruleJson?: string; awarded: unknown | null; [key: string]: unknown };
export type EmployeePointsSummary = { balance: PointsBalance; level: PointsLevel; badges: BadgeProgress[] };
