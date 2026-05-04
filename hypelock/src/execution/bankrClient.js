// execution/bankrClient.js — HYPELOCK Bankr API Wrapper (Pure Executor)
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { execLog } from '../utils/logger.js';

const { BANKR_API_KEY, BANKR_API_URL } = CONFIG.INTEGRATIONS;

/**
 * BankrClient
 *
 * Pure executor — no decision logic here.
 * All logic lives in executeDecision.js.
 * This module only handles HTTP communication with Bankr API.
 */
export class BankrClient {

  constructor() {
    this._headers = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BANKR_API_KEY}`,
      'X-Client':      'HYPELOCK/1.0',
    };
  }

  /**
   * Send a trade order to Bankr.
   * @param {Object} order
   * @param {string} order.token       — token address or ticker
   * @param {string} order.side        — 'BUY' | 'SELL'
   * @param {number} order.amount      — amount in USD or base token
   * @param {number} order.slippage    — slippage tolerance (0.01 = 1%)
   * @param {Object} order.meta        — optional metadata (signal id, score, etc.)
   * @returns {Promise<Object>} Bankr API response
   */
  async sendOrder(order) {
    execLog.info('Sending order to Bankr', {
      token:  order.token,
      side:   order.side,
      amount: order.amount,
    });

    try {
      const response = await fetch(`${BANKR_API_URL}/orders`, {
        method:  'POST',
        headers: this._headers,
        body:    JSON.stringify({
          token:    order.token,
          side:     order.side,
          amount:   order.amount,
          slippage: order.slippage ?? 0.01,
          metadata: order.meta || {},
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new BankrError(`HTTP ${response.status}: ${errorBody}`, response.status);
      }

      const result = await response.json();

      execLog.info('Order accepted by Bankr', {
        orderId: result.orderId,
        status:  result.status,
        token:   order.token,
      });

      return { success: true, orderId: result.orderId, raw: result };

    } catch (err) {
      if (err instanceof BankrError) {
        execLog.error('Bankr API error', { code: err.code, message: err.message });
        return { success: false, error: err.message, code: err.code };
      }

      execLog.error('Network error calling Bankr', { message: err.message });
      return { success: false, error: err.message, code: 'NETWORK_ERROR' };
    }
  }

  /**
   * Get status of an existing order.
   */
  async getOrderStatus(orderId) {
    try {
      const response = await fetch(`${BANKR_API_URL}/orders/${orderId}`, {
        method:  'GET',
        headers: this._headers,
      });

      if (!response.ok) {
        throw new BankrError(`HTTP ${response.status}`, response.status);
      }

      return await response.json();
    } catch (err) {
      execLog.error('Failed to get order status', { orderId, error: err.message });
      return null;
    }
  }

  /**
   * Health check against Bankr API.
   */
  async ping() {
    try {
      const response = await fetch(`${BANKR_API_URL}/health`, {
        method:  'GET',
        headers: this._headers,
        signal:  AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

class BankrError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'BankrError';
  }
}

export const bankrClient = new BankrClient();
