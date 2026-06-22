import { AdminMobileNav, AdminSidebar } from "./admin-sidebar";

export function AdminShell({
  fillRate,
  children,
}: {
  fillRate: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-psych-bg">
      <AdminSidebar fillRate={fillRate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav fillRate={fillRate} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
