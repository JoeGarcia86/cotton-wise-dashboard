/**
 * lib/wms-client.js
 *
 * Talks to your own Next.js API route (/api/wms), which should proxy to
 * the real WMS/Atlas backend server-side. Facility is fixed to Somerset
 * for this app; tenant comes from the logged-in session, matching what
 * getSession() already stores in sessionStorage under "wms_session".
 */

import { getSession } from "./session"; // wherever getSession/clearSession/login already live

const FACILITY_ID = "LT_F133"; // 152-Somerset
const DEFAULT_TENANT_ID = "LT";
const TIMEZONE = "America/New_York";

async function wmsRequest(path, { method = "POST", body } = {}) {
  const session = getSession();
  if (!session) {
    throw new Error("Not signed in.");
  }

  const res = await fetch("/api/wms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      method,
      body,
      token: session.token,
      facilityId: FACILITY_ID,
      tenantId: session.tenantId || DEFAULT_TENANT_ID,
      timezone: TIMEZONE,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || "Warehouse data is unavailable.");
  }

  const data = await res.json();
  if (data && data.code !== undefined && String(data.code) !== "0") {
    throw new Error(data.message || "Warehouse data is unavailable.");
  }
  return data;
}

export async function getOperationsSummary() {
  const [receipts, orders, tasks] = await Promise.allSettled([
    wmsRequest("/wms-bam/inbound/entry-ticket/search-by-paging", {
      body: { statuses: ["Waiting", "Gate Checked In"], currentPage: 1, pageSize: 1 },
    }),
    wmsRequest("/wms-bam/outbound/order-plan/search-by-paging", {
      body: { currentPage: 1, pageSize: 1 },
    }),
    wmsRequest("/wms-bam/task/search-by-paging", {
      body: { statuses: ["Open", "In Progress"], currentPage: 1, pageSize: 1 },
    }),
  ]);

  const countOf = (result) =>
    result.status === "fulfilled"
      ? result.value?.data?.total ?? result.value?.data?.rows?.length ?? 0
      : null; // null = fetch failed, render "unavailable" rather than a false 0

  return {
    pendingReceipts: countOf(receipts),
    ordersInProgress: countOf(orders),
    openTasks: countOf(tasks),
  };
}
