import assert from "node:assert/strict";
import test from "node:test";
import { notificationDestination, notificationLocation } from "./notification-navigation";

test("validated notification targets resolve to in-app destinations", () => {
  assert.deepEqual(notificationDestination({ type: "idea", id: 525, path: "/private?ideaId=525", available: true }), { kind: "idea", id: 525 });
  assert.deepEqual(notificationDestination({ type: "announcement", id: 40, path: "/private?announcementId=40", available: true }), { kind: "announcement", id: 40 });
  assert.deepEqual(notificationDestination({ type: "feedback", id: null, path: "/private?view=feedback", available: true }), { kind: "feedback" });
  assert.deepEqual(notificationDestination({ type: "learning", id: null, path: "/private?view=learn&topic=Fraud%20prevention", available: true }), { kind: "recommendation", topic: "Fraud prevention" });
});

test("unavailable, malformed and legacy targets stay in the notification list", () => {
  for (const target of [
    { type: "idea", id: 525, path: null, available: false },
    { type: "none", id: null, path: null, available: false },
    { type: "idea", id: 0, path: "/private?ideaId=0", available: true },
    { type: "learning", id: null, path: "/private?view=learn", available: true },
    { type: "learning", id: null, path: "/private?view=learn&topic=", available: true },
  ] as const) {
    assert.deepEqual(notificationDestination(target), { kind: "none" }, JSON.stringify(target));
  }
});

test("canonical notification URLs restore only supported in-app views", () => {
  assert.deepEqual(notificationLocation("?ideaId=525"), { kind: "idea", id: 525 });
  assert.deepEqual(notificationLocation("?announcementId=40"), { kind: "announcement", id: 40 });
  assert.deepEqual(notificationLocation("?view=feedback"), { kind: "feedback" });
  assert.deepEqual(notificationLocation("?view=learn&topic=Fraud+prevention"), { kind: "recommendation", topic: "Fraud prevention" });
  for (const search of ["?ideaId=0", "?ideaId=1e2", "?ideaId=3&view=feedback", "?view=learn", "?view=learn&topic=", "?view=unknown", "?ideaId=2&ideaId=3"]) {
    assert.deepEqual(notificationLocation(search), { kind: "none" }, search);
  }
});
