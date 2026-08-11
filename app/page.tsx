import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import EvidenceBoardSection from "@/components/EvidenceBoardSection";
import ScheduleSection from "@/components/ScheduleSection";
import FactionsPreview from "@/components/FactionsPreview";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <EvidenceBoardSection />
        <ScheduleSection />
        <FactionsPreview />
      </main>
      <Footer />
    </>
  );
}
