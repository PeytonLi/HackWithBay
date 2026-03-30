import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const results = {};

// 1. YouTube Data API
async function testYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { status: "❌ SKIP", detail: "YOUTUBE_API_KEY not set" };
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&type=video&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { status: "❌ FAIL", detail: data.error.message };
    return { status: "✅ OK", detail: `Found ${data.pageInfo.totalResults} results` };
  } catch (e) {
    return { status: "❌ FAIL", detail: e.message };
  }
}

// 2. Neo4j
async function testNeo4j() {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !password) return { status: "❌ SKIP", detail: "NEO4J credentials not set" };
  try {
    const neo4j = (await import("neo4j-driver")).default;
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const serverInfo = await driver.getServerInfo();
    await driver.close();
    return { status: "✅ OK", detail: `Connected to ${serverInfo.address} (v${serverInfo.protocolVersion})` };
  } catch (e) {
    return { status: "❌ FAIL", detail: e.message };
  }
}

// 3. RocketRide
async function testRocketRide() {
  const uri = process.env.ROCKETRIDE_URI || "http://localhost:5565";
  const apiKey = process.env.ROCKETRIDE_APIKEY;
  try {
    // Try a simple health/version check — RocketRide engine exposes this
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(uri, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok || res.status === 401 || res.status === 403) {
      return {
        status: apiKey ? "✅ OK" : "⚠️ PARTIAL",
        detail: apiKey
          ? `Server reachable at ${uri} (status ${res.status})`
          : `Server reachable at ${uri} but ROCKETRIDE_APIKEY is empty`
      };
    }
    return { status: "⚠️ PARTIAL", detail: `Server responded with status ${res.status}` };
  } catch (e) {
    if (e.name === "AbortError") {
      return { status: "❌ FAIL", detail: `Timeout connecting to ${uri} — is the RocketRide engine running?` };
    }
    return { status: "❌ FAIL", detail: `Cannot reach ${uri} — ${e.cause?.code || e.message}` };
  }
}

// 4. OpenAI-compatible LLM (GMI Cloud)
async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  if (!key) return { status: "❌ SKIP", detail: "OPENAI_API_KEY not set" };
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_completion_tokens: 5,
      }),
    });
    const data = await res.json();
    if (data.error) return { status: "❌ FAIL", detail: data.error.message || JSON.stringify(data.error) };
    const reply = data.choices?.[0]?.message?.content || "";
    return { status: "✅ OK", detail: `Model ${model} responded: "${reply.trim()}"` };
  } catch (e) {
    return { status: "❌ FAIL", detail: e.message };
  }
}

// Run all tests
console.log("\n🔌 Verifying service connectivity...\n");

const [yt, neo, rr, oai] = await Promise.all([
  testYouTube(),
  testNeo4j(),
  testRocketRide(),
  testOpenAI(),
]);

console.log(`📺 YouTube Data API:   ${yt.status}  — ${yt.detail}`);
console.log(`🧩 Neo4j:              ${neo.status}  — ${neo.detail}`);
console.log(`🚀 RocketRide:         ${rr.status}  — ${rr.detail}`);
console.log(`🤖 OpenAI:             ${oai.status}  — ${oai.detail}`);

const allOk = [yt, neo, rr, oai].every(r => r.status.includes("✅"));
const critical = [yt, oai].every(r => r.status.includes("✅"));
console.log("");
if (allOk) {
  console.log("🎉 All services connected successfully!");
} else if (critical) {
  console.log("⚠️  Core services (YouTube + OpenAI) are working. Some optional services need attention.");
} else {
  console.log("🚨 Some critical services failed. Check the details above.");
}
console.log("");
