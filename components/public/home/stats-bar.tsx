import { Separator } from "@/components/ui/separator";

const STATS = [
  { value: "120+", label: "Licensed providers" },
  { value: "3 days", label: "Average wait" },
  { value: "24/7", label: "Online scheduling" },
  { value: "5", label: "Major insurance plans" },
];

export function StatsBar() {
  return (
    <section className="border-y border-navy/10 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <div key={stat.label} className="flex">
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
              <p className="font-heading text-2xl font-bold text-navy sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-psych-text/60">{stat.label}</p>
            </div>
            {index < STATS.length - 1 && (
              <Separator
                orientation="vertical"
                className="hidden h-auto lg:block"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
