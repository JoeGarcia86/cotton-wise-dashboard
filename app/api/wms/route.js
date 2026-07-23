/**
 * app/api/wms/route.js  (Next.js App Router API route)
 *
 * Talks to the real Atlas AI agent API (https://atlas.item.com), not a
 * generic REST backend. Atlas answers natural-language questions about
 * WMS/TMS data (orders, receipts, tasks, etc.) rather than exposing
 * per-entity REST endpoints.
 *
 * Auth is handled server-side with a service account (ATLAS_USERNAME /
 * ATLAS_PASSWORD env vars) so the browser never sees Atlas credentials --
 * same server-side-credentials pattern used for the TCL dashboard relay.
 *
 * Required env vars (set in Vercel/Coolify/etc, never in the repo):
 *   ATLAS_USERNAME
 *   ATLAS_PASSWORD
 */

const ATLAS_BASE_URL = "https://atlas.item.com";

// Simple in-memory token cache. Fine for a single serverless instance;
// worst case we just re-authenticate slightly more often.
let cachedToken = null;
let cachedTenantId = null;
let tokenExpiresAt = 0;

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const decoded = Buffer.from(payload, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function getAtlasToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return { token: cachedToken, tenantId: cachedTenantId };
  }

  const username = process.env.ATLAS_USERNAME;
  const password = process.env.ATLAS_PASSWORD;
  if (!username || !password) {
    throw new Error("ATLAS_USERNAME / ATLAS_PASSWORD are not configured on the server.");
  }

  const res = await fetch(`${ATLAS_BASE_URL}/api/auth/password-grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Atlas auth failed with status ${res.status}`);
  }

  const data = await res.json();
  const claims = decodeJwt(data.access_token);

  cachedToken = data.access_token;
  cachedTenantId = claims?.data?.tenant_id || claims?.tenant_id;
  // Refresh a couple minutes before actual expiry to avoid edge-of-window failures.
  tokenExpiresAt = Date.now() + (data.expires_in - 120) * 1000;

  return { token: cachedToken, tenantId: cachedTenantId };
}

export async function POST(request) {
  const { question, chatId } = await request.json();

  if (!question) {
    return Response.json({ error: "Missing 'question'." }, { status: 400 });
  }

  let auth;
  try {
    auth = await getAtlasToken();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }

  const atlasRes = await fetch(`${ATLAS_BASE_URL}/api/chat-completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
      "x-tenant-id": auth.tenantId,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      agentId: "atlas-agent",
      chatId, // optional, omit for single-shot questions
      stream: false,
    }),
  });

  if (!atlasRes.ok) {
    const errText = await atlasRes.text().catch(() => "");
    return Response.json(
      { error: `Atlas query failed with status ${atlasRes.status}`, detail: errText },
      { status: 502 }
    );
  }

  const data = await atlasRes.json();
  return Response.json({ text: data.text, steps: data.steps || [] });
}
