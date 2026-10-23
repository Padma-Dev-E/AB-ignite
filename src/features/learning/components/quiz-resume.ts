export type QuizResume = { attemptId: number; questionIndex: number; answers: Record<number, string> };
export type ResumeQuestion = { id: number; options: Array<{ optionKey: string }> };

function positiveSafeId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseQuizResume(raw: string | null): QuizResume | null {
  if (!raw || raw.length > 8192) return null;
  if (/^[1-9]\d*$/.test(raw)) {
    const attemptId = Number(raw);
    return positiveSafeId(attemptId) ? { attemptId, questionIndex: 0, answers: {} } : null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const draft = value as Record<string, unknown>;
    if (!positiveSafeId(draft.attemptId) || typeof draft.questionIndex !== "number" || !Number.isSafeInteger(draft.questionIndex) || draft.questionIndex < 0 || draft.questionIndex > 1000) return null;
    if (!draft.answers || typeof draft.answers !== "object" || Array.isArray(draft.answers)) return null;
    const entries = Object.entries(draft.answers);
    if (entries.length > 100 || entries.some(([id, answer]) => !positiveSafeId(Number(id)) || !/^[1-9]\d*$/.test(id) || typeof answer !== "string" || answer.length < 1 || answer.length > 40)) return null;
    return { attemptId: draft.attemptId, questionIndex: draft.questionIndex, answers: Object.fromEntries(entries.map(([id, answer]) => [Number(id), answer])) };
  } catch {
    return null;
  }
}

export function reconcileQuizResume(draft: QuizResume | null, attemptId: number, questions: ResumeQuestion[]): QuizResume | null {
  if (!draft || draft.attemptId !== attemptId) return null;
  const answers: Record<number, string> = {};
  for (const question of questions) {
    const selected = draft.answers[question.id];
    if (selected && question.options.some((option) => option.optionKey === selected)) answers[question.id] = selected;
  }
  return { attemptId, questionIndex: Math.min(draft.questionIndex, Math.max(0, questions.length - 1)), answers };
}

export function serializeQuizResume(draft: QuizResume): string {
  return JSON.stringify(draft);
}
