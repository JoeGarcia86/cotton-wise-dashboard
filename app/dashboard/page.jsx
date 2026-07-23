/**
 * app/dashboard/page.jsx
 *
 * Shows the real summary-dashboard stat cards for 152-Somerset, the same
 * six metrics every other UNIS facility's dashboard shows: New Receipts,
 * New Orders, Loading, Pending Tasks, Available Locations, Available Docks.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "../../lib/session";
import { getStatCards } from "../../lib/wms-client";

const FACILITY_NAME = "152-Somerset";
const TENANT_LABEL = "LT";
const TIMEZONE = "America/New_York";

function MetricCard({ title, subtitle, value }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      <p
        className={
          value === null
            ? "text-lg font-semibold text-slate-300 mt-2"
            : "text-lg font-semibold text-slate-900 mt-2"
        }
      >
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
    const refreshInterval = setInterval(load, 30000); // matches "updates every 10min" cadence loosely; adjust as needed
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [session]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-slate-900">Cotton WISE</h1>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {FACILITY_NAME}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">{clock}</span>
              <span className="text-sm text-slate-700">{session.username}</span>
              <button
                onClick={() => {
                  clearSession();
                  router.replace("/login");
                }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Operations Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            {FACILITY_NAME} · Tenant {TENANT_LABEL} · {TIMEZONE}
          </p>
          {loadError && (
            <p className="text-sm text-red-600 mt-2">
              {loadError} Cards below may show "—" until this is resolved.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {(cards || Array(6).fill(null)).map((card, i) => (
            <MetricCard
              key={card?.key || i}
              title={card?.title || "—"}
              subtitle={card?.subtitle || "Loading…"}
              value={card?.value ?? null}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
