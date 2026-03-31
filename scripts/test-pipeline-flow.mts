/**
 * Test script to verify the Neo4j → RocketRide webhook pipeline flow.
 *
 * Usage: npx tsx scripts/test-pipeline-flow.mts
 */

import "dotenv/config";
import neo4j from "neo4j-driver";

const NEO4J_URI = process.env.NEO4J_URI || "";
const NEO4J_USER = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "";
const NEO4J_PASS = process.env.NEO4J_PASSWORD || "";

async function testNeo4jQuery() {
  console.log("=== Step 1: Testing Neo4j query ===");
  console.log(`Connecting to Neo4j at ${NEO4J_URI}...`);

  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
  const session = driver.session();

  try {
    const interests = ["fitness", "yoga", "cooking", "tech", "gaming"];
    const lowerInterests = interests.map((i) => i.toLowerCase());

    console.log(`Querying for interests: ${interests.join(", ")}`);

    const res = await session.run(
      `MATCH (c:Creator)-[:CREATES]->(t:Topic)
       WHERE toLower(t.name) IN $interests
       WITH c, COLLECT(DISTINCT t.name) AS topics
       OPTIONAL MATCH (c)-[:SIMILAR_TO]-(similar:Creator)
       WITH c, topics, COLLECT(DISTINCT similar.channelId) AS similarCreators
       OPTIONAL MATCH (c)-[:HAS_COMMENT]->(comment:Comment)
       WITH c, topics, similarCreators, COLLECT(comment.text)[0..10] AS comments
       RETURN c.channelId AS channelId,
              c.name AS name,
              c.subscribers AS subscribers,
              c.avgViews AS avgViews,
              c.engagementRate AS engagementRate,
              c.thumbnailUrl AS thumbnailUrl,
              topics, similarCreators, comments
       ORDER BY c.subscribers DESC
       LIMIT 20`,
      { interests: lowerInterests },
    );

    const creators = res.records.map((r) => {
      const subs = r.get("subscribers");
      const views = r.get("avgViews");
      const er = r.get("engagementRate");
      return {
        channelId: r.get("channelId") ?? "",
        name: r.get("name") ?? "Unknown",
        subscribers: typeof subs?.toNumber === "function" ? subs.toNumber() : Number(subs ?? 0),
        avgViews: typeof views?.toNumber === "function" ? views.toNumber() : Number(views ?? 0),
        engagementRate: typeof er?.toNumber === "function" ? er.toNumber() : Number(er ?? 0),
        thumbnailUrl: r.get("thumbnailUrl") ?? "",
        topics: r.get("topics") ?? [],
        similarCreators: r.get("similarCreators") ?? [],
        comments: r.get("comments") ?? [],
      };
    });

    console.log(`\n✅ Found ${creators.length} creators\n`);

    if (creators.length === 0) {
      console.log("⚠️  No creators found. Checking what topics exist...");
      const topicRes = await session.run("MATCH (t:Topic) RETURN t.name AS name LIMIT 20");
      const topics = topicRes.records.map((r) => r.get("name"));
      console.log(`Available topics: ${topics.join(", ")}`);
      console.log("\nTry running with interests that match these topics.");
    } else {
      for (const c of creators.slice(0, 5)) {
        console.log(`  📺 ${c.name}`);
        console.log(`     Subscribers: ${c.subscribers.toLocaleString()}`);
        console.log(`     Topics: ${c.topics.join(", ")}`);
        console.log(`     Comments: ${c.comments.length}`);
        console.log(`     Similar creators: ${c.similarCreators.length}`);
        console.log();
      }

      if (creators.length > 5) {
        console.log(`  ... and ${creators.length - 5} more creators\n`);
      }

      // Build the payload that would be sent to the webhook
      const payload = JSON.stringify(
        { interests, creators },
        null,
        2,
      );

      console.log("=== Step 2: Payload for RocketRide webhook ===");
      console.log(`Payload size: ${(payload.length / 1024).toFixed(1)} KB`);
      console.log(`Payload preview (first 500 chars):\n${payload.slice(0, 500)}...\n`);

      console.log("=== Step 3: RocketRide webhook test ===");
      console.log("⚠️  Skipping RocketRide send — requires the RocketRide engine to be running.");
      console.log("    Start the engine with the RocketRide VSCode extension, then run:");
      console.log("    the full pipeline via the app's search endpoint.\n");
    }

    console.log("✅ Neo4j query flow verified successfully!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

testNeo4jQuery();
