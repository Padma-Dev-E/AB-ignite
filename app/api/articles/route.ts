import { auth } from "../../../auth";
import { ok, requestId } from "../../../src/lib/http/errors";
import { libraryContext, libraryApiError } from "../../../src/lib/articles/http";
import { listLibrary } from "../../../src/lib/articles/service";
export async function GET(request: Request) {
  const id = requestId(request);
  try { const context = await libraryContext(await auth(), request, id); const url = new URL(request.url); const category = url.searchParams.get("category")?.slice(0, 60) || undefined; return ok(await listLibrary(context.userId, category, url.searchParams.get("view") === "recommended"), 200, id); }
  catch (error) { return libraryApiError(error, id); }
}
