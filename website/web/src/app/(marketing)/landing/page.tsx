import { Benefits } from "@/features/landing/Benefits";
import { Footer } from "@/features/landing/Footer";
import { Hero } from "@/features/landing/Hero";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { LeadForm } from "@/features/landing/LeadForm";
import { Nav } from "@/features/landing/Nav";
import { Trust } from "@/features/landing/Trust";
import { Understand } from "@/features/landing/Understand";

/** The marketing landing page: understand → benefits → trust → action. */
export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Understand />
        <Benefits />
        <HowItWorks />
        <Trust />
        <LeadForm />
      </main>
      <Footer />
    </>
  );
}
