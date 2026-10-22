import { desc, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { auth } from "../../../auth";
import { db } from "../../../src/db/connection";
import { ideaEvents, ideas } from "../../../src/db/schema";
import { createIdeaVersion } from "../../../src/lib/ideas/repository";
import { IdeaInputSchema } from "../../../src/lib/ideas/schemas";
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
    if (!session?.user || !userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const rows = session.user.role === "admin"
      ? await db.select().from(ideas).orderBy(desc(ideas.createdAt)).all()
      : await db.select().from(ideas).where(eq(ideas.authorId, userId)).orderBy(desc(ideas.createdAt)).all();
    return ok(rows, 200, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const session = await auth();
    const userId = sessionUserId(session);
    if (!session?.user || !userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const input = IdeaInputSchema.parse(await request.json());
    const reference = `IDEA-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const [idea] = await db.insert(ideas).values({
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
    if (!idea) throw new Error("Idea was not created");
    const version = await createIdeaVersion({ ...input, ideaId: idea.id, authorId: userId, version: 1, contentHash });
    await db.insert(ideaEvents).values({ ideaId: idea.id, ideaVersionId: version.id, actorType: session.user.role, actorId: userId, eventType: "created", correlationId: id }).run();
    return ok({ idea, versionId: version.id }, 201, id);
  } catch (error) {
    return handleApiError(error, id);
  }
}
