// core/alphaFilter.js — HYPELOCK Alpha Filter v2 (Anti-Noise System)
import { CONFIG, SPAM_KEYWORDS } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { filterLog } from '../utils/logger.js';

const AF = CONFIG.ALPHA_FILTER;

/**
 * AlphaFilter v2
 *
 * Runs multi-layer noise detection before any signal reaches the scorer.
 * Each layer contributes to a cumulative noiseScore (0–1).
 * If noiseScore > NOISE_THRESHOLD → signal is discarded.
 *
 * Layers:
 *  1. Bot engagement pattern detection
 *  2. Spam keyword scan
 *  3. Velocity spike detection
 *  4. Source repetition penalty
 *  5. Coordinated manipulation heuristics
 */
export class AlphaFilter {
  constructor() {
    // rolling window: { timestamp, source, token } for coordination detection
    this._recentActions = [];
  }

  /**
   * Main entry point.
   * @param {Object} rawSignal
   * @returns {{ isValid: boolean, filteredSignal: Object|null, noiseScore: number, reasons: string[] }}
   */
  evaluate(rawSignal) {
    const reasons = [];
    let noiseScore = 0;

    // ── Layer 1: Bot engagement pattern ─────────────────────────────────────
    const botScore = this._detectBotPattern(rawSignal);
    if (botScore > 0) {
      noiseScore += botScore;
      if (botScore > 0.3) reasons.push(`bot_pattern:${botScore.toFixed(2)}`);
    }

    // ── Layer 2: Spam keyword detection ─────────────────────────────────────
    const spamScore = this._detectSpam(rawSignal);
    if (spamScore > 0) {
      noiseScore += spamScore;
      reasons.push(`spam:${spamScore.toFixed(2)}`);
    }

    // ── Layer 3: Velocity spike detection ───────────────────────────────────
    const velScore = this._detectVelocitySpike(rawSignal);
    if (velScore > 0) {
      noiseScore += velScore;
      if (velScore > 0.2) reasons.push(`velocity_spike:${velScore.toFixed(2)}`);
    }

    // ── Layer 4: Source repetition penalty ──────────────────────────────────
    const repScore = this._penalizeRepetitiveSources(rawSignal);
    if (repScore > 0) {
      noiseScore += repScore;
      if (repScore > 0.1) reasons.push(`source_repetition:${repScore.toFixed(2)}`);
    }

    // ── Layer 5: Coordinated manipulation heuristics ─────────────────────────
    const coordScore = this._detectCoordination(rawSignal);
    if (coordScore > 0) {
      noiseScore += coordScore;
      if (coordScore > 0.2) reasons.push(`coordination:${coordScore.toFixed(2)}`);
    }

    // Normalize to [0,1]
    noiseScore = Math.min(1, noiseScore);

    const isValid = noiseScore <= AF.NOISE_THRESHOLD;

    // Register source interaction regardless (for learning)
    this._trackAction(rawSignal);

    filterLog.debug('Signal evaluated', {
      id: rawSignal.id,
      noiseScore: noiseScore.toFixed(3),
      isValid,
      reasons,
    });

    if (!isValid) {
      filterLog.info('Signal DISCARDED', { id: rawSignal.id, noiseScore: noiseScore.toFixed(3), reasons });
      return { isValid: false, filteredSignal: null, noiseScore, reasons };
    }

    // Produce cleaned signal
    const filteredSignal = this._cleanSignal(rawSignal);
    return { isValid: true, filteredSignal, noiseScore, reasons };
  }

  // ── LAYER 1: Bot Pattern ──────────────────────────────────────────────────
  _detectBotPattern(signal) {
    const { likes = 0, comments = 0, recasts = 0 } = signal.metrics || {};
    let score = 0;

    // Bot heuristic: very high like-to-comment ratio (bots like but don't comment)
    if (comments > 0) {
      const ratio = likes / comments;
      if (ratio > AF.BOT_ENGAGEMENT_RATIO * 50) score += 0.35;
      else if (ratio > AF.BOT_ENGAGEMENT_RATIO * 20) score += 0.20;
    } else if (likes > 100) {
      // 0 comments with many likes → strong bot signal
      score += 0.40;
    }

    // Perfect round numbers (bot-generated metrics)
    if (likes > 0 && likes % 100 === 0) score += 0.10;
    if (recasts > 0 && recasts % 50 === 0) score += 0.10;

    // Accounts with 0 followers but high engagement
    if (signal.authorFollowers !== undefined && signal.authorFollowers < 10 && likes > 50) {
      score += 0.25;
    }

    // Account age < 7 days with high activity
    if (signal.authorAgeDays !== undefined && signal.authorAgeDays < 7 && likes > 20) {
      score += 0.20;
    }

    return Math.min(0.5, score);
  }

  // ── LAYER 2: Spam Detection ───────────────────────────────────────────────
  _detectSpam(signal) {
    const text = [signal.text, signal.title, signal.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!text) return 0;

    let hits = 0;
    for (const keyword of SPAM_KEYWORDS) {
      if (text.includes(keyword)) hits++;
    }

    // Excessive hashtags
    const hashtagCount = (text.match(/#\w+/g) || []).length;
    if (hashtagCount > 8) hits += 2;

    // All caps ratio
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    if (capsRatio > 0.6 && text.length > 20) hits += 1;

    return Math.min(0.6, hits * AF.SPAM_KEYWORD_WEIGHT);
  }

  // ── LAYER 3: Velocity Spike ───────────────────────────────────────────────
  _detectVelocitySpike(signal) {
    const token = signal.token;
    if (!token) return 0;

    const baseline = store.getBaseline(token);
    if (baseline.samples < 3) return 0; // not enough data yet

    const { likes = 0, recasts = 0 } = signal.metrics || {};
    const avgEngagement = (baseline.likes + baseline.recasts) / 2 || 1;
    const currentEngagement = (likes + recasts) / 2;

    const multiple = currentEngagement / avgEngagement;

    if (multiple > AF.VELOCITY_SPIKE_MULTIPLIER * 2) return 0.35;
    if (multiple > AF.VELOCITY_SPIKE_MULTIPLIER) return 0.20;
    return 0;
  }

  // ── LAYER 4: Source Repetition ────────────────────────────────────────────
  _penalizeRepetitiveSources(signal) {
    if (!signal.sources || !Array.isArray(signal.sources)) return 0;

    let totalPenalty = 0;
    for (const sourceId of signal.sources) {
      const freq = store.logSource(sourceId);
      if (freq > 1) {
        // Escalating penalty for repeat sources
        totalPenalty += AF.SAME_SOURCE_PENALTY * Math.log2(freq);
      }
    }

    return Math.min(0.4, totalPenalty);
  }

  // ── LAYER 5: Coordination Detection ──────────────────────────────────────
  _detectCoordination(signal) {
    const now = Date.now();
    const windowStart = now - AF.COORDINATION_WINDOW_MS;

    // Keep only recent actions
    this._recentActions = this._recentActions.filter(a => a.timestamp >= windowStart);

    const token = signal.token;
    if (!token) return 0;

    // Count actors engaging with this token in the window
    const tokenActions = this._recentActions.filter(a => a.token === token);

    if (tokenActions.length < AF.COORDINATION_MIN_ACTORS) return 0;

    // Check for time clustering — many actions within tight sync window
    let syncClusters = 0;
    for (let i = 0; i < tokenActions.length; i++) {
      const cluster = tokenActions.filter(a =>
        Math.abs(a.timestamp - tokenActions[i].timestamp) <= AF.COORDINATION_SYNC_THRESHOLD_MS
      );
      if (cluster.length >= AF.COORDINATION_MIN_ACTORS) {
        syncClusters++;
      }
    }

    if (syncClusters > 2) return 0.40;
    if (syncClusters > 0) return 0.20;
    return 0;
  }

  _trackAction(signal) {
    if (signal.token) {
      this._recentActions.push({
        timestamp: Date.now(),
        token: signal.token,
        source: signal.authorId || 'unknown',
      });

      // Update baseline (even for noisy signals, helps calibrate)
      store.updateBaseline(signal.token, signal.metrics || {});
    }
  }

  // ── SIGNAL CLEANER ────────────────────────────────────────────────────────
  _cleanSignal(signal) {
    return {
      id:          signal.id,
      platform:    signal.platform,
      token:       signal.token,
      text:        signal.text?.slice(0, 500) || '',
      metrics:     signal.metrics || {},
      authorId:    signal.authorId,
      authorFollowers: signal.authorFollowers,
      walletData:  signal.walletData || {},
      velocity:    signal.velocity || 0,
      timestamp:   signal.timestamp || Date.now(),
    };
  }
}

export const alphaFilter = new AlphaFilter();
