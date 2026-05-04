import Masthead from "./components/Masthead";
import Hero from "./components/Hero";
import LiveSignal from "./components/LiveSignal";
import FiveSteps from "./components/FiveSteps";
import Lifecycle from "./components/Lifecycle";
import Capabilities from "./components/Capabilities";
import Comparison from "./components/Comparison";
import FieldNotes from "./components/FieldNotes";
import CommonQuestions from "./components/CommonQuestions";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";

export function LandingPage() {
  return (
    <div className="landing landing-editorial">
      <div className="editorial-grid" aria-hidden="true" />

      <Masthead />
      <Hero />
      <LiveSignal />
      <FiveSteps />
      <Lifecycle />
      <Capabilities />
      <Comparison />
      <FieldNotes />
      <CommonQuestions />
      <FinalCta />
      <Footer />
    </div>
  );
}
