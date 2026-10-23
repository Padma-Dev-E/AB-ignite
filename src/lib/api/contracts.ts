/** Browser-safe counterpart of the server's HTTP envelope. */
export type PriorityBreakdownItem = {
  key: "turnaround" | "volume" | "value";
  question: string;
  hint: string;
  score: number;
  weight: number;
  contribution: number;
};

export type PriorityRejectionDetails = {
  score: number;
  minimumScore: number;
  priorityBand: "Watch" | "Quality" | "Priority";
  breakdown: PriorityBreakdownItem[];
};

export type ApiErrorDetails = { code: string; message: string; details?: PriorityRejectionDetails };

export type ApiEnvelope<T> = {
  data: T | null;
  error: ApiErrorDetails | null;
  requestId: string;
};
