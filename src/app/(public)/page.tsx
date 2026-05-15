import { PublicNav } from "@/components/layout/PublicNav";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Hero } from "@/components/public/Hero";
import { LogoWall } from "@/components/public/LogoWall";
import { HowItWorks } from "@/components/public/HowItWorks";
import { Features } from "@/components/public/Features";
import { DemoStrip } from "@/components/public/DemoStrip";
import { Testimonials } from "@/components/public/Testimonials";
import { Pricing } from "@/components/public/Pricing";
import { FAQ } from "@/components/public/FAQ";
import { FinalCTA } from "@/components/public/FinalCTA";

export default function LandingPage() {
  return (
    <>
      <PublicNav />
      <main>
        <Hero />
        <LogoWall />
        <HowItWorks />
        <Features />
        <DemoStrip />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <PublicFooter />
    </>
  );
}
