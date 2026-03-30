import { NextRequest, NextResponse } from "next/server";
import type { SearchInput } from "@/types/creator";
import { runCreatorPipeline } from "@/lib/pipelineRunner";

/**
 * POST /api/find-creators
 * Main endpoint — runs the full agent pipeline and returns ranked creators.
 * For real-time step tracking, use POST /api/find-creators/stream instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body: SearchInput = await req.json();

    if (!body.interests || body.interests.length === 0) {
      return NextResponse.json(
        { error: "At least one interest is required" },
        { status: 400 },
      );
    }

    const result = await runCreatorPipeline(body);

    return NextResponse.json({
      creators: result.creators,
      steps: result.steps,
      totalTime: result.totalTime,
    });
  } catch (error) {
    console.error("find-creators error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
