// config.js — HYPELOCK Central Configuration
import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // ─── MODE ────────────────────────────────────────────────────────────────
  PAPER_MODE: process.env.PAPER_MODE !== 'false', // default: PAPER

  // ─── SERVER ──────────────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT || '3000'),

  // ─── ALPHA FILTER ────────────────────────────────────────────────────────
  ALPHA_FILTER: {
    NOISE_THRESHOLD: 0.65,          // signals above this noise score are discarded
    BOT_ENGAGEMENT_RATIO: 0.8,      // likes-to-comment ratio threshold for bot detection
    SPAM_KEYWORD_WEIGHT: 0.3,       // weight added per spam keyword match
    VELOCITY_SPIKE_WINDOW_MS: 60_000, // 1 min window for velocity spike detection
    VELOCITY_SPIKE_MULTIPLIER: 5,   // > 5x normal = suspicious spike
    SAME_SOURCE_PENALTY: 0.15,      // penalty per repeated source in window
    COORDINATION_WINDOW_MS: 300_000, // 5 min coordination detection window
    COORDINATION_MIN_ACTORS: 5,     // min actors acting in sync = coordinated
    COORDINATION_SYNC_THRESHOLD_MS: 30_000, // actions within 30s = synchronized
  },

  // ─── ADAPTIVE SCORER ─────────────────────────────────────────────────────
  SCORER: {
    EXECUTE_THRESHOLD: 75,
    WATCH_THRESHOLD: 40,
    DEFAULT_WEIGHTS: {
      likes: 0.15,
      comments: 0.20,
      recasts: 0.25,
      velocity: 0.15,
      walletQuality: 0.15,
      engagementAcceleration: 0.10,
    },
    WEIGHT_ADJUSTMENT_RATE: 0.05,   // how aggressively weights shift per learning cycle
    WEIGHT_MIN: 0.02,               // floor for any weight
    WEIGHT_MAX: 0.50,               // ceiling for any weight
    CONFIDENCE_DECAY_FACTOR: 0.85,  // confidence dampening for low-data signals
  },

  // ─── LEARNING LOOP ───────────────────────────────────────────────────────
  LEARNING: {
    EVALUATION_WINDOWS_MS: [3_600_000, 86_400_000], // 1h and 24h
    SUCCESS_ENGAGEMENT_THRESHOLD: 1.5, // 150% of baseline = success
    CYCLE_INTERVAL_MS: 600_000,     // evaluate every 10 minutes
    MAX_HISTORY: 10_000,            // max signals stored in memory
  },

  // ─── DISTRIBUTION ────────────────────────────────────────────────────────
  DISTRIBUTION: {
    X_ENABLED: process.env.X_ENABLED === 'true',
    FARCASTER_ENABLED: process.env.FARCASTER_ENABLED === 'true',
    ZORA_ENABLED: process.env.ZORA_ENABLED === 'true',
    POST_COOLDOWN_MS: 300_000,      // 5 min between posts per platform
    MIN_SCORE_TO_DISTRIBUTE: 60,    // only distribute high-confidence signals
  },

  // ─── INTEGRATIONS ────────────────────────────────────────────────────────
  INTEGRATIONS: {
    FARCASTER_HUB_URL: process.env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud',
    FARCASTER_FID: parseInt(process.env.FARCASTER_FID || '0'),
    FARCASTER_SIGNER_UUID: process.env.FARCASTER_SIGNER_UUID || '',
    X_BEARER_TOKEN: process.env.X_BEARER_TOKEN || '',
    X_API_KEY: process.env.X_API_KEY || '',
    X_API_SECRET: process.env.X_API_SECRET || '',
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || '',
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || '',
    ZORA_API_KEY: process.env.ZORA_API_KEY || '',
    ZORA_WALLET_ADDRESS: process.env.ZORA_WALLET_ADDRESS || '',
    BANKR_API_KEY: process.env.BANKR_API_KEY || '',
    BANKR_API_URL: process.env.BANKR_API_URL || 'https://api.bankr.bot/v1',
  },

  // ─── POLL INTERVALS ──────────────────────────────────────────────────────
  POLL: {
    FARCASTER_INTERVAL_MS: 30_000,  // poll every 30s
    X_INTERVAL_MS: 60_000,          // poll every 60s
    ZORA_INTERVAL_MS: 120_000,      // poll every 2 min
  },
};

export const SPAM_KEYWORDS = [
  'free airdrop', 'send eth', 'giveaway', 'dm me', '100x gem',
  'guaranteed profit', 'click here', 'join now', 'urgent',
  'buy now', 'moon soon', 'get rich', 'no risk',
];

export const EXECUTE_ACTIONS = Object.freeze({ EXECUTE: 'EXECUTE', WATCH: 'WATCH', IGNORE: 'IGNORE' });
