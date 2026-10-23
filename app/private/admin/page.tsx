import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { AdminWorkspace } from "../../../src/features/admin/components/admin-workspace";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && !["reviewer", "business_owner", "control", "management"].includes(session.user.profile)) redirect("/private");

  return <AdminWorkspace email={session.user.email ?? "Administrator"} />;
}
