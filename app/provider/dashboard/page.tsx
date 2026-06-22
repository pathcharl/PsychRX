import { redirect } from "next/navigation";

/** Legacy route — redirect to new provider portal. */
export default function LegacyProviderDashboardPage() {
  redirect("/portal/dashboard");
}
