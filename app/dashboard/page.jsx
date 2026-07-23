/**
 * app/dashboard/page.jsx
 *
 * NJ-themed dashboard showing the real summary-dashboard stat cards for
 * 152-Somerset: New Receipts, New Orders, Loading, Pending Tasks,
 * Available Locations, Available Docks.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "../../lib/session";
import { getStatCards } from "../../lib/wms-client";
import "../../styles/nj-theme.css";

const FACILITY_NAME = "152-Somerset";
const TENANT_LABEL = "LT";
const TIMEZONE = "America/New_York";

function MetricCard({ title, subtitle, value }) {
  return (
    <div className="nj-stat-card">
      <p className="nj-stat-label">{title}</p>
      <p className="nj-stat-label" style={{ opacity: 0.7, textTransform: "none", marginTop: "-4px" }}>
        {subtitle}
      </p>
      <p className="nj-stat-value" style={value === null ? { opacity: 0.4 } : undefined}>
        {value === null ? "—" : value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [clock, setClock] = useState("");
  const [cards, setCards] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);

    function tick() {
      setClock(
        new Date().toLocaleString("en-US", {
          timeZone: TIMEZONE,
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    }
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    function load() {
      getStatCards()
        .then((data) => {
          if (!cancelled) {
            setCards(data);
            setLoadError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err.message || "Could not load warehouse data.");
        });
    }

    load();
    const refreshInterval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [session]);

  if (!session) return null;

  return (
    <div className="nj-theme">
      <div className="nj-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <div>
            <p className="nj-eyebrow">Warehouse dashboard</p>
            <h1 className="nj-title">{FACILITY_NAME}</h1>
            <p className="nj-subtitle">
              Garden State Operations · Tenant {TENANT_LABEL} · {clock || TIMEZONE}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--nj-cream-dim)" }}>{session.username}</span>
            <button
              className="nj-btn"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <p style={{ margin: "16px 32px 0", fontSize: 13, color: "#E8938C" }}>
          {loadError} Cards below may show "—" until this is resolved.
        </p>
      )}

      <div className="nj-stats">
        {(cards || Array(6).fill(null)).map((card, i) => (
          <MetricCard
            key={card?.key || i}
            title={card?.title || "—"}
            subtitle={card?.subtitle || "Loading…"}
            value={card?.value ?? null}
          />
        ))}
      </div>
    </div>
  );
}
