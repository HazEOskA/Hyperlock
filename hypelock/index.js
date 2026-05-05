// index.js — HYPELOCK System Entry Point (v2 — with Frame + Dashboard)
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
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

// ─── SETUP ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = CONFIG.PORT;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://hyperlock-production.up.railway.app';

const WATCH_TOKENS = (process.env.WATCH_TOKENS || 'WIF,BONK,POPCAT,PENGU,MOODENG')
  .split(',').map(t => t.trim());

logger.info('═══════════════════════════════════════');
logger.info('  HYPELOCK — Attention Intelligence v2.0');
logger.info('═══════════════════════════════════════');
logger.info(`  MODE:   ${CONFIG.PAPER_MODE ? '📄 PAPER' : '🔴 LIVE'}`);
logger.info(`  PORT:   ${PORT}`);
logger.info(`  TOKENS: ${WATCH_TOKENS.join(', ')}`);
logger.info(`  FRAME:  ${BASE_URL}/frame`);
logger.info('═══════════════════════════════════════');

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    mode:      CONFIG.PAPER_MODE ? 'PAPER' : 'LIVE',
    uptime:    process.uptime(),
    signals:   store.signalCount(),
    timestamp: Date.now(),
  });
});

app.get('/signals', (req, res) => {
  const limit  = parseInt(req.query.limit || '100');
  const action = req.query.action;
  const since  = req.query.since ? parseInt(req.query.since) : 0;

  let signals = store.getAllSignals().sort((a, b) => b.timestamp - a.timestamp);
  if (action) signals = signals.filter(s => s.action === action.toUpperCase());
  if (since)  signals = signals.filter(s => s.timestamp >= since);
  signals = signals.slice(0, limit);

  res.json({
    count: signals.length,
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

app.get('/learning/status', (req, res) => {
  res.json(autoLearningLoop.getStatus());
});

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

app.post('/tokens', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const upper = token.toUpperCase().trim();
  if (!WATCH_TOKENS.includes(upper)) {
    WATCH_TOKENS.push(upper);
    logger.info(`Token added: ${upper}`);
  }
  res.json({ tokens: WATCH_TOKENS });
});

// ─── FARCASTER FRAME ──────────────────────────────────────────────────────────
app.get('/frame', (req, res) => {
  res.send(`<!DOCTYPE html><html><head>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${BASE_URL}/frame/image/home"/>
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1"/>
  <meta property="fc:frame:input:text" content="Enter token: WIF, BONK, SOL..."/>
  <meta property="fc:frame:button:1" content="🔍 Scan Token"/>
  <meta property="fc:frame:button:2" content="📊 Stats"/>
  <meta property="fc:frame:post_url" content="${BASE_URL}/frame/action"/>
  <meta property="og:image" content="${BASE_URL}/frame/image/home"/>
  <meta property="og:title" content="HYPELOCK — Crypto Attention Intelligence"/>
  <title>HYPELOCK</title></head><body>HYPELOCK Frame</body></html>`);
});

app.post('/frame/action', async (req, res) => {
  const btn   = req.body?.untrustedData?.buttonIndex || 1;
  const input = (req.body?.untrustedData?.inputText || 'WIF')
    .trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'WIF';

  if (btn === 2) {
    return res.send(`<!DOCTYPE html><html><head>
    <meta property="fc:frame" content="vNext"/>
    <meta property="fc:frame:image" content="${BASE_URL}/frame/image/stats"/>
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1"/>
    <meta property="fc:frame:button:1" content="🏠 Back"/>
    <meta property="fc:frame:post_url" content="${BASE_URL}/frame/action"/>
    </head><body>Stats</body></html>`);
  }

  // Inject signal for scanned token
  try {
    await signalEngine.process({
      token: input, platform: 'frame',
      text: `Frame scan ${input}`,
      metrics: { likes: 50, comments: 10, recasts: 20 },
      velocity: 5, authorFollowers: 500, authorAgeDays: 100,
      walletData: { balanceUSD: 500, ageDays: 100, txCount: 50, protocolCount: 2 },
    });
  } catch(e) {}

  const latest = store.getAllSignals()
    .filter(s => s.signal?.token === input)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const score  = Math.round(latest?.score || 0);
  const action = latest?.action || 'WATCH';
  const imgUrl = `${BASE_URL}/frame/image/token?token=${input}&score=${score}&action=${action}&t=${Date.now()}`;

  res.send(`<!DOCTYPE html><html><head>
  <meta property="fc:frame" content="vNext"/>
  <meta property="fc:frame:image" content="${imgUrl}"/>
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1"/>
  <meta property="fc:frame:input:text" content="Scan another token..."/>
  <meta property="fc:frame:button:1" content="🔍 Scan Again"/>
  <meta property="fc:frame:button:2" content="📊 Stats"/>
  <meta property="fc:frame:button:3" content="🌐 Dashboard"/>
  <meta property="fc:frame:button:3:action" content="link"/>
  <meta property="fc:frame:button:3:target" content="${BASE_URL}"/>
  <meta property="fc:frame:post_url" content="${BASE_URL}/frame/action"/>
  </head><body>${input} score:${score}</body></html>`);
});

// ─── FRAME SVG IMAGES ─────────────────────────────────────────────────────────
app.get('/frame/image/home', (req, res) => {
  const s = store.stats();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`<svg width="1200" height="628" viewBox="0 0 1200 628" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#04040a"/><stop offset="100%" style="stop-color:#0a0a18"/>
    </linearGradient>
    <linearGradient id="ac" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00ffaa"/><stop offset="100%" style="stop-color:#00aaff"/>
    </linearGradient>
    <filter id="g"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="628" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="url(#ac)"/>
  <text x="600" y="130" font-family="monospace" font-size="80" font-weight="900" fill="url(#ac)" text-anchor="middle" filter="url(#g)" letter-spacing="8">HYPELOCK</text>
  <text x="600" y="178" font-family="monospace" font-size="18" fill="rgba(255,255,255,0.35)" text-anchor="middle" letter-spacing="4">CRYPTO ATTENTION INTELLIGENCE</text>
  <line x1="200" y1="215" x2="1000" y2="215" stroke="rgba(0,255,170,0.15)" stroke-width="1"/>
  <text x="250" y="305" font-family="monospace" font-size="64" font-weight="900" fill="#00ffaa" text-anchor="middle" filter="url(#g)">${s.totalSignals||0}</text>
  <text x="250" y="338" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">SIGNALS</text>
  <text x="600" y="305" font-family="monospace" font-size="64" font-weight="900" fill="#00aaff" text-anchor="middle" filter="url(#g)">${s.executed||0}</text>
  <text x="600" y="338" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">TRADES</text>
  <text x="950" y="305" font-family="monospace" font-size="64" font-weight="900" fill="#ffcc00" text-anchor="middle" filter="url(#g)">LIVE</text>
  <text x="950" y="338" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">STATUS</text>
  <rect x="350" y="400" width="500" height="60" rx="8" fill="rgba(0,255,170,0.08)" stroke="rgba(0,255,170,0.25)" stroke-width="1"/>
  <text x="600" y="438" font-family="monospace" font-size="18" font-weight="700" fill="#00ffaa" text-anchor="middle" letter-spacing="2">↑ Enter token to scan</text>
  <text x="600" y="590" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.15)" text-anchor="middle" letter-spacing="2">Farcaster · X · Zora — Powered by HYPELOCK AI</text>
</svg>`);
});

app.get('/frame/image/token', (req, res) => {
  const token  = (req.query.token || 'WIF').slice(0, 10);
  const score  = parseInt(req.query.score || 0);
  const action = req.query.action || 'WATCH';
  const color  = action === 'EXECUTE' ? '#00ffaa' : action === 'WATCH' ? '#ffcc00' : action === 'DISCARDED' ? '#ff2d6e' : '#666688';
  const label  = action === 'DISCARDED' ? 'BLOCKED' : action;
  const bar    = Math.round((score / 100) * 760);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`<svg width="1200" height="628" viewBox="0 0 1200 628" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#04040a"/><stop offset="100%" style="stop-color:#0a0a18"/>
    </linearGradient>
    <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00aaff"/><stop offset="100%" style="stop-color:${color}"/>
    </linearGradient>
    <filter id="g"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="628" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="${color}"/>
  <text x="60" y="55" font-family="monospace" font-size="16" fill="rgba(255,255,255,0.25)" letter-spacing="4">HYPELOCK</text>
  <text x="600" y="190" font-family="monospace" font-size="110" font-weight="900" fill="white" text-anchor="middle" filter="url(#g)" letter-spacing="4">$${token}</text>
  <text x="600" y="255" font-family="monospace" font-size="28" font-weight="700" fill="${color}" text-anchor="middle" filter="url(#g)" letter-spacing="6">${label}</text>
  <rect x="220" y="295" width="760" height="14" rx="7" fill="rgba(255,255,255,0.05)"/>
  <rect x="220" y="295" width="${bar}" height="14" rx="7" fill="url(#bar)"/>
  <text x="220" y="330" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.2)">0</text>
  <text x="980" y="330" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.2)" text-anchor="end">100</text>
  <text x="600" y="415" font-family="monospace" font-size="90" font-weight="900" fill="${color}" text-anchor="middle" filter="url(#g)">${score}</text>
  <text x="600" y="455" font-family="monospace" font-size="16" fill="rgba(255,255,255,0.25)" text-anchor="middle" letter-spacing="4">ATTENTION SCORE / 100</text>
  <text x="600" y="590" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.15)" text-anchor="middle" letter-spacing="2">HYPELOCK AI · Real-time Attention Intelligence</text>
</svg>`);
});

app.get('/frame/image/stats', (req, res) => {
  const s   = store.stats();
  const top = Object.entries(s.weights || {}).sort(([, a], [, b]) => b - a)[0] || ['learning', 0];

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`<svg width="1200" height="628" viewBox="0 0 1200 628" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#04040a"/><stop offset="100%" style="stop-color:#0a0a18"/>
    </linearGradient>
    <filter id="g"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="628" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="3" fill="#00ffaa"/>
  <text x="600" y="75" font-family="monospace" font-size="22" font-weight="700" fill="rgba(255,255,255,0.4)" text-anchor="middle" letter-spacing="6">SYSTEM STATS</text>
  <text x="200" y="200" font-family="monospace" font-size="64" font-weight="900" fill="#00ffaa" text-anchor="middle" filter="url(#g)">${s.totalSignals||0}</text>
  <text x="200" y="232" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">TOTAL</text>
  <text x="500" y="200" font-family="monospace" font-size="64" font-weight="900" fill="#00ffaa" text-anchor="middle" filter="url(#g)">${s.executed||0}</text>
  <text x="500" y="232" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">EXECUTE</text>
  <text x="780" y="200" font-family="monospace" font-size="64" font-weight="900" fill="#ffcc00" text-anchor="middle" filter="url(#g)">${s.watched||0}</text>
  <text x="780" y="232" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">WATCH</text>
  <text x="1050" y="200" font-family="monospace" font-size="64" font-weight="900" fill="#666688" text-anchor="middle" filter="url(#g)">${s.ignored||0}</text>
  <text x="1050" y="232" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.3)" text-anchor="middle" letter-spacing="2">IGNORE</text>
  <line x1="100" y1="270" x2="1100" y2="270" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <text x="600" y="335" font-family="monospace" font-size="15" fill="rgba(255,255,255,0.25)" text-anchor="middle" letter-spacing="3">TOP AI INDICATOR</text>
  <text x="600" y="420" font-family="monospace" font-size="60" font-weight="900" fill="#00aaff" text-anchor="middle" filter="url(#g)">${top[0].toUpperCase()}</text>
  <text x="600" y="465" font-family="monospace" font-size="22" fill="#00aaff" text-anchor="middle">${(top[1]*100).toFixed(1)}% WEIGHT</text>
  <text x="600" y="575" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.15)" text-anchor="middle" letter-spacing="2">HYPELOCK AI · Self-improving attention engine</text>
</svg>`);
});

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
async function processSignalFull(rawSignal) {
  const result = await signalEngine.process(rawSignal);
  if (result.action === 'DISCARDED') return { ...result, executed: false };

  const storedRecord = store.getSignal(result.id);
  const cleanSignal  = storedRecord?.signal || rawSignal;
  const execResult   = await executeDecision.execute(result, cleanSignal);

  (async () => {
    if (result.score >= CONFIG.DISTRIBUTION.MIN_SCORE_TO_DISTRIBUTE) {
      await Promise.allSettled([
        xBot.post(result, cleanSignal),
        farcasterBot.post(result, cleanSignal),
        zoraPublisher.publish(result, cleanSignal),
      ]);
    }
  })().catch(err => logger.error('Distribution error', { error: err.message }));

  return { ...result, executed: execResult.executed || false, paperMode: CONFIG.PAPER_MODE, orderId: execResult.orderId || null };
}

// ─── POLLING ──────────────────────────────────────────────────────────────────
function startPolling() {
  setInterval(async () => {
    try {
      const signals = await farcasterIntegration.fetchSignals(WATCH_TOKENS);
      for (const s of signals) await processSignalFull(s);
      farcasterIntegration.pruneKnownIds();
    } catch (err) { logger.error('Farcaster poll error', { error: err.message }); }
  }, CONFIG.POLL.FARCASTER_INTERVAL_MS);

  setInterval(async () => {
    try {
      const signals = await xIntegration.fetchSignals(WATCH_TOKENS);
      for (const s of signals) await processSignalFull(s);
      xIntegration.pruneKnownIds();
    } catch (err) { logger.error('X poll error', { error: err.message }); }
  }, CONFIG.POLL.X_INTERVAL_MS);

  setInterval(async () => {
    try {
      const signals = await zoraIntegration.fetchSignals();
      for (const s of signals) await processSignalFull(s);
      zoraIntegration.pruneKnownIds();
    } catch (err) { logger.error('Zora poll error', { error: err.message }); }
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
  autoLearningLoop.start();
  startPolling();
});

// ─── SHUTDOWN ────────────────────────────────────────────────────────────────
process.on('SIGTERM', () => { autoLearningLoop.stop(); process.exit(0); });
process.on('SIGINT',  () => { autoLearningLoop.stop(); process.exit(0); });
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
