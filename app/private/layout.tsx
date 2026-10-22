import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { RefreshSession } from "../../src/components/auth/refresh-session";

export default async function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <><RefreshSession />{children}</>;
}
