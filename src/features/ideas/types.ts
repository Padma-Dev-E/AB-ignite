export type IdeaStatus = "screening" | "returned" | "business_review" | "control_review" | "decision" | "poc" | "implementation" | "implemented" | "rejected" | "deferred";
export type IdeaKind = "idea" | "problem";

export type Idea = {
  id: number;
  authorId: number;
  kind: IdeaKind;
  title: string;
  summary: string;
  problem: string | null;
  solution: string | null;
  benefits: string | null;
  risks: string | null;
  category: string;
  status: IdeaStatus;
  priorityBand: "Watch" | "Qualify" | "Priority" | null;
  priorityScore: number | null;
  reference: string;
  challengeId: number | null;
  buildsOnId: number | null;
  supports: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
};

export type IdeaListParams = { page?: number; pageSize?: number; search?: string; category?: string; status?: IdeaStatus; mine?: boolean };
export type IdeaListResponse = { items: Idea[]; page: number; pageSize: number; total: number; totalPages: number };
export type IdeaCreateInput = {
  kind: IdeaKind;
  title: string;
  summary: string;
  problem?: string;
  solution?: string;
  benefits?: string;
  risks?: string;
  category: string;
  dataClassification?: "public" | "internal" | "confidential" | "restricted";
};
export type IdeaCreateResponse = { idea: Idea; versionId: number };
export type IdeaSubmitResponse = { ideaId: number; versionId: number; runId: number | null; status: string };
export type IdeaComment = { id: number; ideaId: number; authorId: number; body: string; createdAt: string; updatedAt: string; author: { id: number; name: string; department: string } | null };
export type CommentListResponse = { items: IdeaComment[]; page: number; pageSize: number; total: number; totalPages: number };
export type IdeaUpdateInput = Partial<Pick<Idea, "kind" | "title" | "summary" | "problem" | "solution" | "benefits" | "risks" | "category">> & { dataClassification?: "public" | "internal" | "confidential" | "restricted" };
export type IdeaDetailResponse = { idea: Idea; comments: CommentListResponse };
export type SupportResponse = { supported: boolean; supports: number };
