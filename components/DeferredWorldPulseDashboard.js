"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const WorldPulseDashboard = dynamic(() => import("./WorldPulseDashboard"), {
  ssr: false,
  loading: () => (
    <div className="deferred-pulse__loading">
      <strong>Chargement des analyses détaillées</strong>
      <span>Cette partie est chargée séparément pour préserver la fluidité de la carte.</span>
    </div>
  ),
});

export default function DeferredWorldPulseDashboard() {
  const sectionRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled) return undefined;
    const target = sectionRef.current;
    if (!target || !("IntersectionObserver" in window)) {
      setEnabled(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setEnabled(true);
        observer.disconnect();
      },
      { rootMargin: "220px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <section ref={sectionRef} className="deferred-pulse" aria-label="Analyses détaillées">
      {enabled ? (
        <WorldPulseDashboard />
      ) : (
        <button type="button" onClick={() => setEnabled(true)}>
          Charger les analyses détaillées
        </button>
      )}

      <style jsx>{`
        .deferred-pulse {
          min-height: 120px;
          padding-top: 20px;
        }
        .deferred-pulse > button {
          display: block;
          min-height: 46px;
          margin: 28px auto;
          padding: 0 18px;
          border: 1px solid rgba(95, 218, 201, 0.3);
          border-radius: 12px;
          background: rgba(8, 31, 38, 0.8);
          color: #dff8f4;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .deferred-pulse__loading {
          display: grid;
          gap: 6px;
          width: min(560px, calc(100% - 32px));
          margin: 28px auto;
          padding: 20px;
          border: 1px solid rgba(157, 203, 203, 0.16);
          border-radius: 14px;
          background: rgba(8, 27, 34, 0.7);
          text-align: center;
        }
        .deferred-pulse__loading span {
          color: #9cb7ba;
          font-size: 0.74rem;
        }
      `}</style>
      <style jsx global>{`
        .deferred-pulse .pulse-shell .top-strip,
        .deferred-pulse .pulse-shell .map-experience {
          display: none !important;
        }
        .deferred-pulse .pulse-shell {
          padding-top: 0;
        }
      `}</style>
    </section>
  );
}
