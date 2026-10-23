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
  kind: "catalogue" | "earned";
  cost: number;
  emoji: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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
  role: "employee" | "back_office" | "business_owner";
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
  ipHash?: string | null;
};
export type AdminIdea = { id: number; reference: string; title: string; summary: string; category: string; status: string; priorityBand: string | null; priorityScore: number | null; aiValidationScore?: number | null; aiValidationAttempts?: number; submittedWithLowAiScore?: boolean; authorId: number; authorName: string; department: string; createdAt: string; updatedAt: string };
export type AdminSettings = { priority: Record<string, string>; pointRules: Array<{ id: number; code: string; name: string; points: number; active: boolean }>; recommendationRules: Array<{ id: number; topic: string; thresholdPercent: number; reasonTemplate: string; active: boolean }>; levels: Array<{ id: number; name: string; description: string | null; minimumPoints: number; sortOrder: number }>; departments: string[] };

export type AdminEvaluationDetail = {
  idea: AdminIdea & { problem: string | null; solution: string | null; benefits: string | null; risks: string | null; kind: string };
  submission: {
    answers: Record<string, string> | null;
    metrics: Record<string, string | number> | null;
    breakdown: Array<{ key: string; score: string | number | null; weight: number; explanation: string | null }> | null;
    score: number;
    minimumScore: number;
    validationPassed: boolean;
    aiValidationScore: number | null;
    aiValidationAttempts: number;
    submittedWithLowAiScore: boolean;
    differentiation: string | null;
    submittedAt: string;
  } | null;
  assessment: { jobKey: string; completedAt: string | null; result: unknown } | null;
  route: (Record<string, unknown> & { createdAt: string }) | null;
  controlReview: { required: string[]; approved: string[]; pending: string[] } | null;
};

export type AdminFeedbackResponse = {
  id: number;
  campaignId: number;
  userId: number;
  userName: string;
  category: string;
  message: string;
  response: string | null;
  createdAt: string;
  respondedAt: string | null;
};
