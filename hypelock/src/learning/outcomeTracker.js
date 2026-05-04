// learning/outcomeTracker.js — HYPELOCK Outcome Tracking System
import { store } from '../utils/memoryStore.js';
import { CONFIG } from '../../config.js';
import { learningLog } from '../utils/logger.js';

const L = CONFIG.LEARNING;

/**
 * OutcomeTracker
 *
 * Logs every processed signal and later evaluates outcomes.
 * Outcome evaluation is time-windowed (1h, 24h).
 *
 * Stored record format:
 * {
 *   id, signal, score, confidence, action, timestamp,
 *   outcome: {
 *     evaluatedAt: number,
 *     window: '1h'|'24h',
 *     engagementRatio: number,
 *     success: boolean,
 *     profit: number|null
 *   }
 * }
 */
export class OutcomeTracker {
  constructor() {
    // Pending evaluations: [{ id, signalId, evaluateAt, window }]
    this._pending = [];
  }

  /**
   * Register a new signal for future outcome evaluation.
   */
  register(record) {
    const now = Date.now();

    for (const windowMs of L.EVALUATION_WINDOWS_MS) {
      this._pending.push({
        signalId:   record.id,
        evaluateAt: now + windowMs,
        window:     this._windowLabel(windowMs),
        token:      record.signal?.token || null,
        initialMetrics: record.signal?.metrics || {},
      });
    }
  }

  /**
   * Called by the learning loop on each cycle.
   * Evaluates all due pending outcomes.
   * Returns list of evaluated outcomes.
   */
  evaluateDue() {
    const now = Date.now();
    const due = this._pending.filter(p => p.evaluateAt <= now);
    this._pending = this._pending.filter(p => p.evaluateAt > now);

    const results = [];

    for (const pending of due) {
      const record = store.getSignal(pending.signalId);
      if (!record) continue;

      const outcome = this._evaluateOutcome(record, pending);
      store.updateSignal(pending.signalId, { outcome });

      learningLog.info('Outcome evaluated', {
        id:     pending.signalId,
        window: pending.window,
        success: outcome.success,
        engagementRatio: outcome.engagementRatio?.toFixed(2),
      });

      results.push({ record: { ...record, outcome }, pending });
    }

    return results;
  }

  /**
   * Evaluate outcome for a given signal.
   * In a real system: fetch current on-chain data, current social metrics.
   * Here: use current store baseline vs initial metrics as proxy.
   */
  _evaluateOutcome(record, pending) {
    const token = pending.token;
    const initial = pending.initialMetrics;

    // Get current engagement baseline
    const current = store.getBaseline(token || '') || {};

    // Engagement ratio proxy: did this token get more attention after signal?
    const initialTotal  = (initial.likes || 0) + (initial.recasts || 0) + (initial.comments || 0);
    const currentTotal  = (current.likes  || 0) + (current.recasts  || 0) + 0;
    const engagementRatio = initialTotal > 0
      ? currentTotal / initialTotal
      : 1.0;

    const success = engagementRatio >= L.SUCCESS_ENGAGEMENT_THRESHOLD;

    return {
      evaluatedAt:     Date.now(),
      window:          pending.window,
      engagementRatio: parseFloat(engagementRatio.toFixed(4)),
      success,
      profit:          null, // filled by Bankr integration when available
    };
  }

  pendingCount() { return this._pending.length; }

  _windowLabel(ms) {
    if (ms <= 3_600_000)  return '1h';
    if (ms <= 86_400_000) return '24h';
    return `${Math.round(ms / 3_600_000)}h`;
  }

  /**
   * Serialize pending queue (for graceful shutdown / persistence).
   */
  serialize() {
    return JSON.stringify(this._pending);
  }

  restore(json) {
    try {
      this._pending = JSON.parse(json);
      learningLog.info(`Restored ${this._pending.length} pending evaluations`);
    } catch (e) {
      learningLog.error('Failed to restore outcome tracker state', { error: e.message });
    }
  }
}

export const outcomeTracker = new OutcomeTracker();
