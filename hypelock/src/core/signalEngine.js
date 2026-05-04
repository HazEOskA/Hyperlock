// core/signalEngine.js — HYPELOCK Signal Processing Orchestrator
import { v4 as uuidv4 } from 'uuid';
import { alphaFilter } from './alphaFilter.js';
import { adaptiveScorer } from './adaptiveScorer.js';
import { outcomeTracker } from '../learning/outcomeTracker.js';
import { store } from '../utils/memoryStore.js';
import { signalLog } from '../utils/logger.js';

/**
 * SignalEngine
 *
 * Orchestrates the full signal pipeline:
 *   Raw Signal → AlphaFilter → AdaptiveScorer → Decision → Store → Return
 *
 * Does NOT handle execution or distribution — that happens downstream.
 */
export class SignalEngine {

  /**
   * Process a single raw signal through the full pipeline.
   * @param {Object} rawSignal — signal from any integration
   * @returns {Object} result with action, score, id
   */
  async process(rawSignal) {
    const signalId = rawSignal.id || uuidv4();
    const signal   = { ...rawSignal, id: signalId };

    signalLog.info('Processing signal', { id: signalId, platform: signal.platform, token: signal.token });

    // ── Step 1: Alpha Filter ────────────────────────────────────────────────
    const filterResult = alphaFilter.evaluate(signal);

    if (!filterResult.isValid) {
      // Track discarded signal for learning
      const discardedRecord = {
        id:         signalId,
        signal,
        noiseScore: filterResult.noiseScore,
        reasons:    filterResult.reasons,
        score:      0,
        confidence: 0,
        action:     'DISCARDED',
        timestamp:  Date.now(),
        outcome:    null,
      };
      store.storeSignal(signalId, discardedRecord);
      outcomeTracker.register(discardedRecord);

      return {
        id:      signalId,
        action:  'DISCARDED',
        score:   0,
        noiseScore: filterResult.noiseScore,
        reasons: filterResult.reasons,
      };
    }

    const cleanSignal = filterResult.filteredSignal;

    // ── Step 2: Adaptive Scoring ─────────────────────────────────────────────
    const scoringResult = adaptiveScorer.score(cleanSignal);

    // ── Step 3: Build full record ─────────────────────────────────────────────
    const record = {
      id:         signalId,
      signal:     cleanSignal,
      noiseScore: filterResult.noiseScore,
      score:      scoringResult.score,
      confidence: scoringResult.confidence,
      action:     scoringResult.action,
      breakdown:  scoringResult.breakdown,
      weights:    scoringResult.weights,
      timestamp:  Date.now(),
      outcome:    null, // filled later by outcomeTracker
    };

    // ── Step 4: Store ─────────────────────────────────────────────────────────
    store.storeSignal(signalId, record);
    outcomeTracker.register(record);

    signalLog.info('Signal processed', {
      id:         signalId,
      action:     record.action,
      score:      record.score,
      confidence: record.confidence,
    });

    return {
      id:         signalId,
      action:     record.action,
      score:      record.score,
      confidence: record.confidence,
      breakdown:  record.breakdown,
      noiseScore: filterResult.noiseScore,
    };
  }

  /**
   * Process multiple signals in parallel.
   * @param {Object[]} rawSignals
   */
  async processBatch(rawSignals) {
    return Promise.all(rawSignals.map(s => this.process(s)));
  }
}

export const signalEngine = new SignalEngine();
