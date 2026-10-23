import type { ComponentType } from "react";
import Home from "../page";

const ProtectedHome = Home as unknown as ComponentType<{ protectedView?: boolean }>;

export default function PrivatePage() {
  return <ProtectedHome protectedView />;
}
