import { authSecret } from "../../../../src/auth/config";
import { appendAuditEvent } from "../../../../src/lib/audit/service";
import { apiError, requestId } from "../../../../src/lib/http/errors";

/**
 * Name-only demo access is retired. Keep this endpoint as an explicit 410
 * response so old clients and direct callers cannot create passwordless users.
 */
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    appendAuditEvent({
      action: "auth.demo.rejected",
      metadata: { reasonCode: "login_method_removed" },
      ...((process.env.AUTH_AUDIT_HASH_SECRET ?? authSecret).length >= 24
        ? {
            ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
            userAgent: request.headers.get("user-agent"),
          }
        : {}),
    });
  } catch {
    // The legacy sign-in method remains rejected even if audit persistence fails.
  }
  return apiError("login_method_removed", "Sign in with your assigned email and password.", 410, id);
}
