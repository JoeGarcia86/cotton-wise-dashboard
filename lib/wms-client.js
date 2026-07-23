/**
 * lib/wms-client.js
 *
 * Queries the Atlas AI agent (via our own /api/wms proxy route) with
 * natural-language questions scoped to 152-Somerset (facility LT_F133),
 * asking Atlas to answer in strict JSON so we can parse real numbers
 * out of it instead of showing hardcoded placeholders.
 */

const FACILITY_ID = "LT_F133"; // 152-Somerset
const FACILITY_NAME = "152-Somerset";

async function askAtlas(question, chatId) {
  const res = await fetch("/api/wms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, chatId }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || "Atlas is unavailable.");
  }

  const data = await res.json();
  return data.text || "";
}

/**
 * Pull a JSON object out of Atlas's reply even if it wraps it in prose
 * or a markdown code fence, since we can't fully control the agent's
 * exact output formatting.
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;
  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

export async function getOperationsSummary() {
  const question =
    `For facility ${FACILITY_ID} (${FACILITY_NAME}) right now, determine three counts: ` +
    `pendingReceipts (receipts not yet closed/completed), ordersInProgress (orders not yet ` +
    `shipped/closed), and openTasks (tasks in "New" or "In Progress" state across all task types). ` +
    `IMPORTANT: Do not pass a "statuses" filter in any API request, since status enum values vary ` +
    `and an invalid one will cause the request to fail. Instead, either use a status-summary endpoint ` +
    `if one exists, or fetch records without a status filter and classify each by its own status field ` +
    `in your own reasoning. If a request fails, retry once without the status filter before giving up. ` +
    `Respond with ONLY a JSON object and no other text, in exactly this shape: ` +
    `{"pendingReceipts": <integer>, "ordersInProgress": <integer>, "openTasks": <integer>}. ` +
    `Use 0 if a category genuinely has no records, and use null only if you truly cannot determine a value after retrying.`;

  let text;
  try {
    text = await askAtlas(question);
  } catch (err) {
    throw new Error(err.message || "Could not reach Atlas.");
  }

  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error("Atlas responded, but not in the expected format.");
  }

  return {
    pendingReceipts: typeof parsed.pendingReceipts === "number" ? parsed.pendingReceipts : null,
    ordersInProgress: typeof parsed.ordersInProgress === "number" ? parsed.ordersInProgress : null,
    openTasks: typeof parsed.openTasks === "number" ? parsed.openTasks : null,
  };
}
