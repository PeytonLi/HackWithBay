/**
 * Test RocketRide SDK connection and webhook send.
 * Usage: npx tsx scripts/test-rocketride-sdk.mts
 */
import "dotenv/config";
import { RocketRideClient } from "rocketride";
import path from "path";

const uri = process.env.ROCKETRIDE_URI || "http://localhost:60627";
const auth = process.env.ROCKETRIDE_APIKEY || undefined;

async function main() {
  console.log(`Connecting to RocketRide at ${uri}...`);

  const client = new RocketRideClient({ uri, auth });

  try {
    await client.connect();
    console.log("✅ Connected to RocketRide engine");

    const pipelinePath = path.resolve(process.cwd(), "creator-discovery.pipe");
    console.log(`Loading pipeline: ${pipelinePath}`);
    const { token } = await client.use({ filepath: pipelinePath, useExisting: true });
    console.log(`✅ Pipeline loaded, token: ${token}`);

    // Send a small test payload
    const testPayload = JSON.stringify({
      interests: ["fitness"],
      creators: [
        {
          channelId: "UCtest123",
          name: "Test Creator",
          subscribers: 100000,
          avgViews: 5000,
          engagementRate: 0.05,
          thumbnailUrl: "",
          topics: ["fitness"],
          similarCreators: [],
          comments: [
            "Great workout routine!",
            "This helped me so much",
            "Love the detailed explanations",
          ],
        },
      ],
    });

    console.log("Sending test payload to webhook...");
    const uploadResult = await client.send(
      token,
      testPayload,
      { filename: "creators.json" },
      "application/json",
    );
    console.log("Upload result:", JSON.stringify(uploadResult));

    // Poll for pipeline completion
    console.log("Waiting for pipeline to finish...");
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await client.getTaskStatus(token);
      console.log(`  [${i + 1}] Status:`, JSON.stringify(status).slice(0, 500));
      if (status.state === "completed" || status.state === "done" || status.state === "error") {
        break;
      }
    }
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.disconnect();
    console.log("Disconnected");
  }
}

main();
