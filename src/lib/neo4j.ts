/**
 * Neo4j graph database client
 * Manages creator-topic relationships and graph signals
 */
import neo4j, { Driver, Session } from "neo4j-driver";
import type { AnalyzedCreator, GraphSignals } from "@/types/creator";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (driver) return driver;
  const uri = process.env.NEO4J_URI || "neo4j://localhost:7687";
  const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD;
  if (!password) throw new Error("NEO4J_PASSWORD is not set");
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  return driver;
}

function session(): Session {
  return getNeo4jDriver().session();
}

export async function closeNeo4j() {
  if (driver) { await driver.close(); driver = null; }
}

// ── Schema setup ────────────────────────────────────────────

export async function ensureIndexes(): Promise<void> {
  const s = session();
  try {
    await s.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Creator) REQUIRE c.channelId IS UNIQUE"
    );
    await s.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE"
    );
  } finally {
    await s.close();
  }
}

// ── Upsert creators & topics ────────────────────────────────

export async function upsertCreator(c: AnalyzedCreator): Promise<void> {
  const s = session();
  try {
    await s.run(
      `MERGE (cr:Creator {channelId: $channelId})
       SET cr.name = $name,
           cr.subscribers = $subs,
           cr.avgViews = $avgViews,
           cr.engagementRate = $er,
           cr.thumbnailUrl = $thumb,
           cr.country = $country,
           cr.description = $description`,
      {
        channelId: c.channelId,
        name: c.name,
        subs: neo4j.int(c.subscriberCount),
        avgViews: c.engagement.avgViews,
        er: c.engagement.engagementRate,
        thumb: c.thumbnailUrl,
        country: c.country ?? "",
        description: c.description,
      },
    );
  } finally {
    await s.close();
  }
}

export async function linkCreatorToTopics(
  channelId: string,
  topics: string[],
): Promise<void> {
  const s = session();
  try {
    for (const topic of topics) {
      await s.run(
        `MERGE (cr:Creator {channelId: $channelId})
         MERGE (t:Topic {name: $topic})
         MERGE (cr)-[:CREATES]->(t)`,
        { channelId, topic: topic.toLowerCase() },
      );
    }
  } finally {
    await s.close();
  }
}

export async function linkUserInterests(
  userId: string,
  interests: string[],
): Promise<void> {
  const s = session();
  try {
    for (const interest of interests) {
      await s.run(
        `MERGE (u:User {id: $userId})
         MERGE (t:Topic {name: $interest})
         MERGE (u)-[:INTERESTED_IN]->(t)`,
        { userId, interest: interest.toLowerCase() },
      );
    }
  } finally {
    await s.close();
  }
}

// ── Comments ────────────────────────────────────────────────

/**
 * Store comments for a creator's most recent video.
 * Creates Comment nodes and links them to the Creator via HAS_COMMENT.
 */
export async function upsertComments(
  channelId: string,
  videoId: string,
  comments: string[],
): Promise<void> {
  const s = session();
  try {
    // Delete old comments for this creator before inserting fresh ones
    await s.run(
      `MATCH (cr:Creator {channelId: $channelId})-[r:HAS_COMMENT]->(c:Comment)
       DETACH DELETE c`,
      { channelId },
    );

    for (let i = 0; i < comments.length; i++) {
      const text = comments[i];
      if (!text.trim()) continue;
      await s.run(
        `MATCH (cr:Creator {channelId: $channelId})
         CREATE (c:Comment {
           videoId: $videoId,
           text: $text,
           index: $idx,
           createdAt: datetime()
         })
         CREATE (cr)-[:HAS_COMMENT]->(c)`,
        {
          channelId,
          videoId,
          text,
          idx: neo4j.int(i),
        },
      );
    }
  } finally {
    await s.close();
  }
}

// ── Similarity edges ────────────────────────────────────────

export async function computeSimilarCreators(
  channelIds: string[],
): Promise<void> {
  const s = session();
  try {
    // Two creators are similar if they share ≥1 topic
    await s.run(
      `MATCH (a:Creator)-[:CREATES]->(t:Topic)<-[:CREATES]-(b:Creator)
       WHERE a.channelId IN $ids AND b.channelId IN $ids
         AND a.channelId < b.channelId
       WITH a, b, COUNT(t) AS shared
       WHERE shared >= 1
       MERGE (a)-[r:SIMILAR_TO]-(b)
       SET r.sharedTopics = shared`,
      { ids: channelIds },
    );
  } finally {
    await s.close();
  }
}

// ── Graph signal queries ────────────────────────────────────

/** Cluster authenticity: ratio of similar creators who also have good engagement */
export async function getClusterAuthenticity(
  channelId: string,
): Promise<number> {
  const s = session();
  try {
    const res = await s.run(
      `MATCH (c:Creator {channelId: $channelId})-[:SIMILAR_TO]-(other:Creator)
       WITH COUNT(other) AS total,
            SUM(CASE WHEN other.engagementRate > 0.02 THEN 1 ELSE 0 END) AS quality
       RETURN CASE WHEN total = 0 THEN 0.5
              ELSE toFloat(quality) / total END AS score`,
      { channelId },
    );
    return res.records[0]?.get("score") ?? 0.5;
  } finally {
    await s.close();
  }
}

/** Influence depth: how many layers of connected creators exist */
export async function getInfluenceDepth(
  channelId: string,
): Promise<number> {
  const s = session();
  try {
    const res = await s.run(
      `MATCH path = (c:Creator {channelId: $channelId})-[:SIMILAR_TO*1..3]-(other:Creator)
       RETURN MAX(length(path)) AS depth`,
      { channelId },
    );
    const depth = res.records[0]?.get("depth")?.toNumber?.() ?? 0;
    return Math.min(depth / 3, 1); // normalise to 0–1
  } finally {
    await s.close();
  }
}

/** Echo chamber: penalise if connected creators all share the exact same topics */
export async function getEchoChamberPenalty(
  channelId: string,
): Promise<number> {
  const s = session();
  try {
    const res = await s.run(
      `MATCH (c:Creator {channelId: $channelId})-[:CREATES]->(t:Topic)
       WITH c, COLLECT(t.name) AS myTopics
       OPTIONAL MATCH (c)-[:SIMILAR_TO]-(other:Creator)-[:CREATES]->(ot:Topic)
       WITH myTopics, COLLECT(DISTINCT ot.name) AS otherTopics
       WITH myTopics,
            SIZE([x IN otherTopics WHERE x IN myTopics]) AS overlap,
            SIZE(otherTopics) AS total
       RETURN CASE WHEN total = 0 THEN 0.0
              ELSE toFloat(overlap) / total END AS penalty`,
      { channelId },
    );
    return res.records[0]?.get("penalty") ?? 0;
  } finally {
    await s.close();
  }
}

/** Get similar creator IDs for a given channel */
export async function getSimilarCreatorIds(
  channelId: string,
  limit = 5,
): Promise<string[]> {
  const s = session();
  try {
    const res = await s.run(
      `MATCH (c:Creator {channelId: $channelId})-[:SIMILAR_TO]-(other:Creator)
       RETURN other.channelId AS id
       LIMIT $limit`,
      { channelId, limit: neo4j.int(limit) },
    );
    return res.records.map((r) => r.get("id") as string);
  } finally {
    await s.close();
  }
}

// ── Query creators by interests (for pipeline) ─────────────

export interface Neo4jCreatorResult {
  channelId: string;
  name: string;
  subscribers: number;
  avgViews: number;
  engagementRate: number;
  thumbnailUrl: string;
  country: string;
  locationMatch: boolean;
  topics: string[];
  similarCreators: string[];
  comments: string[];
}

/**
 * Query Neo4j for creators matching the given interests.
 * Returns up to `limit` creators with their topics, similar creators, and comments.
 */
export async function queryCreatorsByInterests(
  interests: string[],
  limit = 20,
): Promise<Neo4jCreatorResult[]> {
  const s = session();
  try {
    const lowerInterests = interests.map((i) => i.toLowerCase());

    const query =
      `MATCH (c:Creator)-[:CREATES]->(t:Topic)
       WHERE toLower(t.name) IN $interests
       WITH c, COLLECT(DISTINCT t.name) AS topics
       OPTIONAL MATCH (c)-[:SIMILAR_TO]-(similar:Creator)
       WITH c, topics, COLLECT(DISTINCT similar.channelId) AS similarCreators
       OPTIONAL MATCH (c)-[:HAS_COMMENT]->(comment:Comment)
       WITH c, topics, similarCreators, COLLECT(comment.text)[0..20] AS comments
       RETURN c.channelId AS channelId,
              c.name AS name,
              c.subscribers AS subscribers,
              c.avgViews AS avgViews,
              c.engagementRate AS engagementRate,
              c.thumbnailUrl AS thumbnailUrl,
              coalesce(c.country, '') AS country,
              true AS locationMatch,
              topics,
              similarCreators,
              comments
       ORDER BY c.subscribers DESC
       LIMIT $limit`;

    const res = await s.run(query, {
      interests: lowerInterests,
      limit: neo4j.int(limit),
    });

    return res.records.map((r) => {
      const subs = r.get("subscribers");
      const views = r.get("avgViews");
      const er = r.get("engagementRate");
      const comments = (r.get("comments") ?? []) as unknown[];
      return {
        channelId: r.get("channelId") ?? "",
        name: r.get("name") ?? "Unknown",
        subscribers: typeof subs?.toNumber === "function" ? subs.toNumber() : Number(subs ?? 0),
        avgViews: typeof views?.toNumber === "function" ? views.toNumber() : Number(views ?? 0),
        engagementRate: typeof er?.toNumber === "function" ? er.toNumber() : Number(er ?? 0),
        thumbnailUrl: r.get("thumbnailUrl") ?? "",
        country: r.get("country") ?? "",
        locationMatch: Boolean(r.get("locationMatch")),
        topics: r.get("topics") ?? [],
        similarCreators: r.get("similarCreators") ?? [],
        comments: comments
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter((c) => c.length > 0),
      };
    });
  } finally {
    await s.close();
  }
}

/** Compute all graph signals for a single creator */
export async function computeGraphSignals(
  channelId: string,
): Promise<GraphSignals> {
  const [cluster, depth, echo, similar] = await Promise.all([
    getClusterAuthenticity(channelId),
    getInfluenceDepth(channelId),
    getEchoChamberPenalty(channelId),
    getSimilarCreatorIds(channelId),
  ]);
  return {
    clusterAuthenticity: cluster,
    influenceDepth: depth,
    echoChamberPenalty: echo,
    similarCreatorCount: similar.length,
  };
}
