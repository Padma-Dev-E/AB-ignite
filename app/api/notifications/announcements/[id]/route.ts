import { auth } from "../../../../../auth";
import { apiError, handleApiError, ok, requestId } from "../../../../../src/lib/http/errors";
import { getPublishedAnnouncement, notificationUserId } from "../../../../../src/lib/notifications/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    if (!notificationUserId(await auth())) return apiError("unauthorized", "Authentication required.", 401, id);
    const rawId = (await params).id;
    if (!/^[1-9]\d*$/.test(rawId)) return apiError("validation_error", "Invalid announcement ID.", 400, id);
    const announcement = getPublishedAnnouncement(Number(rawId));
    if (!announcement) return apiError("not_found", "Announcement not found.", 404, id);
    return ok(announcement, 200, id);
  } catch (error) { return handleApiError(error, id); }
}
