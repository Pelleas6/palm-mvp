import Header from "../components/Header";
import Footer from "../components/Footer";
import WorldMap from "../components/WorldMap";
import DeferredWorldPulseDashboard from "../components/DeferredWorldPulseDashboard";

export default function Home() {
  return (
    <>
      <Header backLink={null} />
      <WorldMap />
      <DeferredWorldPulseDashboard />
      <Footer />
    </>
  );
}
