import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/private");

  return <main className="app-background min-h-screen px-4 py-8 sm:px-8"><section className="app-card mx-auto max-w-[760px]"><span className="pill text-blue border-blue/45"><span className="pill-dot" />Admin</span><h1 className="mt-4 text-3xl font-medium">Admin workspace</h1><p className="mt-2 text-muted">You are signed in with the administrator role. Administration features will be added here later.</p><div className="mt-6 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--line)" }}><b className="font-medium">Signed in as</b><p className="mt-1 text-muted">{session.user.email}</p><p className="mt-1 text-muted">Role: {session.user.role}</p></div><Link href="/private" className="btn-primary mt-6 inline-flex">Open private app</Link></section></main>;
}
