import { requireAuth } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const user = await requireAuth("admin");

  return (
    <main className="min-h-screen bg-navy-50 p-8">
      <h1 className="text-2xl font-bold text-navy-900">Admin Dashboard</h1>
      <p className="mt-2 text-navy-600">Signed in as {user.email}</p>
    </main>
  );
}
