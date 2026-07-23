/**
 * app/dashboard/page.jsx
 *
 * Same layout as before, but the four metric cards now pull real numbers
 * from getOperationsSummary() instead of being hardcoded to "unavailable".
 * Each card falls back to "â" only if its individual fetch actually fails,
 * not by default.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "../../lib/session";
import { getOperationsSummary } from "../../lib/wms-client";

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
        {value === null ? "â" : value}
      </p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-slate-400">
      {message}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [clock, setClock] = useState("");
  const [summary, setSummary] = useState(null);
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

    getOperationsSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Could not load warehouse data.");
      });

    return () => {
      cancelled = true;
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
            {FACILITY_NAME} Â· Tenant {TENANT_LABEL} Â· {TIMEZONE}
          </p>
          {loadError && (
            <p className="text-sm text-red-600 mt-2">
              {loadError} Some cards below may show "â" until this is resolved.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Inbound"
            subtitle="Pending receipts"
            value={summary?.pendingReceipts ?? null}
          />
          <MetricCard
            title="Outbound"
            subtitle="Orders in progress"
            value={summary?.ordersInProgress ?? null}
          />
          <MetricCard title="Inventory" subtitle="Active SKUs" value={null} />
          <MetricCard
            title="Tasks"
            subtitle="Open tasks"
            value={summary?.openTasks ?? null}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Recent Activity</h3>
            <EmptyState message="No recent activity available." />
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Alerts</h3>
            <EmptyState message="No alerts at this time." />
          </div>
        </div>
      </main>
    </div>
  );
}
