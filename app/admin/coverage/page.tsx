import { fetchCoveragePage } from "@/lib/admin/data";
import { CoverageClient } from "@/components/admin/coverage-client";

export const dynamic = "force-dynamic";

export default async function AdminCoveragePage() {
  const data = await fetchCoveragePage();
  return <CoverageClient data={data} />;
}
