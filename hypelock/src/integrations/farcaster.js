// integrations/farcaster.js — HYPELOCK Farcaster Signal Collector
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { signalLog } from '../utils/logger.js';

const { FARCASTER_HUB_URL } = CONFIG.INTEGRATIONS;

/**
 * FarcasterIntegration
 *
 * Pulls casts from Farcaster Hub and normalizes them into HYPELOCK signal format.
 * Uses Neynar-compatible Hub API. Swap base URL for other providers.
 */
export class FarcasterIntegration {

  constructor() {
    this._lastCursor = null;
    this._knownIds   = new Set(); // prevent duplicate signals
  }

  /**
   * Fetch recent trending casts and convert to HYPELOCK signals.
   * @param {string[]} keywords — tokens/keywords to watch
   * @returns {Promise<Object[]>} normalized signals
   */
  async fetchSignals(keywords = []) {
    const signals = [];

    for (const keyword of keywords) {
      try {
        const casts = await this._searchCasts(keyword);
        for (const cast of casts) {
          if (this._knownIds.has(cast.hash)) continue;
          this._knownIds.add(cast.hash);

          const signal = this._normalize(cast, keyword);
          signals.push(signal);
        }
      } catch (err) {
        signalLog.error('Farcaster fetch error', { keyword, error: err.message });
      }
    }

    signalLog.debug(`Farcaster: collected ${signals.length} signals`);
    return signals;
  }

  async _searchCasts(keyword) {
    const url = `${FARCASTER_HUB_URL}/v1/casts/search?q=${encodeURIComponent(keyword)}&limit=20`;
    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      throw new Error(`Farcaster API ${resp.status}`);
    }

    const data = await resp.json();
    return data.casts || data.result?.casts || [];
  }

  _normalize(cast, token) {
    const reactions = cast.reactions || {};
    const author    = cast.author || {};

    return {
      id:        `fc-${cast.hash || cast.castAddBody?.targetCastId?.hash || Date.now()}`,
      platform:  'farcaster',
      token:     token.toUpperCase(),
      text:      cast.text || cast.castAddBody?.text || '',
      authorId:  String(author.fid || author.custodyAddress || 'unknown'),
      authorFollowers: author.followerCount || 0,
      authorAgeDays:   this._estimateAgeDays(author.profileCreatedAt),
      metrics: {
        likes:    reactions.likesCount    || reactions.likes?.length    || 0,
        comments: cast.repliesCount       || cast.replies?.count        || 0,
        recasts:  reactions.recastsCount  || reactions.recasts?.length  || 0,
      },
      velocity:   this._computeVelocity(cast),
      walletData: this._extractWallet(author),
      timestamp:  cast.timestamp ? new Date(cast.timestamp).getTime() : Date.now(),
      raw:        cast,
    };
  }

  _computeVelocity(cast) {
    const age = Date.now() - new Date(cast.timestamp || Date.now()).getTime();
    const ageHours = Math.max(0.1, age / 3_600_000);
    const total = (cast.reactions?.likesCount || 0) +
                  (cast.reactions?.recastsCount || 0) +
                  (cast.repliesCount || 0);
    return parseFloat((total / ageHours).toFixed(2));
  }

  _extractWallet(author) {
    if (!author.verifiedAddresses?.ethAddresses?.length) return {};
    return {
      address: author.verifiedAddresses.ethAddresses[0],
      // balance/txCount would require on-chain lookup (Alchemy, Moralis)
    };
  }

  _estimateAgeDays(createdAt) {
    if (!createdAt) return 30; // default assumption
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  }

  // Cleanup old known IDs to prevent memory leak
  pruneKnownIds(maxSize = 5000) {
    if (this._knownIds.size > maxSize) {
      const arr = Array.from(this._knownIds);
      this._knownIds = new Set(arr.slice(-maxSize));
    }
  }
}

export const farcasterIntegration = new FarcasterIntegration();
