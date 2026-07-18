"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "le-pouls-du-monde:exploration-counted";

function formatCount(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export default function VisitCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let active = true;
    const alreadyCounted = window.sessionStorage.getItem(SESSION_KEY) === "1";
    const url = alreadyCounted ? "/api/visites" : "/api/visites?increment=1";

    fetch(url, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !Number.isFinite(payload?.count)) return;
        if (!alreadyCounted) window.sessionStorage.setItem(SESSION_KEY, "1");
        setCount(payload.count);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!Number.isFinite(count)) return null;

  return (
    <span className="visit-counter" aria-label={`${formatCount(count)} explorations depuis le lancement`}>
      <i aria-hidden="true" />
      {formatCount(count)} explorations depuis le lancement
      <style jsx>{`
        .visit-counter {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #86aaa9;
          font-size: 0.65rem;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #5fdac9;
          box-shadow: 0 0 14px rgba(95, 218, 201, 0.75);
        }
      `}</style>
    </span>
  );
}
