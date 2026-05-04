// execution/executeDecision.js — HYPELOCK Execution Decision Gate
import { bankrClient } from './bankrClient.js';
import { CONFIG } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { execLog } from '../utils/logger.js';

const PAPER_MODE = CONFIG.PAPER_MODE;

/**
 * ExecuteDecision
 *
 * Single responsibility: receive a scored+decided signal and act on it.
 *
 * Rules:
 * - NEVER call Bankr unless action === 'EXECUTE'
 * - If PAPER_MODE → simulate and log, no real calls
 * - If !PAPER_MODE → execute via BankrClient
 *
 * Returns execution result for downstream (distribution, outcome logging).
 */
export class ExecuteDecision {

  constructor() {
    this._simulatedOrders = []; // paper mode log
    this._executions      = []; // real execution log
  }

  /**
   * Main entry point.
   * @param {Object} scoreResult  — output from signalEngine.process()
   * @param {Object} signal       — the cleaned signal (for token, context)
   * @returns {Promise<Object>} execution result
   */
  async execute(scoreResult, signal) {
    const { action, score, confidence } = scoreResult;

    // Gate: only EXECUTE action triggers trading
    if (action !== 'EXECUTE') {
      execLog.debug('No execution — action is not EXECUTE', { action, id: signal.id });
      return { executed: false, action, reason: `action_is_${action}` };
    }

    const order = this._buildOrder(signal, scoreResult);

    if (PAPER_MODE) {
      return this._simulateExecution(order, scoreResult);
    }

    return this._realExecution(order, scoreResult);
  }

  // ── PAPER MODE ────────────────────────────────────────────────────────────
  _simulateExecution(order, scoreResult) {
    const sim = {
      executed:   true,
      simulated:  true,
      paper:      true,
      orderId:    `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order,
      score:      scoreResult.score,
      confidence: scoreResult.confidence,
      timestamp:  Date.now(),
      estimatedPnl: this._estimatePnl(order),
    };

    this._simulatedOrders.push(sim);

    execLog.info('📄 PAPER TRADE executed', {
      orderId:    sim.orderId,
      token:      order.token,
      side:       order.side,
      amount:     order.amount,
      score:      scoreResult.score,
      confidence: scoreResult.confidence,
    });

    return sim;
  }

  // ── REAL EXECUTION ────────────────────────────────────────────────────────
  async _realExecution(order, scoreResult) {
    execLog.warn('🔴 REAL EXECUTION triggered', {
      token:  order.token,
      side:   order.side,
      amount: order.amount,
      score:  scoreResult.score,
    });

    const result = await bankrClient.sendOrder(order);

    const execRecord = {
      executed:   true,
      simulated:  false,
      paper:      false,
      orderId:    result.orderId || null,
      success:    result.success,
      error:      result.error || null,
      order,
      score:      scoreResult.score,
      confidence: scoreResult.confidence,
      timestamp:  Date.now(),
    };

    this._executions.push(execRecord);

    if (result.success) {
      execLog.info('✅ Order filled', { orderId: result.orderId, token: order.token });
    } else {
      execLog.error('❌ Order failed', { error: result.error, token: order.token });
    }

    return execRecord;
  }

  // ── ORDER BUILDER ─────────────────────────────────────────────────────────
  _buildOrder(signal, scoreResult) {
    // Size scaling: higher score/confidence = larger position
    const baseAmount    = 10; // USD base
    const scoreMultiplier = Math.min(5, scoreResult.score / 20); // 1–5x
    const amount        = parseFloat((baseAmount * scoreMultiplier).toFixed(2));

    return {
      token:    signal.token,
      side:     'BUY',         // HYPELOCK is a momentum long system
      amount,
      slippage: 0.02,          // 2% slippage tolerance
      meta: {
        signalId:   signal.id,
        platform:   signal.platform,
        score:      scoreResult.score,
        confidence: scoreResult.confidence,
        source:     'HYPELOCK',
      },
    };
  }

  // ── PnL ESTIMATION (paper mode only) ────────────────────────────────────
  _estimatePnl(order) {
    // Simplified: assume 5–20% move based on score
    const baseReturn = 0.05 + Math.random() * 0.15;
    return parseFloat((order.amount * baseReturn).toFixed(4));
  }

  // ── STATS ────────────────────────────────────────────────────────────────
  getStats() {
    const simTotal = this._simulatedOrders.reduce((sum, o) => sum + (o.estimatedPnl || 0), 0);
    return {
      paperMode:         PAPER_MODE,
      simulatedOrders:   this._simulatedOrders.length,
      realOrders:        this._executions.length,
      successfulOrders:  this._executions.filter(e => e.success).length,
      estimatedPaperPnl: parseFloat(simTotal.toFixed(4)),
      recentSimulated:   this._simulatedOrders.slice(-5),
      recentReal:        this._executions.slice(-5),
    };
  }
}

export const executeDecision = new ExecuteDecision();
