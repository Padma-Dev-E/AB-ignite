import { z } from "zod";
import { auth } from "../../../auth";
import { apiError, handleApiError, ok, requestId } from "../../../src/lib/http/errors";
import { listNotifications, notificationUserId, setNotificationRead } from "../../../src/lib/notifications/service";

const querySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
  cursor: z.string().min(1).max(200).optional(),
});
const updateSchema = z.strictObject({ id: z.number().int().positive().optional(), read: z.boolean().default(true), all: z.boolean().default(false) }).refine((value) => Boolean(value.id) !== value.all);

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const userId = notificationUserId(await auth());
    if (!userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    try { return ok(listNotifications(userId, query), 200, id); }
    catch (error) {
      if (error instanceof Error && error.message === "Invalid notification cursor.") return apiError("validation_error", "Invalid notification cursor.", 400, id);
      throw error;
    }
  } catch (error) { return handleApiError(error, id); }
}

export async function PATCH(request: Request) {
  const id = requestId(request);
  try {
    const userId = notificationUserId(await auth());
    if (!userId) return apiError("unauthorized", "Authentication required.", 401, id);
    const input = updateSchema.parse(await request.json());
    if (!setNotificationRead(userId, input)) return apiError("not_found", "Notification not found.", 404, id);
    return ok({ updated: true }, 200, id);
  } catch (error) { return handleApiError(error, id); }
}
