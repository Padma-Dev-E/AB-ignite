import { createHash, randomBytes } from "node:crypto";
import { auth } from "../../../auth";
import { db } from "../../../src/db/connection";
import { ideaEvents, ideaVersions, ideas } from "../../../src/db/schema";
import { IdeaInputSchema, IdeaListQuerySchema } from "../../../src/lib/ideas/schemas";
import { listIdeas } from "../../../src/lib/ideas/repository";
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
    const reference = `IDEA-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const { idea, version } = await db.transaction((tx) => {
      const [createdIdea] = tx.insert(ideas).values({
        authorId: userId,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        problem: input.problem,
        solution: input.solution,
        benefits: input.benefits,
        risks: input.risks,
        category: input.category,
        reference,
      }).returning().all();
      if (!createdIdea) throw new Error("Idea was not created");
      const [createdVersion] = tx.insert(ideaVersions).values({ ...input, ideaId: createdIdea.id, authorId: userId, version: 1, contentHash }).returning().all();
      if (!createdVersion) throw new Error("Idea version was not created");
      tx.insert(ideaEvents).values({ ideaId: createdIdea.id, ideaVersionId: createdVersion.id, actorType: session.user.role, actorId: userId, eventType: "created", correlationId: id }).run();
      return { idea: createdIdea, version: createdVersion };
    });
    return ok({ idea, versionId: version.id }, 201, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
