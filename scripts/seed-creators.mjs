/**
 * Seed Script — Scrape YouTube creators via Apify and store in Neo4j
 *
 * Usage: node scripts/seed-creators.mjs
 *
 * Searches for creators across categories, extracts channel data,
 * and stores everything in Neo4j with topic relationships.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { ApifyClient } from "apify-client";
import neo4j from "neo4j-driver";

// ── Config ──────────────────────────────────────────────────

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error("❌ Set APIFY_API_TOKEN in .env"); process.exit(1); }

const apify = new ApifyClient({ token: APIFY_TOKEN });

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD,
  ),
);

// ── Search queries by category ──────────────────────────────

const CATEGORIES = {
  "fitness":        ["fitness coach tips", "home workout routine", "strength training guide", "gym workout motivation"],
  "mental health":  ["mental health therapist advice", "anxiety coping strategies", "psychology tips", "therapy session insights"],
  "technology":     ["tech review 2025", "best gadgets review", "software engineering tutorial", "AI technology explained"],
  "cooking":        ["cooking tutorial easy recipes", "budget meal prep", "food science explained", "chef home cooking"],
  "finance":        ["personal finance tips", "investing for beginners", "stock market explained", "passive income ideas"],
  "science":        ["science explained", "physics documentary", "biology education", "space exploration facts"],
  "self improvement": ["productivity habits", "self improvement motivation", "minimalism lifestyle", "morning routine tips"],
  "yoga":           ["yoga for beginners", "meditation guided session", "yoga flexibility routine", "mindfulness practice"],
  "nutrition":      ["nutrition science diet", "healthy eating tips", "meal planning guide", "vegan nutrition facts"],
  "gaming":         ["game design analysis", "indie game review", "gaming tips strategy", "retro gaming nostalgia"],
  "education":      ["online learning tips", "study techniques", "math explained visually", "history documentary"],
  "entrepreneurship": ["startup founder advice", "small business tips", "entrepreneurship journey", "side hustle ideas"],
};

const MAX_VIDEOS_PER_QUERY = 15; // ~15 videos × 4 queries × 12 categories = ~720 videos

// ── Neo4j helpers ───────────────────────────────────────────

async function ensureIndexes() {
  const s = driver.session();
  try {
    await s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Creator) REQUIRE c.channelId IS UNIQUE");
    await s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE");
    await s.run("CREATE INDEX IF NOT EXISTS FOR (c:Creator) ON (c.name)");
  } finally { await s.close(); }
}

async function upsertCreator(creator, topics) {
  const s = driver.session();
  try {
    // Upsert creator node
    await s.run(
      `MERGE (c:Creator {channelId: $channelId})
       SET c.name = $name,
           c.subscribers = $subs,
           c.channelUrl = $channelUrl,
           c.thumbnailUrl = $thumb,
           c.description = $desc,
           c.country = $country,
           c.scrapedAt = datetime()`,
      {
        channelId: creator.channelId,
        name: creator.name,
        subs: neo4j.int(creator.subscribers || 0),
        channelUrl: creator.channelUrl || "",
        thumb: creator.thumbnailUrl || "",
        desc: (creator.description || "").substring(0, 500),
        country: creator.country || "",
      },
    );

    // Link to topics
    for (const topic of topics) {
      await s.run(
        `MERGE (c:Creator {channelId: $channelId})
         MERGE (t:Topic {name: $topic})
         MERGE (c)-[:CREATES]->(t)`,
        { channelId: creator.channelId, topic: topic.toLowerCase() },
      );
    }
  } finally { await s.close(); }
}

// ── Apify scraping ──────────────────────────────────────────

async function scrapeCategory(category, queries) {
  console.log(`\n🔍 Scraping category: ${category} (${queries.length} queries)`);

  const run = await apify.actor("streamers/youtube-scraper").call({
    searchQueries: queries,
    maxResults: MAX_VIDEOS_PER_QUERY,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });

  console.log(`   ⏳ Apify run ${run.id} finished (status: ${run.status})`);

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  console.log(`   📦 Got ${items.length} videos`);

  // Deduplicate by channel
  const channelMap = new Map();
  for (const item of items) {
    const chId = item.channelId || item.channelUrl?.split("/").pop();
    if (!chId || channelMap.has(chId)) continue;

    channelMap.set(chId, {
      channelId: chId,
      name: item.channelName || item.channelTitle || "Unknown",
      subscribers: item.numberOfSubscribers || 0,
      channelUrl: item.channelUrl || "",
      thumbnailUrl: item.channelThumbnail || "",
      description: item.channelDescription || item.description || "",
      country: item.channelCountry || "",
    });
  }

  console.log(`   👤 Found ${channelMap.size} unique channels`);

  // Store in Neo4j
  let stored = 0;
  for (const [, creator] of channelMap) {
    await upsertCreator(creator, [category]);
    stored++;
  }
  console.log(`   ✅ Stored ${stored} creators under "${category}"`);
  return stored;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("🌱 CreatorScope — Seeding Neo4j with Apify\n" + "=".repeat(50));

  await ensureIndexes();
  console.log("✅ Neo4j indexes created");

  let totalCreators = 0;
  const categories = Object.entries(CATEGORIES);

  for (const [category, queries] of categories) {
    try {
      const count = await scrapeCategory(category, queries);
      totalCreators += count;
    } catch (err) {
      console.error(`   ❌ Failed to scrape "${category}":`, err.message);
    }
  }

  // Compute similarity edges between creators who share topics
  console.log("\n🧩 Computing SIMILAR_TO edges...");
  const s = driver.session();
  try {
    const result = await s.run(
      `MATCH (a:Creator)-[:CREATES]->(t:Topic)<-[:CREATES]-(b:Creator)
       WHERE a.channelId < b.channelId
       WITH a, b, COUNT(t) AS shared
       WHERE shared >= 1
       MERGE (a)-[r:SIMILAR_TO]-(b)
       SET r.sharedTopics = shared
       RETURN COUNT(r) AS edges`,
    );
    console.log(`   ✅ Created ${result.records[0].get("edges")} similarity edges`);
  } finally { await s.close(); }

  // Final stats
  const statsSession = driver.session();
  try {
    const cr = await statsSession.run("MATCH (c:Creator) RETURN COUNT(c) AS count");
    const tp = await statsSession.run("MATCH (t:Topic) RETURN COUNT(t) AS count");
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🎉 Seeding complete!`);
    console.log(`   Creators: ${cr.records[0].get("count")}`);
    console.log(`   Topics:   ${tp.records[0].get("count")}`);
    console.log(`   New this run: ${totalCreators}`);
  } finally { await statsSession.close(); }

  await driver.close();
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
