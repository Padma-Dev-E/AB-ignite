import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection";
import { quizCategories, quizOptions, quizQuestions, quizVersions, quizzes } from "../../db/schema";

const CATEGORIES = [
  { code: "banking", name: "Banking", sortOrder: 1 },
  { code: "transformation", name: "Transformation", sortOrder: 2 },
  { code: "technology", name: "Technology", sortOrder: 3 },
] as const;

const LEVELS = [
  { code: "beginner", label: "Beginner" },
  { code: "intermediate", label: "Intermediate" },
  { code: "advanced", label: "Advanced" },
  { code: "expert", label: "Expert" },
] as const;

export function ensureQuizCatalogue() {
  return db.transaction((tx) => {
    for (const category of CATEGORIES) {
      tx.insert(quizCategories).values({ code: category.code, name: category.name, sortOrder: category.sortOrder, active: true }).onConflictDoNothing({ target: quizCategories.code }).run();
    }

    let created = 0;
    for (const category of CATEGORIES) {
      for (const level of LEVELS) {
        const title = `${category.name} ${level.label} Essentials`;
        let [quiz] = tx.select().from(quizzes).where(and(eq(quizzes.title, title), eq(quizzes.category, category.code))).limit(1).all();
        if (!quiz) {
          [quiz] = tx.insert(quizzes).values({ title, category: category.code, difficulty: level.code, objective: `Build practical ${category.name.toLowerCase()} knowledge at ${level.label.toLowerCase()} level.`, passMark: 70, pointsPerQuestion: 10, questionCount: 3, timeLimitSeconds: 300 }).returning().all();
          created += 1;
        }
        const [version] = tx.select().from(quizVersions).where(and(eq(quizVersions.quizId, quiz.id), eq(quizVersions.version, 1))).limit(1).all();
        if (version) continue;
        const now = new Date();
        const [createdVersion] = tx.insert(quizVersions).values({ quizId: quiz.id, version: 1, categoryCode: category.code, level: level.code, objective: quiz.objective, passMark: 70, pointsPerQuestion: 10, timeLimitSeconds: 300, published: true, publishedAt: now, createdAt: now, updatedAt: now }).returning().all();
        if (!createdVersion) throw new Error("Quiz version was not created.");
        for (let index = 1; index <= 3; index += 1) {
          const [question] = tx.insert(quizQuestions).values({ quizVersionId: createdVersion.id, topic: `${category.code}-fundamentals`, prompt: `${category.name} ${level.label}: which practice supports a controlled outcome ${index}?`, sortOrder: index, points: 1, createdAt: now, updatedAt: now }).returning().all();
          if (!question) throw new Error("Quiz question was not created.");
          tx.insert(quizOptions).values([
            { questionId: question.id, optionKey: "a", label: "Use a documented, monitored control.", sortOrder: 1, isCorrect: true },
            { questionId: question.id, optionKey: "b", label: "Bypass the control and rely on memory.", sortOrder: 2, isCorrect: false },
            { questionId: question.id, optionKey: "c", label: "Share the responsibility without an owner.", sortOrder: 3, isCorrect: false },
          ]).run();
        }
      }
    }
    return { categories: CATEGORIES.length, quizzes: CATEGORIES.length * LEVELS.length, created };
  });
}
