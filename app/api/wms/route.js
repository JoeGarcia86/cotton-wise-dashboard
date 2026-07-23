/**
 * app/api/wms/route.js  (Next.js App Router API route)
 *
 * Server-side proxy: the browser never talks to the WMS/Atlas backend
 * directly. This route forwards the request and attaches the header
 * the backend actually requires for scoping: x-tenant-id.
 *
 * TODO: set this to your real WMS/Atlas backend base URL.
 */
const WMS_BACKEND_BASE_URL = process.env.WMS_BACKEND_BASE_URL || "https://REPLACE_ME.example.com";

export async function POST(request) {
  const { path, method = "POST", body, token, facilityId, tenantId, timezone } = await request.json();

  if (!token) {
    return Response.json({ code: "401", message: "Missing auth token." }, { status: 401 });
  }
  if (!tenantId) {
    // This is the exact failure mode that looked like a permissions error
    // before: omitting x-tenant-id gets silently rejected/scoped wrong
    // instead of returning a clear "missing tenant" error.
    return Response.json({ code: "400", message: "Missing tenant id." }, { status: 400 });
  }

  const upstreamRes = await fetch(`${WMS_BACKEND_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-facility-id": facilityId,
      "x-timezone": timezone || "America/New_York",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await upstreamRes.json().catch(() => ({}));

  return Response.json(data, { status: upstreamRes.status });
}
