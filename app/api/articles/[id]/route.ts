import { auth } from "../../../../auth";
import { ok, requestId } from "../../../../src/lib/http/errors";
import { libraryContext, libraryApiError } from "../../../../src/lib/articles/http";
import { getLibraryArticle, LibraryError } from "../../../../src/lib/articles/service";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try { await libraryContext(await auth(), request, id); const articleId = Number((await params).id); if (!Number.isInteger(articleId) || articleId < 1) throw new LibraryError("Invalid article id.", "VALIDATION_ERROR", 400); return ok(await getLibraryArticle(articleId), 200, id); }
  catch (error) { return libraryApiError(error, id); }
}
