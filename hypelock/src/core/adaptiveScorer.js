// core/adaptiveScorer.js — HYPELOCK Adaptive Scoring Engine
import { CONFIG, EXECUTE_ACTIONS } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { scorerLog } from '../utils/logger.js';

const SC = CONFIG.SCORER;

/**
 * AdaptiveScorer
 *
 * Scores cleaned signals using dynamically adjusted weights.
 * Weights shift over time based on outcomes tracked by the Learning Loop.
 *
 * Output:
 * {
 *   score: number (0–100),
 *   confidence: number (0–1),
 *   action: "EXECUTE" | "WATCH" | "IGNORE",
 *   breakdown: { [indicator]: weightedScore }
 * }
 */
export class AdaptiveScorer {

  score(signal) {
    const weights = store.getWeights();

    // ── Raw metric extraction ────────────────────────────────────────────────
    const { likes = 0, comments = 0, recasts = 0 } = signal.metrics || {};
    const velocity         = signal.velocity || 0;
    const walletQuality    = this._scoreWalletQuality(signal.walletData || {});
    const acceleration     = this._computeAcceleration(signal);

    // ── Normalize each indicator to [0, 1] ───────────────────────────────────
    const normalized = {
      likes:                 this._normalize(likes,       0, 5000),
      comments:              this._normalize(comments,    0, 1000),
      recasts:               this._normalize(recasts,     0, 2000),
      velocity:              this._normalize(velocity,    0, 100),
      walletQuality:         walletQuality,               // already [0,1]
      engagementAcceleration: this._normalize(acceleration, 0, 10),
    };

    // ── Apply dynamic weights ────────────────────────────────────────────────
    let rawScore = 0;
    const breakdown = {};
    for (const [key, normVal] of Object.entries(normalized)) {
      const w = weights[key] ?? SC.DEFAULT_WEIGHTS[key] ?? 0;
      const contrib = normVal * w * 100;
      breakdown[key] = parseFloat(contrib.toFixed(2));
      rawScore += contrib;
    }

    // Normalize total weight (weights may not sum to exactly 1 after adjustments)
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const score = Math.min(100, rawScore / totalWeight);

    // ── Confidence calculation ────────────────────────────────────────────────
    const confidence = this._computeConfidence(signal, score, weights);

    // ── Decision ─────────────────────────────────────────────────────────────
    const action = this._decide(score, confidence);

    scorerLog.info('Signal scored', {
      id:         signal.id,
      token:      signal.token,
      score:      score.toFixed(2),
      confidence: confidence.toFixed(3),
      action,
    });

    return {
      score:      parseFloat(score.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(3)),
      action,
      breakdown,
      weights:    { ...weights },
    };
  }

  // ── WALLET QUALITY SCORER ──────────────────────────────────────────────────
  _scoreWalletQuality(walletData) {
    if (!walletData || Object.keys(walletData).length === 0) return 0.3; // neutral default

    let score = 0;

    // Age of wallet (older = more trustworthy)
    if (walletData.ageDays > 365) score += 0.3;
    else if (walletData.ageDays > 90) score += 0.15;

    // Transaction count (active wallets = real users)
    if (walletData.txCount > 500) score += 0.25;
    else if (walletData.txCount > 100) score += 0.15;
    else if (walletData.txCount > 20)  score += 0.05;

    // Balance (non-trivial holdings = skin in the game)
    if (walletData.balanceUSD > 10000) score += 0.25;
    else if (walletData.balanceUSD > 1000) score += 0.15;
    else if (walletData.balanceUSD > 100)  score += 0.05;

    // Protocol diversity (DeFi users = sophisticated)
    if (walletData.protocolCount > 10) score += 0.20;
    else if (walletData.protocolCount > 3) score += 0.10;

    return Math.min(1, score);
  }

  // ── ENGAGEMENT ACCELERATION ────────────────────────────────────────────────
  // Measures how fast engagement is growing relative to baseline
  _computeAcceleration(signal) {
    const token = signal.token;
    if (!token) return 0;

    const baseline = store.getBaseline(token);
    if (baseline.samples < 2) return 0;

    const { likes = 0, recasts = 0 } = signal.metrics || {};
    const current  = likes + recasts;
    const expected = baseline.likes + baseline.recasts;

    if (expected === 0) return 0;
    const ratio = current / expected;

    // Acceleration = how much above baseline, capped at 10x
    return Math.min(10, Math.max(0, ratio - 1));
  }

  // ── NORMALIZATION ──────────────────────────────────────────────────────────
  _normalize(value, min, max) {
    if (max === min) return 0;
    // Log-scale normalization for engagement metrics (diminishing returns)
    const logVal  = Math.log1p(Math.max(0, value - min));
    const logMax  = Math.log1p(max - min);
    return Math.min(1, logVal / logMax);
  }

  // ── CONFIDENCE ────────────────────────────────────────────────────────────
  _computeConfidence(signal, score, weights) {
    let confidence = 1.0;

    // Penalize if baseline data is thin
    const baseline = store.getBaseline(signal.token || '');
    if (baseline.samples < 5) {
      confidence *= SC.CONFIDENCE_DECAY_FACTOR;
    }
    if (baseline.samples < 2) {
      confidence *= SC.CONFIDENCE_DECAY_FACTOR;
    }

    // Penalize if wallet data is missing
    if (!signal.walletData || Object.keys(signal.walletData).length === 0) {
      confidence *= 0.9;
    }

    // Weight variance — if weights are highly uneven, confidence drops slightly
    const weightValues = Object.values(weights);
    const mean = weightValues.reduce((a, b) => a + b, 0) / weightValues.length;
    const variance = weightValues.reduce((sum, w) => sum + (w - mean) ** 2, 0) / weightValues.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0.15) confidence *= 0.92;

    // Extreme scores (very high or very low) = higher confidence
    const extremity = Math.abs(score - 50) / 50;
    confidence = confidence * (0.85 + 0.15 * extremity);

    return Math.min(1, Math.max(0, confidence));
  }

  // ── DECISION LOGIC ────────────────────────────────────────────────────────
  _decide(score, confidence) {
    // Require minimum confidence for EXECUTE
    const effectiveScore = score * (0.5 + 0.5 * confidence);

    if (effectiveScore >= SC.EXECUTE_THRESHOLD) return EXECUTE_ACTIONS.EXECUTE;
    if (effectiveScore >= SC.WATCH_THRESHOLD)   return EXECUTE_ACTIONS.WATCH;
    return EXECUTE_ACTIONS.IGNORE;
  }

  // ── WEIGHT ADJUSTMENT (called by Learning Loop) ───────────────────────────
  adjustWeights(indicator, direction) {
    // direction: +1 (reinforce) or -1 (penalize)
    const current = store.getWeights();
    const rate = SC.WEIGHT_ADJUSTMENT_RATE;

    if (!(indicator in current)) {
      scorerLog.warn(`adjustWeights: unknown indicator "${indicator}"`);
      return;
    }

    const delta = direction * rate * current[indicator];
    const newVal = Math.min(SC.WEIGHT_MAX, Math.max(SC.WEIGHT_MIN, current[indicator] + delta));
    current[indicator] = newVal;

    // Re-normalize so all weights sum to 1
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    const normalized = {};
    for (const [k, v] of Object.entries(current)) {
      normalized[k] = parseFloat((v / total).toFixed(6));
    }

    store.setWeights(normalized);

    scorerLog.debug('Weight adjusted', {
      indicator,
      direction: direction > 0 ? 'UP' : 'DOWN',
      newVal: normalized[indicator],
    });
  }
}

export const adaptiveScorer = new AdaptiveScorer();
