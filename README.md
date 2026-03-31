# CreatorScope

Discover authentic YouTube creators based on your interests. Powered by **RocketRide AI**, **Neo4j** graph database, and the **YouTube Data API**.

## Architecture

```
User → Next.js Frontend → API Route → RocketRide Pipeline
                                            │
                                    ┌───────┴───────┐
                                    │  AI Agent      │
                                    │  (GMI Cloud)   │
                                    └───────┬───────┘
                                            │
                                      Neo4j Graph DB
                                   (601 seeded creators)
```

- **Frontend**: Next.js 16 with Tailwind CSS
- **Pipeline Engine**: [RocketRide](https://rocketride.io) `.pipe` declarative pipelines
- **Graph Database**: Neo4j Aura — stores creators, topics, and `SIMILAR_TO` relationships
- **LLM**: GMI Cloud (OpenAI-compatible) for query understanding and ranking
- **Data Seeding**: Apify YouTube Scraper → Neo4j (12 categories, 600+ creators)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/PeytonLi/HackWithBay.git
cd HackWithBay
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | GMI Cloud API key (or any OpenAI-compatible provider) |
| `OPENAI_BASE_URL` | LLM endpoint (default: `https://api.gmi-serving.com/v1`) |
| `OPENAI_MODEL` | Model name (default: `openai/gpt-5.4`) |
| `NEO4J_URI` | Neo4j connection URI |
| `NEO4J_USERNAME` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `APIFY_API_TOKEN` | Apify token (only needed for seeding) |
| `ROCKETRIDE_URI` | RocketRide engine URL (default: `http://localhost:5565`) |

Also set the `ROCKETRIDE_*` prefixed versions for pipeline substitution:

```
ROCKETRIDE_OPENAI_KEY=<same as OPENAI_API_KEY>
ROCKETRIDE_OPENAI_BASE_URL=<same as OPENAI_BASE_URL>
ROCKETRIDE_NEO4J_URI=<same as NEO4J_URI>
ROCKETRIDE_NEO4J_USER=<same as NEO4J_USERNAME>
ROCKETRIDE_NEO4J_PASSWORD=<same as NEO4J_PASSWORD>
```

### 3. Seed the Database (first time only)

Populate Neo4j with YouTube creators across 12 categories using Apify:

```bash
node scripts/seed-creators.mjs
```

This scrapes ~600 creators and stores them as `Creator` and `Topic` nodes with `CREATES` and `SIMILAR_TO` relationships.

### 4. Start the RocketRide Engine (optional)

If you have RocketRide installed:

```bash
rocketride
```

The pipeline will fall back to direct Neo4j queries if RocketRide is not running.

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your interests (e.g. "fitness", "cooking"), and click **Find Creators**.

## Project Structure

```
├── creator-discovery.pipe     # RocketRide pipeline definition
├── scripts/
│   └── seed-creators.mjs      # Apify → Neo4j seeding script
├── src/
│   ├── app/                   # Next.js pages & API routes
│   │   ├── page.tsx           # Home page (interest input)
│   │   ├── search/page.tsx    # Search progress (SSE steps)
│   │   ├── results/page.tsx   # Results display
│   │   └── api/find-creators/ # API endpoints
│   ├── agents/                # Individual agent implementations
│   ├── components/            # React components (CreatorCard, etc.)
│   ├── data/creators.ts       # Static fallback creator dataset
│   ├── lib/
│   │   ├── pipelineRunner.ts  # Orchestrates RocketRide or fallback
│   │   ├── rocketride.ts      # RocketRide SDK client
│   │   ├── neo4j.ts           # Neo4j driver & graph queries
│   │   ├── youtube.ts         # YouTube API (cached, batched)
│   │   ├── cache.ts           # In-memory cache (24h TTL)
│   │   └── openai.ts          # GMI Cloud LLM client
│   └── types/creator.ts       # TypeScript interfaces
```

## How It Works

1. **User enters interests** → sent to `/api/find-creators/stream`
2. **Pipeline connects** to RocketRide and loads `creator-discovery.pipe`
3. **AI Agent** receives interests and writes Cypher queries to search Neo4j
4. **Neo4j** returns matching creators by topic and description keywords
5. **Agent ranks** creators by subscribers and relevance
6. **Frontend displays** results with thumbnails, subscriber counts, and YouTube links

If RocketRide is unavailable, the pipeline falls back to a direct Neo4j Cypher query.

## Categories Seeded

fitness · mental health · technology · cooking · finance · science · self improvement · yoga · nutrition · gaming · education · entrepreneurship

## License

MIT
