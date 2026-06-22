/** Pulsing skeleton matching the patient portal shell (nav + content cards). */
export function PortalLoadingSkeleton() {
  return (
    <div className="flex min-h-[60vh] flex-col animate-pulse">
      {/* Navy header skeleton */}
      <div className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="h-8 w-32 rounded-md bg-navy/20" />
          <div className="flex gap-2">
            <div className="hidden h-9 w-28 rounded-lg bg-navy/10 sm:block" />
            <div className="hidden h-9 w-24 rounded-lg bg-navy/10 sm:block" />
            <div className="h-9 w-20 rounded-lg bg-navy/10" />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <div className="h-9 w-56 rounded-lg bg-navy/15" />

        <div className="rounded-xl bg-white p-6 ring-1 ring-navy/10">
          <div className="h-5 w-40 rounded bg-teal/20" />
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-10 w-36 rounded-lg bg-teal/25" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-6 ring-1 ring-navy/10">
            <div className="h-5 w-32 rounded bg-teal/20" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-gray-200" />
              <div className="h-3 w-3/4 rounded bg-gray-200" />
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 ring-1 ring-navy/10">
            <div className="h-5 w-28 rounded bg-teal/20" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-gray-200" />
              <div className="h-3 w-2/3 rounded bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 ring-1 ring-navy/10">
          <div className="h-5 w-36 rounded bg-teal/20" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-5/6 rounded bg-gray-200" />
            <div className="h-3 w-4/6 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
