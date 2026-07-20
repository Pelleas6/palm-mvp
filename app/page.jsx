import Header from "../components/Header";
import Footer from "../components/Footer";
import InteractiveWorldMap from "../components/InteractiveWorldMap";
import WorldPulseDashboard from "../components/WorldPulseDashboard";
import { getWorldPulseDashboardPayload } from "../lib/world-pulse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialPayload = await getWorldPulseDashboardPayload();

  return (
    <>
      <Header backLink={null} />
      <InteractiveWorldMap initialPayload={initialPayload} />
      <div className="legacy-world-dashboard">
        <WorldPulseDashboard initialPayload={initialPayload} />
      </div>
      <Footer />
    </>
  );
}
