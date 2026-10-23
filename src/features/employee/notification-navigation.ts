import type { Notification } from "./engagement-api";

export type NotificationDestination =
  | { kind: "idea"; id: number }
  | { kind: "announcement"; id: number }
  | { kind: "feedback" }
  | { kind: "recommendation"; topic: string }
  | { kind: "none" };

export function notificationDestination(target: Notification["target"]): NotificationDestination {
  if (!target?.available || !target.path) return { kind: "none" };
  if (target.type === "idea" && Number.isSafeInteger(target.id) && target.id! > 0 && target.path === `/private?ideaId=${target.id}`) return { kind: "idea", id: target.id! };
  if (target.type === "announcement" && Number.isSafeInteger(target.id) && target.id! > 0 && target.path === `/private?announcementId=${target.id}`) return { kind: "announcement", id: target.id! };
  if (target.type === "feedback" && target.path === "/private?view=feedback") return { kind: "feedback" };
  if (target.type === "learning") {
    const match = /^\/private\?view=learn&topic=(.+)$/.exec(target.path);
    if (!match) return { kind: "none" };
    try {
      const topic = decodeURIComponent(match[1]).trim();
      if (topic && topic.length <= 200 && !/[\u0000-\u001f\u007f]/.test(topic)) return { kind: "recommendation", topic };
    } catch { /* A malformed path remains readable without navigation. */ }
  }
  return { kind: "none" };
}

export function notificationLocation(search: string): NotificationDestination {
  const params = new URLSearchParams(search);
  if (params.size === 1) {
    const idea = params.get("ideaId");
    const announcement = params.get("announcementId");
    if (idea && /^[1-9]\d*$/.test(idea) && Number.isSafeInteger(Number(idea))) return { kind: "idea", id: Number(idea) };
    if (announcement && /^[1-9]\d*$/.test(announcement) && Number.isSafeInteger(Number(announcement))) return { kind: "announcement", id: Number(announcement) };
    if (params.get("view") === "feedback") return { kind: "feedback" };
  }
  if (params.size === 2 && params.get("view") === "learn") {
    const topic = params.get("topic")?.trim();
    if (topic && topic.length <= 200 && !/[\u0000-\u001f\u007f]/.test(topic)) return { kind: "recommendation", topic };
  }
  return { kind: "none" };
}
