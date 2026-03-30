import { NextRequest, NextResponse } from "next/server";
import { getSimilarCreatorIds } from "@/lib/neo4j";

/**
 * GET /api/creators/[channelId]/similar
 * Returns similar creator IDs from the Neo4j graph
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const similarIds = await getSimilarCreatorIds(channelId, 5);
    return NextResponse.json({ channelId, similarCreatorIds: similarIds });
  } catch (error) {
    console.error("similar creators error:", error);
    return NextResponse.json(
      { error: "Failed to fetch similar creators" },
      { status: 500 },
    );
  }
}
