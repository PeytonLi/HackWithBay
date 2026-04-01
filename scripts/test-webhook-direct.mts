/**
 * Test posting directly to the RocketRide webhook using the public auth key.
 * Usage: npx tsx scripts/test-webhook-direct.mts
 */
import dotenv from "dotenv";

const DEFAULT_WEBHOOK_URL = "http://localhost:64415/webhook?auth=pk_cb10bbc27245a563afc863cfacf64112bb9e2e6c1c12aa5d94dc73713b93d3d0";

dotenv.config({ path: ".env", override: true, quiet: true });

function normalizeWebhookUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  try {
    const url = new URL(trimmed);
    const cleanPath = url.pathname.replace(/\/$/, "");
    url.pathname = /\/webhook$/i.test(cleanPath) ? cleanPath : `${cleanPath}/webhook`;
    return url.toString();
  } catch {
    const noSlash = trimmed.replace(/\/$/, "");
    return /\/webhook$/i.test(noSlash) ? noSlash : `${noSlash}/webhook`;
  }
}

function hasAuthQuery(url: string): boolean {
  try {
    return new URL(url).searchParams.has("auth");
  } catch {
    return /[?&]auth=/.test(url);
  }
}

function withAuthQuery(url: string, authKey: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("auth", authKey);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}auth=${encodeURIComponent(authKey)}`;
  }
}

const resolvedWebhookEnv =
  process.env.ROCKETRIDE_WEBHOOK_URL
  || process.env.WEBHOOK_URL
  || process.env.ROCKETRIDE_WEBHOOK
  || "";
const webhookSource = process.env.ROCKETRIDE_WEBHOOK_URL
  ? "ROCKETRIDE_WEBHOOK_URL"
  : process.env.WEBHOOK_URL
    ? "WEBHOOK_URL"
    : process.env.ROCKETRIDE_WEBHOOK
      ? "ROCKETRIDE_WEBHOOK"
      : "DEFAULT_WEBHOOK_URL";
const WEBHOOK_URL = normalizeWebhookUrl(resolvedWebhookEnv || DEFAULT_WEBHOOK_URL);
const PUBLIC_KEY = process.env.ROCKETRIDE_WEBHOOK_PUBLIC_KEY ?? "";
const PRIVATE_TOKEN = process.env.ROCKETRIDE_APIKEY ?? "";

function formatFetchError(error: unknown): string {
  const e = error as { message?: string; code?: string; cause?: { message?: string; code?: string } | string };
  const parts: string[] = [];

  if (e?.message) {
    parts.push(e.message);
  }
  if (e?.code) {
    parts.push(`code=${e.code}`);
  }
  if (typeof e?.cause === "string") {
    parts.push(`cause=${e.cause}`);
  } else if (e?.cause) {
    const causeObj = e.cause as { message?: string; code?: string };
    if (causeObj.message) {
      parts.push(`cause=${causeObj.message}`);
    } else {
      parts.push(`cause=${String(e.cause)}`);
    }
    if (causeObj.code) {
      parts.push(`causeCode=${causeObj.code}`);
    }
  }

  return parts.join("; ") || "unknown fetch error";
}

function maskWebhookAuth(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("auth")) {
      parsed.searchParams.set("auth", "***");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]auth=)[^&]+/i, "$1***");
  }
}

const payload = JSON.stringify({
  interests: ["fitness"],
  creators: [
    {
      channelId: "UCtest123",
      name: "Test Creator",
      subscribers: 100000,
      avgViews: 5000,
      engagementRate: 0.05,
      topics: ["fitness"],
      comments: ["Great workout routine!", "This helped me so much"],
    },
  ],
});

async function tryPost(label: string, headers: Record<string, string>, url = WEBHOOK_URL) {
  console.log(`--- ${label} ---`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.slice(0, 1000)}\n`);
    return res.ok;
  } catch (err: any) {
    console.log(`Error: ${formatFetchError(err)}\n`);
    return false;
  }
}

async function main() {
  console.log(`Webhook source: ${webhookSource}`);
  console.log(`Posting to ${maskWebhookAuth(WEBHOOK_URL)}\n`);

  const attempts: Array<{ label: string; headers: Record<string, string>; url?: string }> = [];

  if (hasAuthQuery(WEBHOOK_URL)) {
    attempts.push({
      label: "Configured URL auth (text/plain)",
      headers: { "Content-Type": "text/plain" },
    });
  } else if (PUBLIC_KEY) {
    attempts.push({
      label: "Auth as ?auth= query param (text/plain)",
      url: withAuthQuery(WEBHOOK_URL, PUBLIC_KEY),
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (PRIVATE_TOKEN) {
    attempts.push({
      label: "Private token as Bearer (text/plain)",
      headers: { "Content-Type": "text/plain", "Authorization": `Bearer ${PRIVATE_TOKEN}` },
    });
  }

  attempts.push({
    label: "No auth (text/plain)",
    headers: { "Content-Type": "text/plain" },
  });

  for (const { label, headers, url } of attempts) {
    const ok = await tryPost(label, headers, url);
    if (ok) {
      console.log("✅ SUCCESS!");
      return;
    }
  }

  console.log("❌ None of the attempts succeeded.");
}

main();
