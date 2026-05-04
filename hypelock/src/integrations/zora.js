// integrations/zora.js — HYPELOCK Zora Signal Collector
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { signalLog } from '../utils/logger.js';

const ZORA_GRAPHQL = 'https://api.zora.co/graphql';

/**
 * ZoraIntegration
 *
 * Fetches trending mints and token activity from Zora Protocol.
 * Uses Zora's public GraphQL API.
 */
export class ZoraIntegration {

  constructor() {
    this._knownIds = new Set();
  }

  /**
   * Fetch trending token/mint signals.
   * @returns {Promise<Object[]>} normalized HYPELOCK signals
   */
  async fetchSignals() {
    try {
      const tokens = await this._fetchTrendingTokens();
      const signals = [];

      for (const token of tokens) {
        const id = `zora-${token.address}-${token.chainId}`;
        if (this._knownIds.has(id)) continue;
        this._knownIds.add(id);

        signals.push(this._normalize(token));
      }

      signalLog.debug(`Zora: collected ${signals.length} signals`);
      return signals;
    } catch (err) {
      signalLog.error('Zora fetch error', { error: err.message });
      return [];
    }
  }

  async _fetchTrendingTokens() {
    const query = `
      query TrendingCollections {
        exploreCollections(args: {
          sort: { sortKey: TOP_VOLUME, sortDirection: DESC },
          pagination: { limit: 20 },
          networks: [{ network: ZORA, chain: ZORA_MAINNET }]
        }) {
          nodes {
            address
            chainId
            name
            symbol
            totalMinted
            owners
            salesVolume {
              chainTokenPrice { decimal }
              usdcPrice { decimal }
            }
            mintPrice { ethMintPrice { decimal } }
            createdAt
            description
          }
        }
      }
    `;

    const resp = await fetch(ZORA_GRAPHQL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
      signal:  AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw new Error(`Zora GraphQL ${resp.status}`);
    }

    const data = await resp.json();
    return data?.data?.exploreCollections?.nodes || [];
  }

  _normalize(token) {
    const volume    = parseFloat(token.salesVolume?.usdcPrice?.decimal || '0');
    const mintPrice = parseFloat(token.mintPrice?.ethMintPrice?.decimal || '0');

    return {
      id:        `zora-${token.address}`,
      platform:  'zora',
      token:     token.symbol || token.name?.toUpperCase() || token.address,
      text:      token.description || `${token.name} on Zora`,
      authorId:  token.address,
      authorFollowers: token.owners || 0,
      authorAgeDays:   this._estimateAgeDays(token.createdAt),
      metrics: {
        likes:    token.owners       || 0,
        comments: 0,
        recasts:  token.totalMinted  || 0,
      },
      velocity:   this._computeVelocity(token),
      walletData: {
        balanceUSD: volume,
      },
      mintPrice,
      volume,
      timestamp:  token.createdAt ? new Date(token.createdAt).getTime() : Date.now(),
      raw: {
        address:     token.address,
        name:        token.name,
        totalMinted: token.totalMinted,
        volume,
      },
    };
  }

  _computeVelocity(token) {
    const ageMs = Date.now() - new Date(token.createdAt || Date.now()).getTime();
    const ageHours = Math.max(0.1, ageMs / 3_600_000);
    return parseFloat(((token.totalMinted || 0) / ageHours).toFixed(2));
  }

  _estimateAgeDays(createdAt) {
    if (!createdAt) return 30;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  }

  pruneKnownIds(maxSize = 2000) {
    if (this._knownIds.size > maxSize) {
      const arr = Array.from(this._knownIds);
      this._knownIds = new Set(arr.slice(-maxSize));
    }
  }
}

export const zoraIntegration = new ZoraIntegration();
