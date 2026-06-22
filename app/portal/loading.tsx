export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6 lg:p-8">
      <div className="h-8 w-48 rounded-lg bg-navy/10" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-32 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-32 rounded-xl bg-white ring-1 ring-navy/10 sm:col-span-2 lg:col-span-1" />
      </div>
      <div className="h-64 rounded-xl bg-white ring-1 ring-navy/10" />
    </div>
  );
}
