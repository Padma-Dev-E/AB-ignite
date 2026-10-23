import { auth } from "../../../../../auth";
import { adminAccess, adminApiError, CAPABILITIES } from "../../../../../src/lib/admin/http";
import { parsePage } from "../../../../../src/lib/admin/query";
import { listUsers } from "../../../../../src/lib/admin/service";
import { requestId } from "../../../../../src/lib/http/errors";

function cell(value: unknown) { const raw = value == null ? "" : String(value); const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export async function GET(request: Request) { const id = requestId(request); try { await adminAccess(await auth(), CAPABILITIES.AUDIT_EXPORT); const page = await listUsers(parsePage(new URL(request.url), 1000)); const csv = "id,name,email,role,department,isActive,createdAt\r\n" + page.items.map((u) => [u.id,u.name,u.email,u.role,u.department,u.isActive,u.createdAt.toISOString()].map(cell).join(",")+"\r\n").join(""); return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="admin-users.csv"', "cache-control": "no-store", "x-request-id": id, ...(page.nextAfter ? { "x-next-after": String(page.nextAfter) } : {}) } }); } catch (error) { return adminApiError(error, id); } }
