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
