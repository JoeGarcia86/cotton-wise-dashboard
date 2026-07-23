/**
 * app/api/wms/route.js  (Next.js App Router API route)
 *
 * Authenticates the same way the real WMS web app does (id.item.com
 * password-grant/exchange-token flow) using a dedicated service account,
 * then calls the real summary-dashboard stat-cards endpoint directly.
 * No AI/Atlas layer in this path â deterministic, fast, and matches
 * exactly what every other facility's dashboard already shows.
 *
 * Required env vars (set in Vercel/Coolify/etc, never in the repo):
 *   WMS_SERVICE_USERNAME
 *   WMS_SERVICE_PASSWORD
 */

const IAM_BASE_URL = "https://id.item.com";
const WMS_BASE_URL = "https://unis.item.com";
const FACILITY_ID = "LT_F133"; // 152-Somerset

let cachedToken = null;
let cachedTenantId = null;
let tokenExpiresAt = 0;

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const decoded = Buffer.from(payload, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function getServiceToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return { token: cachedToken, tenantId: cachedTenantId };
  }

  const username = process.env.WMS_SERVICE_USERNAME;
  const password = process.env.WMS_SERVICE_PASSWORD;
  if (!username || !password) {
    throw new Error("WMS_SERVICE_USERNAME / WMS_SERVICE_PASSWORD are not configured on the server.");
  }

  const res = await fetch(`${IAM_BASE_URL}/auth/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "password", username, password }),
  });

  if (!res.ok) {
    throw new Error(`WMS auth failed with status ${res.status}`);
  }

  const r = await res.json();
  const claims = decodeJwt(r.data.access_token);

  cachedToken = r.data.access_token;
  cachedTenantId = claims?.data?.tenant_id || claims?.tenant_id || "LT";
  tokenExpiresAt = Date.now() + (r.data.expires_in - 120) * 1000;

  return { token: cachedToken, tenantId: cachedTenantId };
}

export async function POST() {
  let auth;
  try {
    auth = await getServiceToken();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }

  const res = await fetch(`${WMS_BASE_URL}/api/wms-bam/portal/summary-dashboard/stat-cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
      "x-tenant-id": auth.tenantId,
      "x-facility-id": FACILITY_ID,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return Response.json(
      { error: `WMS request failed with status ${res.status}`, detail: errText },
      { status: 502 }
    );
  }

  const data = await res.json();
  if (data.code !== 0 || !data.success) {
    return Response.json({ error: data.msg || "WMS returned an error." }, { status: 502 });
  }

  return Response.json({ cards: data.data.cards, updateTime: data.data.updateTime });
}
