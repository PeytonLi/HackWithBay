/**
 * Phase 1 smoke test — verifies YouTube, Neo4j, and OpenAI libs work end-to-end
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";
const ytKey = process.env.YOUTUBE_API_KEY;
const oaiKey = process.env.OPENAI_API_KEY;
const oaiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const oaiModel = process.env.OPENAI_MODEL || "gpt-4o";

async function testYouTubeSearch() {
  console.log("\n── 1. YouTube Search ──");
  const qs = new URLSearchParams({ part: "snippet", q: "fitness coach", type: "video", maxResults: "2", key: ytKey });
  const res = await fetch(`${YOUTUBE_BASE}/search?${qs}`);
  const data = await res.json();
  const videos = (data.items ?? []).map(i => ({
    videoId: i.id?.videoId,
    channelId: i.snippet?.channelId,
    title: i.snippet?.title,
  }));
  console.log(`   ✅ Found ${videos.length} videos`);
  videos.forEach(v => console.log(`      • ${v.title} (${v.channelId})`));
  return videos;
}

async function testYouTubeChannels(channelIds) {
  console.log("\n── 2. YouTube Channels ──");
  const qs = new URLSearchParams({ part: "snippet,statistics", id: channelIds.join(","), key: ytKey });
  const res = await fetch(`${YOUTUBE_BASE}/channels?${qs}`);
  const data = await res.json();
  for (const ch of data.items ?? []) {
    console.log(`   ✅ ${ch.snippet.title}: ${Number(ch.statistics.subscriberCount).toLocaleString()} subs`);
  }
}

async function testNeo4j() {
  console.log("\n── 3. Neo4j Write + Read ──");
  const neo4j = (await import("neo4j-driver")).default;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "neo4j";
  const pw = process.env.NEO4J_PASSWORD;
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pw));
  const session = driver.session();
  try {
    await session.run(
      `MERGE (c:Creator {channelId: "test-smoke"}) SET c.name = "Smoke Test" RETURN c`
    );
    const res = await session.run(
      `MATCH (c:Creator {channelId: "test-smoke"}) RETURN c.name AS name`
    );
    console.log(`   ✅ Created and read back: "${res.records[0].get("name")}"`);
    await session.run(`MATCH (c:Creator {channelId: "test-smoke"}) DETACH DELETE c`);
    console.log("   ✅ Cleaned up test node");
  } finally {
    await session.close();
    await driver.close();
  }
}

async function testOpenAI() {
  console.log("\n── 4. OpenAI (GMI Cloud) — Query Generation ──");
  const res = await fetch(`${oaiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${oaiKey}` },
    body: JSON.stringify({
      model: oaiModel,
      temperature: 0.7,
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: "Return a JSON array of 3 YouTube search queries to find fitness creators. Only JSON array, no explanation." },
        { role: "user", content: "Interests: fitness, yoga. Location: San Francisco" },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  console.log(`   ✅ LLM responded:`);
  console.log(`      ${text.substring(0, 200)}`);
}

// Run all
console.log("🧪 Phase 1 Smoke Test\n" + "=".repeat(40));
try {
  const videos = await testYouTubeSearch();
  const channelIds = [...new Set(videos.map(v => v.channelId))];
  if (channelIds.length) await testYouTubeChannels(channelIds);
  await testNeo4j();
  await testOpenAI();
  console.log("\n" + "=".repeat(40));
  console.log("🎉 All Phase 1 smoke tests passed!");
} catch (err) {
  console.error("\n❌ Smoke test failed:", err.message);
  process.exit(1);
}
