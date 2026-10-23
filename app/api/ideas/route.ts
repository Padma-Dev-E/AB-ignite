import { createHash, randomBytes } from "node:crypto";
import { desc, ne } from "drizzle-orm";
import { auth } from "../../../auth";
import { db } from "../../../src/db/connection";
import { ideaEvents, ideaVersions, ideas, ideaSubmissions, notifications } from "../../../src/db/schema";
import { IdeaInputSchema, IdeaListQuerySchema } from "../../../src/lib/ideas/schemas";
import { getIdeaMinimumScore, listIdeas } from "../../../src/lib/ideas/repository";
import { calculateIdeaPriority } from "../../../src/lib/ideas/schemas";
import { apiError, handleApiError, ok, requestId } from "../../../src/lib/http/errors";

function sessionUserId(session: { user?: { id?: string | null } } | null) {
  const userId = Number(session?.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = sessionUserId(session);
    if (!session?.user || session.isValid === false || !userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const query = IdeaListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return ok(await listIdeas({ kind: session.user.role, id: String(userId) }, query), 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = sessionUserId(session);
    if (!session?.user || session.isValid === false || !userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const input = IdeaInputSchema.parse(await request.json());
    const { answers, metrics, buildsOnId, differentiation, ...ideaInput } = input;
    const { dataClassification: _dataClassification, ...ideaFields } = ideaInput;
    const allIdeas = await db.select().from(ideas).where(ne(ideas.authorId, userId)).orderBy(desc(ideas.createdAt)).limit(500).all();
    const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3));
    const similarity = (left: string, right: string) => {
      const a = words(left); const b = words(right);
      if (!a.size || !b.size) return 0;
      let overlap = 0; a.forEach((word) => { if (b.has(word)) overlap++; });
      return overlap / (a.size + b.size - overlap);
    };
    const candidates = allIdeas.map((idea) => ({ idea, score: similarity(`${idea.title} ${idea.summary} ${idea.problem ?? ""} ${idea.solution ?? ""}`, `${input.title} ${input.summary} ${input.problem ?? ""} ${input.solution ?? ""}`) }))
      .filter(({ score }) => score >= 0.6).sort((a, b) => b.score - a.score).slice(0, 5);
    const selectedOriginal = buildsOnId
      ? candidates.find(({ idea }) => idea.id === buildsOnId)
      : (differentiation?.trim().length ?? 0) >= 20 ? candidates[0] : undefined;
    if (candidates.length && !selectedOriginal && (differentiation?.trim().length ?? 0) < 20) {
      return apiError("similar_idea", "A similar registered idea exists. Open the original or explain how this idea differs in at least 20 characters.", 409, id);
    }
    if (buildsOnId && !selectedOriginal) return apiError("validation_error", "The selected original is not a matching registered idea.", 400, id);
    const priority = metrics ? calculateIdeaPriority(metrics) : null;
    const minimumScore = await getIdeaMinimumScore();
    const reference = `IDEA-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const { idea, version } = await db.transaction((tx) => {
      const [createdIdea] = tx.insert(ideas).values({
        authorId: userId,
        ...ideaFields,
        buildsOnId: buildsOnId ?? null,
        ...(priority ? { priorityScore: priority.score, priorityBand: priority.band } : {}),
        reference,
      }).returning().all();
      if (!createdIdea) throw new Error("Idea was not created");
      const [createdVersion] = tx.insert(ideaVersions).values({ ...ideaInput, ideaId: createdIdea.id, authorId: userId, version: 1, contentHash }).returning().all();
      if (!createdVersion) throw new Error("Idea version was not created");
      tx.insert(ideaEvents).values({ ideaId: createdIdea.id, ideaVersionId: createdVersion.id, actorType: session.user.role, actorId: userId, eventType: "created", correlationId: id }).run();
      if (answers && metrics) tx.insert(ideaSubmissions).values({ ideaId: createdIdea.id, answersJson: JSON.stringify(answers), metricsJson: JSON.stringify(metrics), score: priority!.score, minimumScore, differentiation: differentiation ?? null }).run();
      if (selectedOriginal) tx.insert(notifications).values({ userId: selectedOriginal.idea.authorId, type: "idea_builds_on", title: "A colleague built on your idea", body: `${selectedOriginal.idea.reference} has been used as the basis for a related idea.`, link: `/ideas/${selectedOriginal.idea.id}` }).run();
      return { idea: createdIdea, version: createdVersion };
    });
    return ok({ idea, versionId: version.id }, 201, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
