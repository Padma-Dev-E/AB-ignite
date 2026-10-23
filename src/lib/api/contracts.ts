/** Browser-safe counterpart of the server's HTTP envelope. */
export type ApiErrorDetails = { code: string; message: string };

export type ApiEnvelope<T> = {
  data: T | null;
  error: ApiErrorDetails | null;
  requestId: string;
};
