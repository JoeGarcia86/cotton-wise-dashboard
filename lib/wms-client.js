/**
 * lib/wms-client.js
 *
 * Fetches the real summary-dashboard stat cards (via our own /api/wms
 * proxy route) â the same live data every other UNIS facility dashboard
 * shows, for 152-Somerset (facility LT_F133). No AI layer, no guessing.
 */

const CARD_LABELS = {
  receipt: { title: "Inbound", subtitle: "New Receipts" },
  order: { title: "Outbound", subtitle: "New Orders" },
  loading: { title: "Outbound", subtitle: "Loading" },
  pending: { title: "Tasks", subtitle: "Pending Tasks" },
  location: { title: "Inventory", subtitle: "Available Locations" },
  dock: { title: "Yard", subtitle: "Available Docks" },
};

export async function getStatCards() {
  const res = await fetch("/api/wms", { method: "POST" });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || "WMS data is unavailable.");
  }

  const data = await res.json();

  return (data.cards || []).map((card) => ({
    key: card.key,
    title: CARD_LABELS[card.key]?.title || card.key,
    subtitle: CARD_LABELS[card.key]?.subtitle || card.key,
    value: typeof card.current === "number" ? card.current : null,
    progressPct: card.progressPct ?? null,
  }));
}
