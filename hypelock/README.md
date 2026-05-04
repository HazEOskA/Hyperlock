# HYPELOCK — Crypto Attention Intelligence System

> Anti-noise intelligence engine + self-learning scoring + automated distribution + optional trading execution.

---

## Architecture Overview

```
DATA SOURCES (Farcaster / X / Zora)
          ↓
  ALPHA FILTER v2           ← removes bots, spam, velocity spikes,
          ↓                    coordinated manipulation
  ADAPTIVE SCORER           ← dynamic weights, 6 indicators
          ↓
  DECISION ENGINE           ← EXECUTE | WATCH | IGNORE
          ↓              ↘
  AUTO LEARNING LOOP        EXECUTION (Bankr or Paper)
  (post-analysis,           ↓
   weight adjustment)       VIRAL DISTRIBUTION
          ↑                 (X / Farcaster / Zora)
          └─────────────────────────────────────────┘
                       FEEDBACK LOOP
```

---

## File Structure

```
hypelock/
├── index.js                      # Entry point + API server + polling orchestrator
├── config.js                     # All configuration (thresholds, weights, API URLs)
├── package.json
├── .env.example
└── src/
    ├── core/
    │   ├── signalEngine.js       # Pipeline orchestrator: filter → score → store
    │   ├── alphaFilter.js        # Alpha Filter v2 (5-layer noise detection)
    │   └── adaptiveScorer.js     # Dynamic scoring engine (6 indicators)
    ├── learning/
    │   ├── autoLearningLoop.js   # Self-improving weight adjustment (cron-style)
    │   └── outcomeTracker.js     # Signal outcome evaluation (1h / 24h windows)
    ├── integrations/
    │   ├── farcaster.js          # Farcaster Hub signal collector
    │   ├── x.js                  # X (Twitter) API v2 signal collector
    │   └── zora.js               # Zora GraphQL trending tokens collector
    ├── execution/
    │   ├── executeDecision.js    # Execution gate + paper/live mode
    │   └── bankrClient.js        # Pure Bankr API wrapper (no logic)
    ├── distribution/
    │   ├── xBot.js               # X posting with rotating templates
    │   ├── farcasterBot.js       # Farcaster cast publisher
    │   └── zoraPublisher.js      # Zora artifact minter (on-chain signal artifacts)
    └── utils/
        ├── logger.js             # Winston structured logger (module-scoped)
        └── memoryStore.js        # In-process state store (signals, weights, baselines)
```

---

## Setup

### 1. Install

```bash
cd hypelock
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run

```bash
# Paper mode (safe, simulated — DEFAULT)
npm run paper

# Development with auto-reload
npm run dev

# Live mode (real execution — requires all API keys)
npm run live
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health + uptime |
| GET | `/signals` | Recent processed signals (supports `?limit=`, `?action=`, `?since=`) |
| POST | `/evaluate` | Manually inject a signal for evaluation |
| GET | `/learning/status` | Learning loop status + weight history |
| GET | `/stats` | Full system stats |
| POST | `/tokens` | Add token to watchlist dynamically |

### POST /evaluate example

```bash
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "WIF",
    "platform": "farcaster",
    "text": "WIF is going crazy right now",
    "authorId": "abc123",
    "authorFollowers": 5000,
    "authorAgeDays": 400,
    "metrics": { "likes": 250, "comments": 45, "recasts": 80 },
    "velocity": 12.5,
    "walletData": { "ageDays": 300, "txCount": 150, "balanceUSD": 2500, "protocolCount": 5 }
  }'
```

---

## Alpha Filter v2 — Noise Detection Layers

| Layer | What it detects | Max noise contribution |
|-------|----------------|----------------------|
| 1. Bot pattern | Like/comment ratio anomalies, round numbers, new accounts | 0.50 |
| 2. Spam keywords | Known spam phrases, excessive hashtags, all-caps | 0.60 |
| 3. Velocity spike | >5x engagement vs baseline in 1-min window | 0.35 |
| 4. Source repetition | Same accounts repeatedly engaging | 0.40 |
| 5. Coordination heuristics | Synchronized actions within 30s from 5+ actors | 0.40 |

**Signal is discarded if total noiseScore > 0.65**

---

## Adaptive Scorer — Indicators

| Indicator | Default Weight | Description |
|-----------|---------------|-------------|
| likes | 15% | Raw like count (log-normalized) |
| comments | 20% | Discussion depth |
| recasts | 25% | Amplification signal |
| velocity | 15% | Engagement per hour |
| walletQuality | 15% | On-chain wallet reputation |
| engagementAcceleration | 10% | Growth vs baseline |

**Weights shift automatically via learning loop.**

---

## Auto Learning Loop

- Runs every **10 minutes**
- Evaluates outcomes at **1h** and **24h** windows
- Success = engagement ratio ≥ 1.5x baseline after window
- Reinforces top-3 contributing indicators for successes
- Penalizes top-3 indicators for EXECUTE/WATCH failures
- Weights are bounded: min=0.02, max=0.50, always sum to 1.0

---

## Decision Thresholds

| Action | Effective Score |
|--------|----------------|
| EXECUTE | ≥ 75 |
| WATCH | ≥ 40 |
| IGNORE | < 40 |

*Effective score = raw score × (0.5 + 0.5 × confidence)*

---

## Distribution

All distribution bots:
- Respect a **5-minute cooldown** per platform
- Only post signals with score ≥ **60**
- Run in **dry-run mode** if API keys are missing (logs intended posts)
- Rotate templates to avoid repetition patterns

---

## Production Deployment (Railway)

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node index.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "hypelock"
```

Set environment variables in Railway dashboard.

**Required for paper mode:** none (runs out of box)

**Required for live mode:** BANKR_API_KEY + at least one integration key

---

## Scaling Notes

| Concern | Current | Production upgrade |
|---------|---------|-------------------|
| State storage | In-memory Map | Redis / Upstash |
| Signal persistence | Memory (10k max) | PostgreSQL / Supabase |
| Multi-instance | Single node | Redis pub/sub for coordination |
| Outcome tracking | Baseline heuristic | On-chain price data via Birdeye/Dexscreener |
| Wallet scoring | Basic heuristics | Nansen / Arkham enrichment |

---

## Security Notes

- Bankr is **never called** unless `action === 'EXECUTE'`
- `PAPER_MODE=true` is the default — real execution requires explicit opt-in
- No credentials are logged (only presence is checked)
- All external calls have timeout guards (8-15s)
