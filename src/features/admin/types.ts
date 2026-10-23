export type AdminQuiz = {
  id: number;
  title: string;
  category: string;
  level: string;
  objective: string;
  passMark: number;
  timeLimitSeconds: number | null;
  version: number;
  questionCount: number;
};

export type AdminChallenge = {
  id: number;
  title: string;
  question: string;
  deadlineAt: string;
  points: number;
  participants: number;
  joined: boolean;
};

export type AdminReward = {
  id: number;
  name: string;
  description: string | null;
  kind: "redeem" | "earned";
  cost: number;
  emoji: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminRedemption = {
  id: number;
  userId: number;
  rewardId: number;
  rewardName: string;
  cost: number;
  status: "requested" | "fulfilled" | "cancelled";
  requestedAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  handledBy: number | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  department: string;
  jobTitle: string | null;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
};

export type AdminAuditEvent = {
  id: number;
  createdAt: string;
  actorUserId: number | null;
  sessionId: number | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};
