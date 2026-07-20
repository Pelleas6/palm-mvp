import Header from "../components/Header";
import Footer from "../components/Footer";
import WorldMapGuard from "../components/WorldMapGuard";
import DeferredWorldPulseDashboard from "../components/DeferredWorldPulseDashboard";

export default function Home() {
  return (
    <>
      <Header backLink={null} />
      <div id="carte">
        <WorldMapGuard />
      </div>
      <DeferredWorldPulseDashboard />
      <Footer />
    </>
  );
}
