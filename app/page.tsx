import { PageShell } from "@/components/public/page-shell";
import { HeroSection } from "@/components/public/home/hero-section";
import { StatsBar } from "@/components/public/home/stats-bar";
import { ServicesSection } from "@/components/public/home/services-section";
import { HowItWorksSection } from "@/components/public/home/how-it-works-section";
import { ProviderCtaSection } from "@/components/public/home/provider-cta-section";

export default function HomePage() {
  return (
    <PageShell footerNote="PsychRx is a service of Balance Point Medical Corp">
      <HeroSection />
      <StatsBar />
      <ServicesSection />
      <HowItWorksSection />
      <ProviderCtaSection />
    </PageShell>
  );
}
