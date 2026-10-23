"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Notification } from "./engagement-api";

type OpenNotification = (notification: Notification) => void;
const NotificationNavigationContext = createContext<OpenNotification | null>(null);

export function NotificationNavigationProvider({ onOpen, children }: { onOpen: OpenNotification; children: ReactNode }) {
  return <NotificationNavigationContext.Provider value={onOpen}>{children}</NotificationNavigationContext.Provider>;
}

export function useNotificationNavigation() {
  return useContext(NotificationNavigationContext);
}
