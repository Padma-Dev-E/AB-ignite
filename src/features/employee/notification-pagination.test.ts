import assert from "node:assert/strict";
import test from "node:test";
import { nextNotificationPage } from "./engagement-hooks";
import type { NotificationListResponse } from "./engagement-api";

const page = (pageNumber: number, nextCursor: string | null): NotificationListResponse => ({
  items: [], page: pageNumber, pageSize: 20, total: 50, totalPages: 3, unreadCount: 0, nextCursor,
});

test("notification pagination follows the server cursor across changing totals", () => {
  assert.deepEqual(nextNotificationPage(page(1, "cursor-one")), { page: 2, cursor: "cursor-one" });
  assert.deepEqual(nextNotificationPage(page(2, "cursor-two")), { page: 3, cursor: "cursor-two" });
  assert.equal(nextNotificationPage(page(2, null)), undefined);
});
