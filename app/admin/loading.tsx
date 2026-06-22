export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6 lg:p-8">
      <div className="h-9 w-56 rounded-lg bg-navy/10" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-28 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-28 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-28 rounded-xl bg-white ring-1 ring-navy/10" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-white ring-1 ring-navy/10" />
        <div className="h-72 rounded-xl bg-white ring-1 ring-navy/10" />
      </div>
    </div>
  );
}
