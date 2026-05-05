// index.js — HYPELOCK System Entry Point
import express from 'express';
import { CONFIG } from './config.js';
import { logger } from './src/utils/logger.js';
import { store } from './src/utils/memoryStore.js';

// Core
import { signalEngine } from './src/core/signalEngine.js';

// Learning
import { autoLearningLoop } from './src/learning/autoLearningLoop.js';

// Integrations
import { farcasterIntegration } from './src/integrations/farcaster.js';
import { xIntegration } from './src/integrations/x.js';
import { zoraIntegration } from './src/integrations/zora.js';

// Execution
import { executeDecision } from './src/execution/executeDecision.js';

// Distribution
import { xBot } from './src/distribution/xBot.js';
import { farcasterBot } from './src/distribution/farcasterBot.js';
import { zoraPublisher } from './src/distribution/zoraPublisher.js';

// ─── CONFIGURATION ─────────────────────────────────────────────────────────────
const app  = express();
const PORT = CONFIG.PORT;
app.use(express.json());
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));

// Tokens/keywords to monitor — configure via env or extend dynamically
const WATCH_TOKENS = (process.env.WATCH_TOKENS || 'WIF,BONK,POPCAT,PENGU,MOODENG')
  .split(',')
  .map(t => t.trim());

logger.info('═══════════════════════════════════════');
logger.info('  HYPELOCK — Attention Intelligence v1.0');
logger.info('═══════════════════════════════════════');
logger.info(`  MODE:   ${CONFIG.PAPER_MODE ? '📄 PAPER' : '🔴 LIVE'}`);
logger.info(`  PORT:   ${PORT}`);
logger.info(`  TOKENS: ${WATCH_TOKENS.join(', ')}`);
logger.info('═══════════════════════════════════════');

// ─── API ENDPOINTS ─────────────────────────────────────────────────────────────

/**
 * GET /health
 * System health check.
 */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    mode:      CONFIG.PAPER_MODE ? 'PAPER' : 'LIVE',
    uptime:    process.uptime(),
    signals:   store.signalCount(),
    timestamp: Date.now(),
  });
});

/**
 * GET /signals
 * Returns recent processed signals (last 100).
 */
app.get('/signals', (req, res) => {
  const limit  = parseInt(req.query.limit || '100');
  const action = req.query.action; // optional filter: EXECUTE | WATCH | IGNORE | DISCARDED
  const since  = req.query.since ? parseInt(req.query.since) : 0;

  let signals = store.getAllSignals()
    .sort((a, b) => b.timestamp - a.timestamp);

  if (action) {
    signals = signals.filter(s => s.action === action.toUpperCase());
  }

  if (since) {
    signals = signals.filter(s => s.timestamp >= since);
  }

  signals = signals.slice(0, limit);

  res.json({
    count:   signals.length,
    signals: signals.map(s => ({
      id:         s.id,
      token:      s.signal?.token,
      platform:   s.signal?.platform,
      score:      s.score,
      confidence: s.confidence,
      action:     s.action,
      noiseScore: s.noiseScore,
      outcome:    s.outcome,
      timestamp:  s.timestamp,
    })),
  });
});

/**
 * POST /evaluate
 * Manually inject a signal for evaluation.
 * Body: raw signal object (same format as integration output)
 */
app.post('/evaluate', async (req, res) => {
  const rawSignal = req.body;

  if (!rawSignal || !rawSignal.token) {
    return res.status(400).json({ error: 'Signal must include at least a `token` field' });
  }

  try {
    const result = await processSignalFull(rawSignal);
    res.json(result);
  } catch (err) {
    logger.error('Manual evaluation error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /learning/status
 * Returns current learning loop status and weight evolution.
 */
app.get('/learning/status', (req, res) => {
  res.json(autoLearningLoop.getStatus());
});

/**
 * GET /stats
 * Full system statistics.
 */
app.get('/stats', (req, res) => {
  res.json({
    store:     store.stats(),
    execution: executeDecision.getStats(),
    learning:  autoLearningLoop.getStatus(),
    mode:      CONFIG.PAPER_MODE ? 'PAPER' : 'LIVE',
    uptime:    process.uptime(),
    tokens:    WATCH_TOKENS,
  });
});

/**
 * POST /tokens
 * Dynamically add tokens to watch list.
 */
app.post('/tokens', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const upper = token.toUpperCase().trim();
  if (!WATCH_TOKENS.includes(upper)) {
    WATCH_TOKENS.push(upper);
    logger.info(`Token added to watchlist: ${upper}`);
  }

  res.json({ tokens: WATCH_TOKENS });
});

// ─── CORE PIPELINE ────────────────────────────────────────────────────────────

/**
 * Full signal processing pipeline:
 *   Signal → Filter → Score → Execute → Distribute
 */
async function processSignalFull(rawSignal) {
  // 1. Process through signal engine (filter + score)
  const result = await signalEngine.process(rawSignal);

  if (result.action === 'DISCARDED') {
    return { ...result, executed: false, distributed: false };
  }

  const storedRecord = store.getSignal(result.id);
  const cleanSignal  = storedRecord?.signal || rawSignal;

  // 2. Execution gate
  const execResult = await executeDecision.execute(result, cleanSignal);

  // 3. Distribution (fire-and-forget for speed)
  const distributeAsync = async () => {
    if (result.score >= CONFIG.DISTRIBUTION.MIN_SCORE_TO_DISTRIBUTE) {
      await Promise.allSettled([
        xBot.post(result, cleanSignal),
        farcasterBot.post(result, cleanSignal),
        zoraPublisher.publish(result, cleanSignal),
      ]);
    }
  };
  distributeAsync().catch(err => logger.error('Distribution error', { error: err.message }));

  return {
    ...result,
    executed:   execResult.executed || false,
    paperMode:  CONFIG.PAPER_MODE,
    orderId:    execResult.orderId || null,
  };
}

// ─── POLLING LOOPS ────────────────────────────────────────────────────────────

function startPolling() {
  // Farcaster
  setInterval(async () => {
    try {
      const signals = await farcasterIntegration.fetchSignals(WATCH_TOKENS);
      for (const s of signals) await processSignalFull(s);
      farcasterIntegration.pruneKnownIds();
    } catch (err) {
      logger.error('Farcaster poll error', { error: err.message });
    }
  }, CONFIG.POLL.FARCASTER_INTERVAL_MS);

  // X
  setInterval(async () => {
    try {
      const signals = await xIntegration.fetchSignals(WATCH_TOKENS);
      for (const s of signals) await processSignalFull(s);
      xIntegration.pruneKnownIds();
    } catch (err) {
      logger.error('X poll error', { error: err.message });
    }
  }, CONFIG.POLL.X_INTERVAL_MS);

  // Zora
  setInterval(async () => {
    try {
      const signals = await zoraIntegration.fetchSignals();
      for (const s of signals) await processSignalFull(s);
      zoraIntegration.pruneKnownIds();
    } catch (err) {
      logger.error('Zora poll error', { error: err.message });
    }
  }, CONFIG.POLL.ZORA_INTERVAL_MS);

  logger.info('Polling loops started', {
    farcaster: `${CONFIG.POLL.FARCASTER_INTERVAL_MS / 1000}s`,
    x:         `${CONFIG.POLL.X_INTERVAL_MS / 1000}s`,
    zora:      `${CONFIG.POLL.ZORA_INTERVAL_MS / 1000}s`,
  });
}

// ─── STARTUP ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`HYPELOCK API listening on port ${PORT}`);

  // Start learning loop
  autoLearningLoop.start();

  // Start integration polling
  startPolling();
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  autoLearningLoop.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  autoLearningLoop.stop();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
