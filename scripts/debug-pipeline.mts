/**
 * TDD diagnostic script — runs 4 layered tests to pinpoint the connection error.
 *
 *  Layer 1 – Env vars:     Are OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL set?
 *  Layer 2 – GMI Cloud:    Can we reach the GMI API directly from Node.js?
 *  Layer 3 – Webhook:      Does the RocketRide webhook accept our POST?
 *  Layer 4 – Full pipe:    Does the RocketRide Python engine call GMI successfully?
 *
 * Usage: npx tsx scripts/debug-pipeline.mts
 */
import { RocketRideClient } from "rocketride";
import path from "path";

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
const WEBHOOK = normalizeWebhookUrl(resolvedWebhookEnv || DEFAULT_WEBHOOK_URL);
const WEBHOOK_PUBLIC_KEY = process.env.ROCKETRIDE_WEBHOOK_PUBLIC_KEY ?? "";
const WEBHOOK_BEARER_KEY = process.env.ROCKETRIDE_APIKEY ?? "";

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

function isLikelyTlsIssue(detail: string): boolean {
  return /(tls|ssl|certificate|packet length too long|SEC_E_INVALID_TOKEN)/i.test(detail);
}

async function probeNetworkInterception(baseUrl: string): Promise<void> {
  try {
    const parsed = new URL(baseUrl);
    const basePath = parsed.pathname.replace(/\/$/, "");
    const probeUrl = `http://${parsed.host}${basePath}/models`;

    const r = await fetch(probeUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });

    const location = r.headers.get("location") ?? "";
    if (/t-mobile\.com/i.test(location)) {
      fail("Layer 2 network interception detected", location.slice(0, 220));
    }
  } catch {
    // Best-effort probe only.
  }
}

type WebhookState = "not-run" | "ok" | "unreachable" | "unauthorized" | "pipeline-not-running" | "runtime-error";

interface WebhookAttempt {
  label: string;
  url: string;
  headers: Record<string, string>;
}

let webhookState: WebhookState = "not-run";
let successfulAttempt: WebhookAttempt | null = null;

function hasAuthQuery(url: string): boolean {
  try {
    return new URL(url).searchParams.has("auth");
  } catch {
    return /[?&]auth=/.test(url);
  }
}

function authFromQuery(url: string): string {
  try {
    return new URL(url).searchParams.get("auth") ?? "";
  } catch {
    const match = url.match(/[?&]auth=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
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

function buildWebhookAttempts(baseUrl: string): WebhookAttempt[] {
  const attempts: WebhookAttempt[] = [];

  if (hasAuthQuery(baseUrl)) {
    const embeddedAuth = authFromQuery(baseUrl);
    attempts.push({
      label: "configured-url-auth",
      url: baseUrl,
      headers: embeddedAuth
        ? {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${embeddedAuth}`,
        }
        : { "Content-Type": "text/plain" },
    });
    return attempts;
  }

  if (WEBHOOK_PUBLIC_KEY) {
    attempts.push({
      label: "query-auth",
      url: withAuthQuery(baseUrl, WEBHOOK_PUBLIC_KEY),
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (WEBHOOK_BEARER_KEY) {
    attempts.push({
      label: "bearer-auth",
      url: baseUrl,
      headers: {
        "Content-Type": "text/plain",
        Authorization: `Bearer ${WEBHOOK_BEARER_KEY}`,
      },
    });
  }

  if (!hasAuthQuery(baseUrl)) {
    attempts.push({
      label: "no-auth",
      url: baseUrl,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return attempts;
}

const MINI_PAYLOAD = JSON.stringify({
  interests: ["fitness"],
  creators: [
    {
      channelId: "UCtest123",
      name: "Test Creator",
      subscribers: 100_000,
      avgViews: 5_000,
      engagementRate: 0.05,
      topics: ["fitness"],
      comments: ["Great content!", "Really helpful, thanks!"],
    },
  ],
});

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  console.log(`  ✅ PASS  ${label}${detail ? `  →  ${detail}` : ""}`);
  passed++;
}
function fail(label: string, detail?: string) {
  console.log(`  ❌ FAIL  ${label}${detail ? `  →  ${detail}` : ""}`);
  failed++;
}

// ─── Layer 1: Env vars ────────────────────────────────────────────────────────
async function testEnvVars() {
  console.log("\n[Layer 1] Environment variables");

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "";
  const model = process.env.OPENAI_MODEL ?? "";

  apiKey ? ok("OPENAI_API_KEY is set", apiKey.slice(0, 10) + "…")
    : fail("OPENAI_API_KEY is missing");

  baseUrl ? ok("OPENAI_BASE_URL is set", baseUrl)
    : fail("OPENAI_BASE_URL is missing");

  model ? ok("OPENAI_MODEL is set", model)
    : fail("OPENAI_MODEL is missing");

  if (baseUrl && !baseUrl.startsWith("http")) {
    fail("OPENAI_BASE_URL does not look like a URL", baseUrl);
  }
}

// ─── Layer 2: GMI Cloud reachability ─────────────────────────────────────────
async function testGMICloud() {
  console.log("\n[Layer 2] GMI Cloud API reachability");

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "";

  if (!apiKey || !baseUrl || !model) {
    fail("Skipped — env vars missing"); return;
  }

  let modelsIssue: string | null = null;

  // 2a: GET /models — should list available models
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) {
      ok(`GET ${baseUrl}/models → ${r.status}`);
    } else {
      modelsIssue = `${r.status} ${await r.text().then(t => t.slice(0, 180))}`;
    }
  } catch (e: any) {
    modelsIssue = formatFetchError(e);
  }

  // 2b: POST /chat/completions with a trivial message
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say: OK" }], max_completion_tokens: 5 }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await r.text();
    if (r.ok) {
      ok(`POST /chat/completions → ${r.status}`, body.slice(0, 120));
      if (modelsIssue) {
        ok(`GET ${baseUrl}/models non-blocking issue`, modelsIssue.slice(0, 180));
      }
    } else {
      if (modelsIssue) {
        fail(`GET ${baseUrl}/models issue`, modelsIssue.slice(0, 180));
      }
      fail(`POST /chat/completions → ${r.status}`, body.slice(0, 300));
    }
  } catch (e: any) {
    if (modelsIssue) {
      fail(`GET ${baseUrl}/models issue`, modelsIssue.slice(0, 180));
    }
    const detail = formatFetchError(e);
    fail(`POST /chat/completions threw`, detail.slice(0, 300));
    if (isLikelyTlsIssue(detail)) {
      fail("Layer 2 likely TLS/edge-network issue", "Verify OPENAI_BASE_URL protocol/port and local TLS interception settings");
      await probeNetworkInterception(baseUrl);
    }
  }
}

// ─── Layer 3: Webhook reachability ───────────────────────────────────────────
async function testWebhook() {
  console.log("\n[Layer 3] RocketRide webhook");
  console.log(`  INFO  Webhook source: ${webhookSource} -> ${maskWebhookAuth(WEBHOOK)}`);

  const attempts = buildWebhookAttempts(WEBHOOK);
  let sawResponse = false;
  const unauthorized: string[] = [];
  const runtimeErrors: string[] = [];

  for (const attempt of attempts) {
    try {
      const r = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: MINI_PAYLOAD,
        signal: AbortSignal.timeout(8_000),
      });

      const body = await r.text();
      sawResponse = true;

      if (r.ok) {
        webhookState = "ok";
        successfulAttempt = attempt;
        ok(`Webhook accepted POST → ${r.status}`, `${attempt.label}; ${body.slice(0, 180)}`);
        return;
      }

      if (r.status === 400 && /not running/i.test(body)) {
        webhookState = "pipeline-not-running";
        successfulAttempt = attempt;
        ok("Webhook reachable (pipeline is not running yet)", `${attempt.label}; ${body.slice(0, 200)}`);
        return;
      }

      if (r.status === 401 || r.status === 403) {
        unauthorized.push(`${attempt.label}:${r.status}`);
      } else if (r.status === 422 && /authorization/i.test(body)) {
        unauthorized.push(`${attempt.label}:422`);
      } else {
        runtimeErrors.push(`${attempt.label}:${r.status} ${body.slice(0, 120)}`);
      }
    } catch (e: any) {
      // Keep trying remaining auth strategies before classifying as unreachable.
      runtimeErrors.push(`${attempt.label}:network ${formatFetchError(e)}`);
    }
  }

  successfulAttempt = attempts[0] ?? null;

  if (!sawResponse) {
    webhookState = "unreachable";
    fail("Webhook unreachable", `target ${WEBHOOK}; ${runtimeErrors.join(" | ").slice(0, 240)}`);
    return;
  }

  if (unauthorized.length > 0) {
    webhookState = "unauthorized";
    ok("Webhook reachable but unauthorized", unauthorized.join(", "));
    return;
  }

  webhookState = "runtime-error";
  ok("Webhook reachable (downstream pipeline returned non-2xx)", runtimeErrors.join(" | ").slice(0, 260));
}

// ─── Layer 4: Full pipeline response ─────────────────────────────────────────
async function testFullPipeline() {
  console.log("\n[Layer 4] Full pipeline (waits up to 60 s for LLM response)");

  if (webhookState === "unreachable") {
    fail("Skipped full pipeline — webhook is unreachable", WEBHOOK);
    return;
  }
  if (webhookState === "unauthorized") {
    fail("Skipped full pipeline — webhook auth failed", "Set ROCKETRIDE_WEBHOOK_PUBLIC_KEY or valid ROCKETRIDE_APIKEY");
    return;
  }
  if (webhookState === "pipeline-not-running") {
    fail("Skipped full pipeline — pipeline is not running in RocketRide", "Start pipeline in RocketRide and rerun diagnostics");
    return;
  }

  const payload = MINI_PAYLOAD;
  const uri = process.env.ROCKETRIDE_URI || "http://localhost:5565";
  const auth = process.env.ROCKETRIDE_APIKEY || undefined;
  const pipelinePath = path.resolve(process.cwd(), "creator-discovery.pipe");

  let client: RocketRideClient | null = null;
  try {
    client = new RocketRideClient({ uri, auth });
    await client.connect();

    let token: string;
    try {
      ({ token } = await client.use({ filepath: pipelinePath, useExisting: false }));
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("already running")) {
        throw err;
      }

      // Refresh a stale running token so Layer 4 evaluates current .pipe config.
      const existing = await client.use({ filepath: pipelinePath, useExisting: true });
      await client.terminate(existing.token);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ({ token } = await client.use({ filepath: pipelinePath, useExisting: false }));
    }

    const response = await client.send(token, payload, {}, "text/plain");
    const body = JSON.stringify(response);

    if (body.includes("ranked_creators") || body.includes("creators") || body.includes("answers")) {
      ok("Pipeline returned creator payload", body.slice(0, 300));
    } else if (body.trim().length > 2) {
      ok("Pipeline returned a response (inspect for content)", body.slice(0, 300));
    } else {
      fail("Pipeline returned an empty response");
    }
  } catch (e: any) {
    fail("Full pipeline threw", String(e?.message ?? e));
  } finally {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors in diagnostics script.
      }
    }
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Pipeline diagnostic tests ===");
  await testEnvVars();
  await testGMICloud();
  await testWebhook();
  await testFullPipeline();

  console.log(`\n${"─".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n💡 Fix the first failing layer before moving to the next.");
    process.exit(1);
  } else {
    console.log("\n🎉 All layers healthy!");
  }
}

main().catch(e => { console.error(e); process.exit(1); });

