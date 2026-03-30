import { NextRequest } from "next/server";
import type { SearchInput } from "@/types/creator";
import { runCreatorPipeline } from "@/lib/pipelineRunner";

/**
 * POST /api/find-creators/stream
 * Server-Sent Events endpoint — streams agent steps in real-time,
 * then sends the final creators array.
 */
export async function POST(req: NextRequest) {
  const body: SearchInput = await req.json();

  if (!body.interests || body.interests.length === 0) {
    return new Response(
      JSON.stringify({ error: "At least one interest is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await runCreatorPipeline(body, (step) => {
          send("step", step);
        });

        send("result", {
          creators: result.creators,
          totalTime: result.totalTime,
        });

        send("done", { ok: true });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Pipeline failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
