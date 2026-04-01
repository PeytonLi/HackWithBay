/**
 * Test the RocketRide pipeline directly and log the raw response.
 * Usage: npx tsx scripts/test-pipeline-raw.mts
 */
import "dotenv/config";
import { RocketRideClient } from "rocketride";
import neo4j from "neo4j-driver";
import path from "path";

async function fetchCreatorsFromNeo4j() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI || "",
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "",
      process.env.NEO4J_PASSWORD || "",
    ),
  );
  const session = driver.session();
  try {
    const res = await session.run(
      `MATCH (c:Creator)-[:CREATES]->(t:Topic)
       WHERE toLower(t.name) IN $interests
       WITH c, COLLECT(DISTINCT t.name) AS topics
       OPTIONAL MATCH (c)-[:HAS_COMMENT]->(comment:Comment)
       WITH c, topics, COLLECT(comment.text)[0..10] AS comments
       RETURN c.channelId AS channelId, c.name AS name,
              c.subscribers AS subscribers, c.avgViews AS avgViews,
              c.engagementRate AS engagementRate, topics, comments
       ORDER BY c.subscribers DESC LIMIT 5`,
      { interests: ["fitness"] },
    );
    return res.records.map((r) => {
      const subs = r.get("subscribers");
      const views = r.get("avgViews");
      const er = r.get("engagementRate");
      return {
        channelId: r.get("channelId") ?? "",
        name: r.get("name") ?? "Unknown",
        subscribers: typeof subs?.toNumber === "function" ? subs.toNumber() : Number(subs ?? 0),
        avgViews: typeof views?.toNumber === "function" ? views.toNumber() : Number(views ?? 0),
        engagementRate: typeof er?.toNumber === "function" ? er.toNumber() : Number(er ?? 0),
        topics: r.get("topics") ?? [],
        comments: r.get("comments") ?? [],
      };
    });
  } finally {
    await session.close();
    await driver.close();
  }
}

async function main() {
  const client = new RocketRideClient({
    uri: process.env.ROCKETRIDE_URI || "http://localhost:55162",
    auth: process.env.ROCKETRIDE_APIKEY || undefined,
  });

  try {
    // Fetch real creators from Neo4j (limited to 5 for speed)
    console.log("Fetching creators from Neo4j (limit 5)...");
    const creators = await fetchCreatorsFromNeo4j();
    console.log(`Found ${creators.length} creators\n`);

    console.log("Connecting to RocketRide...");
    await client.connect();
    console.log("Connected!\n");

    const pipelinePath = path.resolve(process.cwd(), "creator-discovery.pipe");
    console.log("Loading pipeline:", pipelinePath);
    let token: string;
    try {
      ({ token } = await client.use({ filepath: pipelinePath, useExisting: false }));
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("already running")) {
        throw err;
      }

      // Restart stale running pipeline so diagnostics use latest .pipe configuration.
      const existing = await client.use({ filepath: pipelinePath, useExisting: true });
      await client.terminate(existing.token);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ({ token } = await client.use({ filepath: pipelinePath, useExisting: false }));
    }
    console.log("Pipeline loaded, token:", token, "\n");

    const payload = JSON.stringify({
      interests: ["fitness"],
      creators,
    });

    console.log("Sending payload (" + payload.length + " bytes)...\n");

    const response = await client.send(
      token,
      payload,
      {},
      "text/plain",
      async (type: string, data: Record<string, unknown>) => {
        console.log(`[SSE] type=${type} name=${data.name ?? "?"} status=${data.status ?? "?"}`);
      },
    );

    console.log("\n=== RAW RESPONSE ===");
    console.log("Type:", typeof response);
    console.log("Value:", JSON.stringify(response, null, 2));

    // Try to dig into the response
    if (response && typeof response === "object") {
      for (const [key, val] of Object.entries(response as Record<string, unknown>)) {
        console.log(`\nKey "${key}":`);
        console.log("  Type:", typeof val);
        console.log("  Value:", JSON.stringify(val)?.slice(0, 500));
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.disconnect();
    console.log("\nDisconnected.");
  }
}

main();
