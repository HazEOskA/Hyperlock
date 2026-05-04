// utils/memoryStore.js — In-memory state store for HYPELOCK
// In production: replace Map with Redis or similar persistent store.
import { CONFIG } from '../../config.js';
import { logger } from './logger.js';

class MemoryStore {
  constructor() {
    // signal_id → { signal, score, action, timestamp, outcome }
    this._signals     = new Map();
    // platform → last post timestamp
    this._postCooldowns = new Map();
    // key → arbitrary value store
    this._kv          = new Map();
    // engagement baselines per token/ticker
    this._baselines   = new Map();
    // source → [timestamps] — for repetition tracking
    this._sourceLogs  = new Map();
    // scorer weights — mutable learning state
    this._weights     = { ...CONFIG.SCORER.DEFAULT_WEIGHTS };

    logger.info('[MemoryStore] Initialized');
  }

  // ─── SIGNALS ─────────────────────────────────────────────────────────────
  storeSignal(id, data) {
    if (this._signals.size >= CONFIG.LEARNING.MAX_HISTORY) {
      // evict oldest
      const oldest = this._signals.keys().next().value;
      this._signals.delete(oldest);
    }
    this._signals.set(id, { ...data, storedAt: Date.now() });
  }

  getSignal(id) {
    return this._signals.get(id) || null;
  }

  updateSignal(id, patch) {
    const existing = this._signals.get(id);
    if (!existing) return false;
    this._signals.set(id, { ...existing, ...patch, updatedAt: Date.now() });
    return true;
  }

  getAllSignals() {
    return Array.from(this._signals.values());
  }

  getSignalsSince(ms) {
    const cutoff = Date.now() - ms;
    return Array.from(this._signals.values()).filter(s => s.storedAt >= cutoff);
  }

  signalCount() { return this._signals.size; }

  // ─── WEIGHTS (Learning State) ─────────────────────────────────────────────
  getWeights() { return { ...this._weights }; }

  setWeights(newWeights) {
    this._weights = { ...newWeights };
  }

  // ─── POST COOLDOWNS ───────────────────────────────────────────────────────
  canPost(platform) {
    const last = this._postCooldowns.get(platform) || 0;
    return Date.now() - last >= CONFIG.DISTRIBUTION.POST_COOLDOWN_MS;
  }

  markPosted(platform) {
    this._postCooldowns.set(platform, Date.now());
  }

  // ─── BASELINES ────────────────────────────────────────────────────────────
  getBaseline(token) {
    return this._baselines.get(token) || { likes: 0, comments: 0, recasts: 0, samples: 0 };
  }

  updateBaseline(token, metrics) {
    const prev = this.getBaseline(token);
    const n = prev.samples + 1;
    this._baselines.set(token, {
      likes:    (prev.likes    * (n - 1) + metrics.likes)    / n,
      comments: (prev.comments * (n - 1) + metrics.comments) / n,
      recasts:  (prev.recasts  * (n - 1) + metrics.recasts)  / n,
      samples: n,
    });
  }

  // ─── SOURCE REPUTATION ───────────────────────────────────────────────────
  logSource(sourceId) {
    const now = Date.now();
    const window = CONFIG.ALPHA_FILTER.VELOCITY_SPIKE_WINDOW_MS;
    const times = (this._sourceLogs.get(sourceId) || []).filter(t => now - t < window);
    times.push(now);
    this._sourceLogs.set(sourceId, times);
    return times.length;
  }

  getSourceFrequency(sourceId) {
    const window = CONFIG.ALPHA_FILTER.VELOCITY_SPIKE_WINDOW_MS;
    const now = Date.now();
    const times = (this._sourceLogs.get(sourceId) || []).filter(t => now - t < window);
    return times.length;
  }

  // ─── GENERIC KV ──────────────────────────────────────────────────────────
  set(key, value) { this._kv.set(key, value); }
  get(key) { return this._kv.get(key); }
  has(key) { return this._kv.has(key); }

  // ─── STATS ───────────────────────────────────────────────────────────────
  stats() {
    const all = this.getAllSignals();
    const executed = all.filter(s => s.action === 'EXECUTE').length;
    const watched  = all.filter(s => s.action === 'WATCH').length;
    const ignored  = all.filter(s => s.action === 'IGNORE').length;
    return {
      totalSignals: all.length,
      executed,
      watched,
      ignored,
      weights: this.getWeights(),
    };
  }
}

// Singleton
export const store = new MemoryStore();
