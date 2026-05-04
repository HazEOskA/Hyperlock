// learning/autoLearningLoop.js — HYPELOCK Self-Improving Learning System
import { outcomeTracker } from './outcomeTracker.js';
import { adaptiveScorer } from '../core/adaptiveScorer.js';
import { store } from '../utils/memoryStore.js';
import { CONFIG } from '../../config.js';
import { learningLog } from '../utils/logger.js';

const L = CONFIG.LEARNING;

/**
 * AutoLearningLoop
 *
 * Runs on a timer. Each cycle:
 *  1. Asks outcomeTracker for all due evaluations
 *  2. Classifies each as SUCCESS or FAILURE
 *  3. Identifies which indicators contributed most to the decision
 *  4. Adjusts scorer weights accordingly
 *  5. Logs the learning cycle stats
 *
 * This creates a closed feedback loop:
 *   Signal → Action → Outcome → Weight Adjustment → Better future scores
 */
export class AutoLearningLoop {
  constructor() {
    this._timer    = null;
    this._running  = false;
    this._cycles   = 0;
    this._stats    = {
      totalEvaluated: 0,
      successes:      0,
      failures:       0,
      weightHistory:  [],
    };
  }

  start() {
    if (this._running) return;
    this._running = true;

    learningLog.info('AutoLearningLoop started', { intervalMs: L.CYCLE_INTERVAL_MS });

    this._timer = setInterval(() => this._runCycle(), L.CYCLE_INTERVAL_MS);

    // Run one cycle immediately
    this._runCycle();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    learningLog.info('AutoLearningLoop stopped', { cycles: this._cycles });
  }

  async _runCycle() {
    this._cycles++;
    learningLog.debug(`Learning cycle #${this._cycles} starting`);

    const evaluated = outcomeTracker.evaluateDue();

    if (evaluated.length === 0) {
      learningLog.debug('No outcomes due for evaluation this cycle');
      return;
    }

    // Separate successes and failures
    const successes = evaluated.filter(e => e.record.outcome?.success);
    const failures  = evaluated.filter(e => !e.record.outcome?.success);

    this._stats.totalEvaluated += evaluated.length;
    this._stats.successes      += successes.length;
    this._stats.failures       += failures.length;

    learningLog.info(`Learning cycle #${this._cycles}`, {
      evaluated: evaluated.length,
      successes: successes.length,
      failures:  failures.length,
    });

    // ── Reinforce successful patterns ──────────────────────────────────────
    for (const { record } of successes) {
      const topIndicators = this._getTopIndicators(record);
      for (const indicator of topIndicators) {
        adaptiveScorer.adjustWeights(indicator, +1);
      }
    }

    // ── Penalize failing patterns ──────────────────────────────────────────
    for (const { record } of failures) {
      // Only penalize if action was EXECUTE or WATCH (not IGNORE/DISCARDED)
      if (record.action === 'IGNORE' || record.action === 'DISCARDED') continue;

      const topIndicators = this._getTopIndicators(record);
      for (const indicator of topIndicators) {
        adaptiveScorer.adjustWeights(indicator, -1);
      }
    }

    // ── Log weight snapshot ─────────────────────────────────────────────────
    const currentWeights = store.getWeights();
    this._stats.weightHistory.push({
      cycle:    this._cycles,
      time:     Date.now(),
      weights:  { ...currentWeights },
      accuracy: this._computeAccuracy(),
    });

    // Keep weight history bounded
    if (this._stats.weightHistory.length > 100) {
      this._stats.weightHistory.shift();
    }

    learningLog.info('Weights after learning', currentWeights);
  }

  /**
   * Returns the top-contributing indicators from a scored signal's breakdown.
   * These are the ones to reinforce or penalize.
   */
  _getTopIndicators(record) {
    if (!record.breakdown) return [];

    const sorted = Object.entries(record.breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3) // top 3 contributors
      .map(([key]) => key);

    return sorted;
  }

  /**
   * Simple accuracy proxy: % of EXECUTE signals that resulted in success.
   */
  _computeAccuracy() {
    const all = store.getAllSignals();
    const executeSignals = all.filter(s => s.action === 'EXECUTE' && s.outcome !== null);
    if (executeSignals.length === 0) return null;

    const successful = executeSignals.filter(s => s.outcome?.success).length;
    return parseFloat((successful / executeSignals.length).toFixed(4));
  }

  getStatus() {
    return {
      running:      this._running,
      cycles:       this._cycles,
      pending:      outcomeTracker.pendingCount(),
      currentWeights: store.getWeights(),
      accuracy:     this._computeAccuracy(),
      stats:        {
        totalEvaluated: this._stats.totalEvaluated,
        successes:      this._stats.successes,
        failures:       this._stats.failures,
      },
      recentWeightHistory: this._stats.weightHistory.slice(-5),
    };
  }
}

export const autoLearningLoop = new AutoLearningLoop();
