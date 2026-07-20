import Header from "../components/Header";
import Footer from "../components/Footer";
import WorldPulseDashboard from "../components/WorldPulseDashboard";
import { getWorldPulseDashboardPayload } from "../lib/world-pulse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialPayload = await getWorldPulseDashboardPayload();

  return (
    <>
      <Header backLink={null} />
      <WorldPulseDashboard initialPayload={initialPayload} />
      <Footer />
    </>
  );
}
