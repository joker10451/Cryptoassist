# Crypto Hunter OS — System Architecture v1.0

> Production-grade crypto intelligence platform design. Monolith-first, modular services, event-driven ingestion.

---

## 1. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SOURCES                             │
│  DeBank │ Galxe │ Layer3 │ Zealy │ X/Twitter │ Discord │ DefiLlama │
│  Airdrops.io │ CMC │ DappRadar │ Etherscan │ CryptoRank │ NFT APIs │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER (Python Workers)                │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ REST     │  │ GraphQL  │  │ Scrapers │  │ Webhooks │           │
│  │ Fetchers │  │ Clients  │  │ (Playwr.)│  │ Listeners│           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────────────┴─────────────┴─────────────┘                  │
│                            │                                        │
│                            ▼                                        │
│                    ┌──────────────┐                                 │
│                    │  Redis Queue  │  ← Job scheduling + dedup      │
│                    │  (BullMQ)     │                                 │
│                    └──────┬───────┘                                 │
│                           │                                         │
│                           ▼                                         │
│                    ┌──────────────┐                                 │
│                    │  Normalizer  │  ← Schema mapping, dedup,       │
│                    │  Service     │    freshness checks             │
│                    └──────┬───────┘                                 │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (Supabase/PostgreSQL)                │
│                                                                     │
│  projects │ opportunities │ tasks │ wallets │ transactions          │
│  signals  │ eligibility   │ alerts  │ scores  │ cache               │
│                                                                     │
│  + Redis Cache (hot data, rate limit counters)                      │
│  + pgvector (semantic search, similarity matching)                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AI ENGINE (NVIDIA NIM API)                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Opportunity  │  │ Eligibility  │  │ Wallet       │              │
│  │ Scorer       │  │ Predictor    │  │ Analyzer     │              │
│  │ (Llama 3.1)  │  │ (Llama 3.1)  │  │ (Llama 3.1)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  Cache: 5-10 min TTL per project to avoid API costs                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Next.js App  │  │ Telegram Bot │  │ REST API     │              │
│  │ (Dashboard)  │  │ (Alerts)     │  │ (External)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  Real-time: Supabase Realtime (WebSockets)                          │
│  Static: ISR/SSG for SEO pages                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Architecture Decision: Monolith-first with modular ingestion workers**

- **Why not microservices**: Team of 1-3 devs, early stage. Microservices add operational overhead without benefit.
- **Why not pure serverless**: Ingestion workers need persistent state, retry logic, and rate limit tracking.
- **Hybrid approach**: Next.js monolith for API + UI. Separate Python/Node workers for ingestion (deployed as cron jobs or long-running processes).

---

## 2. API INTEGRATION STRATEGY

### 2.1 Platform-by-Platform Breakdown

| Platform | API Type | Auth | Rate Limit | Strategy |
|----------|----------|------|------------|----------|
| **DeBank** | REST (unofficial) | API key (paid) | 10 req/s | REST client with token rotation |
| **Galxe** | GraphQL | None (public) | ~50 req/min | GraphQL client, batch queries |
| **Layer3** | REST (unofficial) | None | ~30 req/min | Scraper with headless browser fallback |
| **Zealy** | REST (unofficial) | None | ~20 req/min | Scraper, cache aggressively |
| **Airdrops.io** | No API | N/A | N/A | HTML scraper (Cheerio/Playwright) |
| **CMC Airdrops** | REST | API key (free tier) | 10k calls/month | REST client, daily sync |
| **DappRadar** | REST | API key (free tier) | 1k calls/day | REST client, daily sync |
| **X/Twitter** | REST v2 | Bearer token (free: 1.5k/mo) | 1.5k/mo free | Free tier + scraper fallback |
| **Discord** | REST | Bot token | 50 req/s | Bot listener for announcements |
| **Telegram** | Bot API | Bot token | 30 req/s | Bot for alerts, MTProto for channel scraping |
| **Etherscan** | REST | API key (free: 5/s) | 5 req/s | REST client, multi-key rotation |
| **DefiLlama** | REST | None (free) | ~50 req/min | REST client, cache 1 hour |
| **CryptoRank** | REST | API key (paid) | Varies | REST client |
| **RootData** | REST | API key (free tier) | 100 req/day | REST client, daily sync |
| **OpenSea** | REST | API key (free) | 5 req/s | REST client |
| **Magic Eden** | REST | None | ~30 req/min | REST client |

### 2.2 Rate Limit Handling

```python
class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max = max_requests
        self.window = window_seconds
        self.tokens = max_requests
        self.last_refill = time.time()

    async def acquire(self):
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.max, self.tokens + elapsed * (self.max / self.window))
        self.last_refill = now

        if self.tokens < 1:
            wait_time = (1 - self.tokens) * (self.window / self.max)
            await asyncio.sleep(wait_time)
            self.tokens = 0
        else:
            self.tokens -= 1

        return True
```

### 2.3 Data Format Normalization

All sources map to unified schemas:

```typescript
// Unified Project
interface UnifiedProject {
  id: string              // slug-based: "monad"
  name: string            // "Monad"
  category: string        // "layer1" | "layer2" | "defi" | "nft" | "infra"
  description: string
  website: string | null
  twitter: string | null
  discord: string | null
  funding: {
    amount: number | null
    currency: string
    round: string | null
    investors: string[]
    source: string        // "rootdata" | "cryptorank" | "manual"
  }
  token: {
    status: "no_token" | "rumored" | "announced" | "launched"
    ticker: string | null
    chain: string | null
    tge_date: string | null
  }
  chains: string[]        // ["ethereum", "solana"]
  tvl: number | null
  source: string          // which platform provided this data
  last_updated: string    // ISO timestamp
  freshness_score: number // 0-100 based on data age
}

// Unified Opportunity
interface UnifiedOpportunity {
  id: string
  project_id: string
  type: "airdrop" | "testnet" | "quest" | "defi" | "nft_mint" | "staking"
  title: string
  description: string
  url: string
  platform: string        // "galxe" | "layer3" | "zealy" | "manual"
  status: "active" | "upcoming" | "ended"
  start_date: string | null
  end_date: string | null
  reward_estimate: {
    min_usd: number | null
    max_usd: number | null
    token: string | null
    confidence: number    // 0-100
  }
  requirements: Requirement[]
  difficulty: number      // 1-5
  cost_estimate: number   // USD
  time_estimate: number   // minutes
  source_data: object     // raw data from source
  last_synced: string
}

// Unified Task
interface UnifiedTask {
  id: string
  opportunity_id: string
  project_id: string
  type: "bridge" | "swap" | "stake" | "mint" | "social" | "discord" | "testnet" | "quest" | "custom"
  title: string
  description: string
  url: string | null
  platform: string        // "galxe" | "layer3" | "twitter" | "discord"
  status: "pending" | "completed" | "failed"
  difficulty: number      // 1-5
  xp_reward: number       // gamification points
  deadline: string | null
  verification: {
    type: "manual" | "onchain" | "api"
    check_url: string | null
    required_tx_count: number | null
    required_balance: number | null
  }
  completed_at: string | null
}
```

---

## 3. DATA MODEL DESIGN

### 3.1 PostgreSQL Schema (Supabase)

```sql
-- Core tables (already partially implemented)

CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  ecosystem TEXT,
  description TEXT,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  telegram_url TEXT,
  docs_url TEXT,
  github_url TEXT,
  funding_amount DECIMAL,
  funding_currency TEXT DEFAULT 'USD',
  funding_round TEXT,
  investors TEXT[] DEFAULT '{}',
  token_status TEXT DEFAULT 'no_token',
  token_ticker TEXT,
  token_chain TEXT,
  tge_date DATE,
  chains TEXT[] DEFAULT '{}',
  tvl DECIMAL,
  snapshot_status TEXT DEFAULT 'unknown',
  snapshot_date DATE,
  estimated_reward_min DECIMAL,
  estimated_reward_max DECIMAL,
  farming_difficulty INT DEFAULT 5,
  risk_score INT DEFAULT 5,
  farming_cost DECIMAL DEFAULT 0,
  probability_score INT DEFAULT 50,
  ai_summary TEXT,
  ai_recommendation TEXT,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'manual',
  freshness_score INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- airdrop, testnet, quest, defi, nft_mint, staking
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  platform TEXT,       -- galxe, layer3, zealy, manual
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  reward_min_usd DECIMAL,
  reward_max_usd DECIMAL,
  reward_token TEXT,
  reward_confidence INT DEFAULT 50,
  difficulty INT DEFAULT 3,
  cost_estimate DECIMAL DEFAULT 0,
  time_estimate INT,   -- minutes
  source_data JSONB,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL,  -- bridge, swap, stake, mint, social, discord, testnet, quest
  requirement_type TEXT DEFAULT 'quest',
  url TEXT,
  platform TEXT,
  status TEXT DEFAULT 'pending',
  difficulty INT DEFAULT 3,
  target_value DECIMAL,
  target_unit TEXT,
  deadline TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_interval TEXT,
  estimated_time_minutes INT,
  verification_type TEXT DEFAULT 'manual',
  verification_url TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  address TEXT NOT NULL,
  label TEXT,
  chain TEXT DEFAULT 'ethereum',
  tags TEXT[] DEFAULT '{}',
  last_analyzed TIMESTAMPTZ,
  analysis_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain)
);

CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id),
  project_id UUID REFERENCES projects(id),
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  type TEXT NOT NULL,  -- bridge, swap, stake, mint, transfer
  amount DECIMAL,
  token TEXT,
  usd_value DECIMAL,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  platform TEXT NOT NULL,  -- twitter, discord, telegram
  signal_type TEXT NOT NULL,  -- announcement, partnership, funding, tge, airdrop
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  author TEXT,
  sentiment TEXT DEFAULT 'neutral',  -- positive, neutral, negative
  importance INT DEFAULT 5,  -- 1-10
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eligibility_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,  -- min_txs, min_volume, min_balance, specific_protocol, time_window
  description TEXT NOT NULL,
  params JSONB,  -- { min_txs: 10, min_volume_usd: 1000, protocols: ["uniswap", "aave"] }
  weight DECIMAL DEFAULT 1.0,  -- importance weight for scoring
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallet_eligibility (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id),
  project_id UUID REFERENCES projects(id),
  eligibility_score DECIMAL DEFAULT 0,  -- 0-100
  rules_met INT DEFAULT 0,
  rules_total INT DEFAULT 0,
  missing_tasks TEXT[],  -- task titles not completed
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, project_id)
);

CREATE TABLE ai_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  model TEXT NOT NULL,  -- llama-3.1-8b, etc.
  probability_score INT,
  risk_score INT,
  reward_min DECIMAL,
  reward_max DECIMAL,
  popularity TEXT,
  summary TEXT,
  recommendation TEXT,
  raw_response JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE ingestion_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,  -- galxe, layer3, twitter, etc.
  job_type TEXT NOT NULL,  -- full_sync, incremental, webhook
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
  params JSONB,
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT UNIQUE NOT NULL,
  last_sync TIMESTAMPTZ,
  last_cursor TEXT,  -- pagination cursor
  items_synced INT DEFAULT 0,
  error_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_probability ON projects(probability_score DESC);
CREATE INDEX idx_projects_token_status ON projects(token_status);
CREATE INDEX idx_opportunities_project ON opportunities(project_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_platform ON opportunities(platform);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_opportunity ON tasks(opportunity_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_social_signals_project ON social_signals(project_id);
CREATE INDEX idx_social_signals_platform ON social_signals(platform);
CREATE INDEX idx_social_signals_published ON social_signals(published_at DESC);
CREATE INDEX idx_eligibility_wallet ON wallet_eligibility(wallet_id);
CREATE INDEX idx_eligibility_project ON wallet_eligibility(project_id);
CREATE INDEX idx_ai_scores_project ON ai_scores(project_id);
CREATE INDEX idx_ai_scores_expires ON ai_scores(expires_at);
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX idx_sync_state_source ON sync_state(source);

-- pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE project_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  embedding vector(768),  -- Llama embedding dimension
  content_type TEXT,  -- description, summary, social
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. DATA PIPELINE

### 4.1 ETL Flow

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│ EXTRACT │───▶│ TRANSFORM│───▶│   LOAD    │───▶│  SCORE   │───▶│  SERVE   │
│         │    │          │    │           │    │          │    │          │
│ • REST  │    │ • Map to │    │ • Upsert  │    │ • AI     │    │ • API    │
│ • GraphQL│   │  unified │    │ • Dedup   │    │   scoring│    │ • WS     │
│ • Scraper│   │  schema  │    │ • Validate│    │ • Elig.  │    │ • Bot    │
│ • Webhook│   │ • Enrich │    │ • Index   │    │   check  │    │          │
└─────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 4.2 Step-by-Step Pipeline

**Step 1: Scheduling**

```python
# jobs/scheduler.py
SCHEDULE = {
    "defillama":     {"interval": 3600,   "type": "full_sync"},   # every hour
    "galxe":         {"interval": 1800,   "type": "incremental"},  # every 30 min
    "layer3":        {"interval": 1800,   "type": "incremental"},
    "zealy":         {"interval": 3600,   "type": "full_sync"},
    "twitter":       {"interval": 900,    "type": "incremental"},  # every 15 min
    "discord":       {"interval": 300,    "type": "webhook"},      # real-time
    "etherscan":     {"interval": 600,    "type": "incremental"},  # every 10 min
    "cryptorank":    {"interval": 86400,  "type": "full_sync"},    # daily
    "rootdata":      {"interval": 86400,  "type": "full_sync"},
    "opensea":       {"interval": 3600,   "type": "incremental"},
    "airdrops_io":   {"interval": 3600,   "type": "full_sync"},
    "cmc_airdrops":  {"interval": 86400,  "type": "full_sync"},
    "dappradar":     {"interval": 3600,   "type": "incremental"},
}
```

**Step 2: Extraction**

```python
# ingestors/galxe.py
class GalxeIngestor:
    def fetch_campaigns(self, cursor: str = None) -> dict:
        query = """
        query {
          campaigns(first: 50, after: "{cursor}") {
            edges {
              node {
                id
                title
                description
                startTime
                endTime
                status
                tasks { id, type, name, url }
                rewards { type, amount, token }
              }
            }
            pageInfo { hasNextPage, endCursor }
          }
        }
        """
        return self.graphql_client.execute(query)

    def normalize(self, raw: dict) -> list[UnifiedOpportunity]:
        return [
            UnifiedOpportunity(
                project_id=self._resolve_project(c["title"]),
                type="quest",
                title=c["title"],
                description=c["description"],
                url=f"https://galxe.com/campaign/{c['id']}",
                platform="galxe",
                status=self._map_status(c["status"]),
                start_date=c["startTime"],
                end_date=c["endTime"],
                requirements=[self._map_task(t) for t in c["tasks"]],
                reward_estimate=self._estimate_reward(c["rewards"]),
                difficulty=self._calc_difficulty(c["tasks"]),
                source_data=c,
            )
            for c in raw["campaigns"]["edges"]
        ]
```

**Step 3: Deduplication**

```python
class Deduplicator:
    def deduplicate_opportunities(self, new: list[UnifiedOpportunity]) -> list:
        existing = self.db.get_opportunities_by_urls([o.url for o in new])
        existing_urls = {o.url for o in existing}

        to_insert = []
        to_update = []

        for opp in new:
            if opp.url in existing_urls:
                to_update.append(opp)
            else:
                # Also check by title similarity (fuzzy match)
                similar = self.fuzzy_match(opp.title, existing)
                if similar and self.similarity_score(opp.title, similar.title) > 0.85:
                    to_update.append(opp)
                else:
                    to_insert.append(opp)

        return to_insert, to_update
```

**Step 4: Data Freshness**

```python
class FreshnessChecker:
    FRESHNESS_DECAY = {
        "twitter": 300,       # 5 min decay
        "discord": 300,
        "galxe": 1800,        # 30 min decay
        "layer3": 1800,
        "defillama": 3600,    # 1 hour decay
        "cryptorank": 86400,  # 1 day decay
    }

    def calculate_freshness(self, project_id: str) -> int:
        signals = self.db.get_recent_signals(project_id, hours=24)
        if not signals:
            return 0

        weighted_score = 0
        total_weight = 0

        for signal in signals:
            age_seconds = time.time() - signal.published_at.timestamp()
            decay_rate = self.FRESHNESS_DECAY.get(signal.platform, 3600)
            weight = max(0, 1 - (age_seconds / decay_rate))
            weighted_score += signal.importance * weight
            total_weight += signal.importance

        return int((weighted_score / total_weight) * 100) if total_weight > 0 else 0
```

**Step 5: Loading**

```python
# Uses Supabase upsert with conflict resolution
async def load_opportunities(opp_list: list[UnifiedOpportunity]):
    records = [o.to_dict() for o in opp_list]

    result = await supabase.table("opportunities").upsert(
        records,
        on_conflict="url",  # unique constraint on url
    ).execute()

    return result.data
```

---

## 5. AI LAYER

### 5.1 Models & Data Requirements

| Model | Input Data | Output | Model |
|-------|-----------|--------|-------|
| **Opportunity Scorer** | Project funding, investors, token status, TVL, social signals, chain activity | Score 1-100, reward estimate, risk level | Llama 3.1 8B |
| **Eligibility Predictor** | Wallet tx history, protocol interactions, balances, time windows | Eligibility % per project, missing tasks | Llama 3.1 8B |
| **Wallet Analyzer** | Address, tx history, balances, DeFi positions, NFT holdings | Risk score, activity summary, recommendations | Llama 3.1 8B |
| **Summarizer** | Project description, social signals, funding data | 1-paragraph summary, key points | Llama 3.1 8B |
| **Missed Opportunity Detector** | Wallet history vs eligibility rules | List of missed airdrops, estimated loss | Llama 3.1 8B |

### 5.2 Opportunity Scoring Prompt

```
You are a crypto airdrop analyst. Score this project's airdrop potential.

Project: {name}
Category: {category}
Funding: ${funding_amount} from {investors}
Token Status: {token_status}
TVL: ${tvl}
Chains: {chains}
Recent Signals: {social_signals_summary}
Tasks Available: {task_count} ({task_types})

Score 1-100 based on:
- Funding quality (top-tier VCs = higher)
- Token status (no_token + rumored = highest potential)
- TVL and activity
- Social momentum
- Task complexity (more tasks = more likely airdrop)

Return JSON:
{
  "score": 85,
  "reward_min_usd": 500,
  "reward_max_usd": 5000,
  "risk": 4,
  "confidence": 75,
  "reasoning": "Short explanation",
  "action": "Bridge ETH, swap on testnet, join Discord"
}
```

### 5.3 Eligibility Prediction

```
Analyze wallet activity against project eligibility criteria.

Wallet: {address}
Project: {project_name}
Known Eligibility Rules: {rules}
Wallet Activity: {tx_summary}
  - Total transactions: {tx_count}
  - Protocols used: {protocols}
  - Total volume: ${volume}
  - First activity: {first_tx_date}
  - Last activity: {last_tx_date}
  - Chains: {chains}

Return JSON:
{
  "eligibility_score": 72,
  "rules_met": 3,
  "rules_total": 5,
  "met_rules": ["min_txs", "min_volume", "used_protocol"],
  "missing_rules": ["time_window", "specific_protocol"],
  "recommended_actions": ["Bridge to Arbitrum", "Use Aave"],
  "estimated_probability": "high"
}
```

### 5.4 Caching Strategy

```python
class AICache:
    TTL = {
        "score": 300,        # 5 min
        "eligibility": 600,  # 10 min
        "wallet_analysis": 900,  # 15 min
        "summary": 3600,     # 1 hour
    }

    async def get_or_compute(self, key: str, compute_fn, ttl: int):
        cached = await self.redis.get(f"ai:{key}")
        if cached:
            return json.loads(cached)

        result = await compute_fn()
        await self.redis.setex(f"ai:{key}", ttl, json.dumps(result))
        return result
```

---

## 6. BACKEND STRUCTURE

### 6.1 Recommended Stack

```
Frontend:       Next.js 15 (App Router) + React 19 + Tailwind
Backend API:    Next.js API Routes (serverless)
Ingestion:      Python 3.12 + FastAPI (separate worker service)
Database:       PostgreSQL (Supabase) + pgvector
Cache:          Redis (Upstash or Supabase Redis)
Queue:          BullMQ (Redis-based) or Celery (Python)
AI:             NVIDIA NIM API (Llama 3.1 8B)
Real-time:      Supabase Realtime (WebSockets)
Deployment:     Vercel (Next.js) + Railway/Render (Python workers)
```

### 6.2 Directory Structure

```
crypto-hunter-os/
├── src/                          # Next.js frontend + API
│   ├── app/                      # App Router pages
│   │   ├── api/
│   │   │   ├── projects/         # CRUD endpoints
│   │   │   ├── opportunities/    # Opportunity endpoints
│   │   │   ├── tasks/            # Task endpoints
│   │   │   ├── wallets/          # Wallet endpoints
│   │   │   ├── ai/               # AI endpoints
│   │   │   └── ingest/           # Trigger ingestion jobs
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── opportunities/
│   │   ├── wallets/
│   │   └── settings/
│   ├── components/
│   ├── lib/
│   │   ├── supabase.ts           # DB client
│   │   ├── ai.ts                 # AI client
│   │   └── utils.ts
│   ├── hooks/
│   └── store/
│
├── workers/                      # Python ingestion service
│   ├── main.py                   # FastAPI entry point
│   ├── scheduler.py              # Cron job scheduler
│   ├── ingestors/
│   │   ├── base.py               # Base ingestor class
│   │   ├── galxe.py
│   │   ├── layer3.py
│   │   ├── zealy.py
│   │   ├── twitter.py
│   │   ├── discord.py
│   │   ├── defillama.py
│   │   ├── etherscan.py
│   │   ├── cryptorank.py
│   │   └── ...
│   ├── normalizers/
│   │   ├── project.py
│   │   ├── opportunity.py
│   │   └── task.py
│   ├── deduplicator.py
│   ├── freshness.py
│   ├── queue.py                  # Redis queue handler
│   └── config.py
│
├── bot/                          # Telegram bot
│   ├── main.py                   # Bot entry point
│   ├── commands/
│   ├── alerts.py
│   └── keyboards.py
│
├── supabase/
│   └── migrations/               # SQL migrations
│
└── docker-compose.yml            # Local dev (Postgres + Redis)
```

### 6.3 API Structure (REST)

```
GET    /api/projects              # List all projects (filtered)
GET    /api/projects/:slug        # Single project detail
POST   /api/projects              # Create project
PUT    /api/projects/:slug        # Update project
DELETE /api/projects/:slug        # Delete project
POST   /api/projects/discover     # Auto-discover new projects
POST   /api/projects/refresh      # Refresh existing projects

GET    /api/opportunities         # List opportunities
GET    /api/opportunities/:id     # Single opportunity
POST   /api/opportunities         # Create opportunity
GET    /api/opportunities/project/:projectId  # By project

GET    /api/tasks                  # List tasks
POST   /api/tasks                  # Create task
PUT    /api/tasks/:id              # Update task (complete)
DELETE /api/tasks/:id              # Delete task
POST   /api/tasks/save             # Batch save tasks

GET    /api/wallets                # List wallets
POST   /api/wallets                # Add wallet
DELETE /api/wallets/:id            # Delete wallet
POST   /api/wallets/:id/analyze   # Trigger AI analysis
GET    /api/wallets/:id/eligibility  # Get eligibility scores

GET    /api/ai/score-project       # Score a project
POST   /api/ai/parse-tasks         # Parse tasks from text
POST   /api/ai/analyze-wallet      # Analyze wallet

GET    /api/signals                # Social signals
GET    /api/signals/project/:id    # Signals for project

POST   /api/ingest/trigger         # Trigger ingestion job
GET    /api/ingest/status          # Job status
```

---

## 7. FRONTEND DATA FLOW

### 7.1 Live Updates Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js    │     │  Supabase    │     │  Ingestion   │
│  Client     │◀───▶│  Realtime    │◀───▶│  Workers     │
│             │     │  (WebSocket) │     │              │
│ • SWR cache │     │              │     │ • Poll APIs  │
│ • Optimistic│     │ • Channels:  │     │ • Parse data │
│   updates   │     │   projects   │     │ • Insert to  │
│ • Revalidate│     │   tasks      │     │   DB         │
│   on focus  │     │   signals    │     │ • Triggers   │
└─────────────┘     │   alerts     │     │   Realtime   │
                    └──────────────┘     └──────────────┘
```

### 7.2 Dashboard Structure

```
Dashboard
├── Overview Cards
│   ├── Total Projects Tracked
│   ├── Active Opportunities
│   ├── Completed Tasks
│   ├── XP / Level
│   └── Portfolio Value (estimated)
│
├── AI Recommendations
│   ├── Top 3 opportunities by score
│   ├── Missed opportunities alert
│   └── Wallet health score
│
├── Active Opportunities
│   ├── Filterable list (type, platform, status)
│   ├── Progress bars per opportunity
│   └── Quick-action buttons
│
├── Recent Signals
│   ├── Twitter announcements
│   ├── Discord updates
│   └── Funding news
│
├── Task Queue
│   ├── Today's tasks (sorted by difficulty)
│   ├── Overdue tasks
│   └── Streak counter
│
└── Wallet Overview
    ├── Connected wallets
    ├── Eligibility scores
    └── Recent transactions
```

### 7.3 Filtering & Search

```typescript
// Server-side filtering via Supabase
function useProjects(filters: ProjectFilters) {
  return useSWR(
    ['/api/projects', filters],
    async ([url, filters]) => {
      const params = new URLSearchParams()
      if (filters.category) params.set('category', filters.category)
      if (filters.minScore) params.set('min_score', filters.minScore)
      if (filters.tokenStatus) params.set('token_status', filters.tokenStatus)
      if (filters.search) params.set('search', filters.search)
      if (filters.sortBy) params.set('sort', filters.sortBy)

      const res = await fetch(`${url}?${params}`)
      return res.json()
    },
    { refreshInterval: 60000 }  // 1 min auto-refresh
  )
}
```

---

## 8. TELEGRAM BOT INTEGRATION

### 8.1 Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Telegram    │     │  Bot Service │     │  Backend API │
│  Users       │◀───▶│  (Node.js)   │◀───▶│  (Next.js)   │
│              │     │              │     │              │
│ /start       │     │ • Command    │     │ • /api/      │
│ /projects    │     │   handler    │     │   endpoints  │
│ /alerts on   │     │ • Inline     │     │              │
│ /wallet      │     │   keyboards  │     │              │
│ /score       │     │ • Scheduled  │     │              │
│              │     │   alerts     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 8.2 Bot Commands

```
/start          — Welcome + setup wizard
/projects       — List top opportunities (inline keyboard)
/alerts on      — Enable push notifications
/alerts off     — Disable notifications
/wallet         — Show wallet eligibility
/score <name>   — Get AI score for project
/tasks          — Show today's tasks
/settings       — Configure preferences
/help           — Command reference
```

### 8.3 Alert Push Logic

```python
class AlertDispatcher:
    async def push_alerts(self):
        # Check for new high-score opportunities
        new_opps = await self.db.get_new_opportunities(min_score=70)
        for opp in new_opps:
            subscribers = await self.db.get_alert_subscribers("new_opportunity")
            for user in subscribers:
                await self.bot.send_message(
                    chat_id=user.telegram_id,
                    text=self.format_opportunity_alert(opp),
                    reply_markup=self.create_action_buttons(opp),
                )

        # Check for deadline reminders
        deadlines = await self.db.get_upcoming_deadlines(hours=24)
        for deadline in deadlines:
            users = await self.db.get_users_tracking(deadline.project_id)
            for user in users:
                await self.bot.send_message(
                    chat_id=user.telegram_id,
                    text=f"⏰ Deadline: {deadline.title} ends in 24h",
                )

        # Check for social signals
        signals = await self.db.get_important_signals(hours=1, min_importance=7)
        for signal in signals:
            followers = await self.db.get_project_followers(signal.project_id)
            for user in followers:
                await self.bot.send_message(
                    chat_id=user.telegram_id,
                    text=f"📢 {signal.title}",
                )
```

### 8.4 Bot Implementation (Node.js)

```typescript
// bot/main.ts
import { Bot } from 'grammy'

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

bot.command('start', async (ctx) => {
  await ctx.reply('🎯 Crypto Hunter OS\n\nTrack airdrops, testnets, and quests.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔥 Top Opportunities', callback_data: 'projects:top' }],
        [{ text: '📊 My Wallet', callback_data: 'wallet' }],
        [{ text: '🔔 Enable Alerts', callback_data: 'alerts:on' }],
      ],
    },
  })
})

bot.callbackQuery(/^projects:(.*)/, async (ctx) => {
  const filter = ctx.match[1]
  const projects = await fetch(`${API_URL}/api/projects?sort=probability&limit=5`).then(r => r.json())

  const keyboard = projects.map(p => [
    { text: `${p.name} (${p.probability_score}%)`, callback_data: `project:${p.slug}` }
  ])

  await ctx.editMessageText('🔥 Top Opportunities:', {
    reply_markup: { inline_keyboard: keyboard },
  })
})

// Scheduled alert checker
import cron from 'node-cron'
cron.schedule('*/15 * * * *', async () => {
  await alertDispatcher.pushAlerts()
})
```

---

## 9. SCALABILITY PLAN

### 9.1 User Tiers & Infrastructure

| Users | Architecture | Cost/Mo |
|-------|-------------|---------|
| 1K | Monolith on Vercel + Supabase Free + Upstash Free | $0-20 |
| 10K | Vercel Pro + Supabase Pro + Redis cluster | $100-300 |
| 100K | Vercel Enterprise + Supabase Team + Dedicated Redis + Read replicas | $1K-3K |
| 1M | Multi-region + DB sharding + CDN + Worker pools | $5K-15K |

### 9.2 Scaling Ingestion Pipelines

```
Phase 1 (1K users):
  Single Python worker, cron every 15-60 min
  Redis queue for job management
  Sequential API calls with rate limiting

Phase 2 (10K users):
  Multiple workers (3-5) behind load balancer
  Distributed rate limiting via Redis
  Parallel ingestion with dedup coordination

Phase 3 (100K users):
  Kubernetes cluster with auto-scaling workers
  Kafka for event streaming
  Separate workers per source (Galxe worker, Twitter worker, etc.)
  Circuit breakers for failing APIs

Phase 4 (1M users):
  Multi-region deployment
  Regional data aggregation (US, EU, Asia)
  Edge caching for frequently accessed data
  Database read replicas per region
```

### 9.3 Caching Strategy

```
Layer 1: Browser cache (SWR, 1 min stale-while-revalidate)
Layer 2: CDN edge cache (Vercel, static pages, 5 min)
Layer 3: Redis cache (API responses, AI scores, 5-15 min)
Layer 4: Database query cache (Supabase, 1 min)
Layer 5: Materialized views (aggregated stats, 1 hour refresh)
```

### 9.4 Database Sharding (1M+ users)

```
Shard by user_id hash:
  Shard 1: users 0x0000-0x3FFF
  Shard 2: users 0x4000-0x7FFF
  Shard 3: users 0x8000-0xBFFF
  Shard 4: users 0xC000-0xFFFF

Shared tables (not sharded):
  projects, opportunities, tasks, signals
  (reference data, same for all users)

User-specific tables (sharded):
  wallets, transactions, wallet_eligibility
  user_settings, notifications
```

---

## 10. SECURITY STRATEGY

### 10.1 API Key Protection

```
1. Store keys in environment variables (never in code)
2. Use Supabase Vault for production secrets
3. Rotate keys every 90 days
4. Use separate keys per environment (dev/staging/prod)
5. Monitor key usage via API provider dashboards
6. Implement key fallback (multiple keys per service)
```

### 10.2 Wallet Security

```
1. NEVER store private keys or seed phrases
2. Only store public addresses
3. Use read-only RPC endpoints for blockchain queries
4. Implement address validation before storage
5. Rate limit wallet analysis requests
6. Encrypt sensitive wallet metadata at rest
```

### 10.3 Rate Limiting

```typescript
// API rate limiting (Next.js middleware)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),  // 100 req/min per IP
})

export async function middleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
}
```

### 10.4 Anti-Scraping Protection

```
1. Implement CAPTCHA on sensitive endpoints
2. Monitor for unusual request patterns
3. Block known scraper user agents
4. Require authentication for data export
5. Implement request fingerprinting
6. Rate limit by API key + IP combination
```

### 10.5 User Data Privacy

```
1. GDPR compliance (data export, deletion)
2. Encrypt PII at rest (Supabase pgcrypto)
3. Anonymize analytics data
4. No third-party tracking on wallet pages
5. Clear data retention policies
6. User consent for data collection
```

---

## 11. MVP IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2) ✅ Partially Done

- [x] Next.js + Supabase setup
- [x] Projects CRUD
- [x] Tasks CRUD
- [x] Wallets CRUD
- [x] AI scoring (NVIDIA NIM)
- [x] Russian UI
- [ ] Opportunities table + CRUD
- [ ] Social signals table + ingestion
- [ ] Eligibility rules table

### Phase 2: Data Ingestion (Week 3-4)

- [ ] Python worker service setup
- [ ] DefiLlama ingestor (easiest, no auth)
- [ ] Galxe ingestor (GraphQL, no auth)
- [ ] Layer3 ingestor (scraper)
- [ ] Redis queue + scheduler
- [ ] Normalization layer
- [ ] Deduplication logic
- [ ] Sync state tracking

### Phase 3: Social Signals (Week 5-6)

- [ ] Twitter ingestor (free API tier)
- [ ] Discord bot listener
- [ ] Telegram channel scraper
- [ ] Signal classification (AI-powered)
- [ ] Freshness scoring
- [ ] Real-time alerts

### Phase 4: Wallet Analysis (Week 7-8)

- [ ] Etherscan ingestor
- [ ] Multi-chain support (Arbitrum, Optimism, Base)
- [ ] Transaction tracking
- [ ] Eligibility checker
- [ ] Missed opportunity detection
- [ ] Wallet health score

### Phase 5: Telegram Bot (Week 9-10)

- [ ] Bot setup + commands
- [ ] Opportunity alerts
- [ ] Deadline reminders
- [ ] Wallet eligibility check
- [ ] Inline keyboards
- [ ] User preferences

### Phase 6: Polish & Scale (Week 11-12)

- [ ] Dashboard analytics
- [ ] Search & filtering
- [ ] Export/Import
- [ ] Performance optimization
- [ ] Error monitoring (Sentry)
- [ ] Documentation
- [ ] Load testing

---

## 12. CURRENT STATUS & NEXT STEPS

### What's Built
- ✅ Next.js frontend with Russian UI
- ✅ Supabase database (projects, tasks, wallets, reminders, settings)
- ✅ AI scoring via NVIDIA NIM (Llama 3.1 8B)
- ✅ Project CRUD with AI parsing
- ✅ Task management
- ✅ Wallet tracking
- ✅ Settings (export/import/reset)
- ✅ Auto-refresh for projects (5 min)

### What's Missing (per this architecture)
- ❌ Opportunities table (needs migration)
- ❌ Social signals table (needs migration)
- ❌ Eligibility rules table (needs migration)
- ❌ Python ingestion workers
- ❌ Redis queue
- ❌ Telegram bot
- ❌ Multi-chain wallet analysis
- ❌ Real-time dashboard updates

### Immediate Next Steps
1. Add missing database tables (opportunities, signals, eligibility)
2. Build DefiLlama + Galxe ingestors
3. Implement Redis queue for job scheduling
4. Add real-time updates via Supabase Realtime
5. Build Telegram bot
