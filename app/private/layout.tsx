import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { RefreshSession } from "../../src/components/auth/refresh-session";
import { hasValidPrivateSession } from "../../src/auth/private-access";

export default async function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!hasValidPrivateSession(session)) redirect("/login");

  return <><RefreshSession />{children}</>;
}
