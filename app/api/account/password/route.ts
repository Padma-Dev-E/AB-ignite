import { auth } from '../../../../auth';
import { libraryContext, libraryApiError } from '../../../../src/lib/articles/http';
import { apiError, ok, requestId } from '../../../../src/lib/http/errors';
import { changePassword, PasswordError } from '../../../../src/features/account/password-service';
export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return apiError('forbidden', 'Cross-origin request refused.', 403, id);
    const context = await libraryContext(await auth(), request, id);
    if (!request.headers.get('content-type')?.includes('application/json')) return apiError('validation_error', 'JSON is required.', 415, id);
    let input: unknown;
    try { input = await request.json(); } catch { return apiError('validation_error', 'Invalid JSON.', 400, id); }
    return ok(await changePassword(context, input), 200, id);
  } catch (error) {
    if (error instanceof PasswordError) return apiError('password_change_failed', error.message, error.status, id);
    return libraryApiError(error, id);
  }
}
