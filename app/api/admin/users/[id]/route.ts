import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { positiveId } from "../../../../../src/lib/admin/query";
import { getUserDetail } from "../../../../../src/lib/admin/service";
import { ok, requestId } from "../../../../../src/lib/http/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    await adminAccess(await auth(), CAPABILITIES.USERS_READ);
    return ok(await getUserDetail(positiveId((await params).id)), 200, id);
  } catch (error) { return adminApiError(error, id); }
}
