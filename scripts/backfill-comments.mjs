/**
 * Backfill script: fetch top 20 comments from most recent video
 * for all existing Creator nodes in Neo4j using Apify (no YouTube API quota).
 *
 * Strategy:
 *   1. Get all Creator channelIds from Neo4j
 *   2. Use Apify youtube-scraper to get the most recent video URL per channel
 *   3. Use Apify youtube-comments-scraper to get top 20 comments per video
 *   4. Store comments in Neo4j as Comment nodes
 *
 * Usage: node scripts/backfill-comments.mjs
 */
import "dotenv/config";
import { ApifyClient } from "apify-client";
import neo4j from "neo4j-driver";

// ── Config ──────────────────────────────────────────────────
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) { console.error("❌ Set APIFY_API_TOKEN in .env"); process.exit(1); }

const apify = new ApifyClient({ token: APIFY_TOKEN });
const BATCH_SIZE = 20; // channels per Apify run (keep costs down)

// ── Neo4j setup ─────────────────────────────────────────────
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
);

async function getAllCreators() {
  const s = driver.session();
  try {
    const res = await s.run(
      `MATCH (c:Creator)
       WHERE c.channelUrl IS NOT NULL AND c.channelUrl <> ''
       RETURN c.channelId AS id, c.name AS name, c.channelUrl AS url`,
    );
    return res.records.map((r) => ({
      id: r.get("id"),
      name: r.get("name"),
      url: r.get("url"),
    }));
  } finally {
    await s.close();
  }
}

async function upsertComments(channelId, videoId, comments) {
  const s = driver.session();
  try {
    await s.run(
      "MATCH (cr:Creator {channelId: $channelId})-[r:HAS_COMMENT]->(c:Comment) DETACH DELETE c",
      { channelId },
    );
    for (let i = 0; i < comments.length; i++) {
      const text = comments[i];
      if (!text.trim()) continue;
      await s.run(
        `MATCH (cr:Creator {channelId: $channelId})
         CREATE (c:Comment { videoId: $videoId, text: $text, idx: $idx, createdAt: datetime() })
         CREATE (cr)-[:HAS_COMMENT]->(c)`,
        { channelId, videoId, text, idx: neo4j.int(i) },
      );
    }
  } finally {
    await s.close();
  }
}

// ── Step 1: Get latest video URL per channel via Apify ──────
async function getLatestVideos(creators) {
  console.log(`\n🔍 Fetching latest video for ${creators.length} channels via Apify youtube-scraper...`);

  const channelUrls = creators.map((c) => {
    // Ensure we have a proper channel URL
    let url = c.url;
    if (!url.startsWith("http")) url = `https://www.youtube.com/channel/${c.id}`;
    return { url };
  });

  const run = await apify.actor("streamers/youtube-scraper").call({
    startUrls: channelUrls,
    maxResults: 1,           // 1 video per channel
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });

  console.log(`   ⏳ Apify run ${run.id} finished (status: ${run.status})`);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  console.log(`   📦 Got ${items.length} videos`);

  // Map channelId → { videoId, videoUrl }
  const videoMap = new Map();
  for (const item of items) {
    const chId = item.channelId || item.channelUrl?.split("/").pop();
    if (!chId || videoMap.has(chId)) continue;
    const videoId = item.id;
    const videoUrl = item.url || `https://www.youtube.com/watch?v=${videoId}`;
    if (videoId) videoMap.set(chId, { videoId, videoUrl });
  }

  return videoMap;
}

// ── Step 2: Get comments via Apify ──────────────────────────
async function getCommentsBatch(videoEntries) {
  // videoEntries = [{ channelId, videoId, videoUrl }, ...]
  const urls = videoEntries.map((e) => ({ url: e.videoUrl }));

  console.log(`\n💬 Scraping comments for ${urls.length} videos via Apify youtube-comments-scraper...`);

  const run = await apify.actor("streamers/youtube-comments-scraper").call({
    startUrls: urls,
    maxComments: 20,
    commentsSortBy: "0", // top comments
  });

  console.log(`   ⏳ Apify run ${run.id} finished (status: ${run.status})`);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  console.log(`   📦 Got ${items.length} comments`);

  // Group comments by videoId
  const commentsByVideo = new Map();
  for (const item of items) {
    const vid = item.videoID || item.videoId;
    if (!vid) continue;
    if (!commentsByVideo.has(vid)) commentsByVideo.set(vid, []);
    const text = item.comment || item.text || "";
    if (text.trim()) commentsByVideo.get(vid).push(text);
  }

  return commentsByVideo;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Comment Backfill — Apify + Neo4j\n" + "=".repeat(50));

  const creators = await getAllCreators();
  console.log(`Found ${creators.length} creators with channel URLs`);

  let totalStored = 0;
  let totalComments = 0;

  for (let i = 0; i < creators.length; i += BATCH_SIZE) {
    const batch = creators.slice(i, i + BATCH_SIZE);
    console.log(`\n${"─".repeat(50)}\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(creators.length / BATCH_SIZE)} (creators ${i + 1}–${Math.min(i + BATCH_SIZE, creators.length)})`);

    try {
      // Step 1: get latest video for each channel
      const videoMap = await getLatestVideos(batch);

      // Build entries for comment scraping
      const videoEntries = [];
      for (const creator of batch) {
        const video = videoMap.get(creator.id);
        if (video) {
          videoEntries.push({ channelId: creator.id, name: creator.name, ...video });
        } else {
          console.log(`   ⚠ ${creator.name} — no video found, skipping`);
        }
      }

      if (videoEntries.length === 0) continue;

      // Step 2: get comments for all videos in this batch
      const commentsByVideo = await getCommentsBatch(videoEntries);

      // Step 3: store in Neo4j
      for (const entry of videoEntries) {
        const comments = commentsByVideo.get(entry.videoId) || [];
        if (comments.length === 0) {
          console.log(`   ⚠ ${entry.name} — no comments found`);
          continue;
        }
        const toStore = comments.slice(0, 20);
        await upsertComments(entry.channelId, entry.videoId, toStore);
        console.log(`   ✅ ${entry.name} — ${toStore.length} comments stored`);
        totalStored++;
        totalComments += toStore.length;
      }
    } catch (err) {
      console.error(`   ❌ Batch failed:`, err.message);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Stored comments for ${totalStored}/${creators.length} creators (${totalComments} total comments).`);
  await driver.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
