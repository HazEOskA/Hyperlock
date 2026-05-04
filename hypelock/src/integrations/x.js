// integrations/x.js — HYPELOCK X (Twitter) Signal Collector
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { signalLog } from '../utils/logger.js';

const { X_BEARER_TOKEN } = CONFIG.INTEGRATIONS;
const X_API_BASE = 'https://api.twitter.com/2';

/**
 * XIntegration
 *
 * Polls X (Twitter) API v2 for relevant crypto signals.
 * Uses Bearer token (App-only auth) for search endpoints.
 */
export class XIntegration {

  constructor() {
    this._knownIds  = new Set();
    this._sinceId   = null; // for incremental polling
  }

  /**
   * Fetch signals for given keywords/tokens.
   * @param {string[]} keywords
   * @returns {Promise<Object[]>} normalized HYPELOCK signals
   */
  async fetchSignals(keywords = []) {
    if (!X_BEARER_TOKEN) {
      signalLog.warn('X integration: no bearer token configured, skipping');
      return [];
    }

    const signals = [];

    for (const keyword of keywords) {
      try {
        const tweets = await this._searchTweets(keyword);
        for (const tweet of tweets) {
          if (this._knownIds.has(tweet.id)) continue;
          this._knownIds.add(tweet.id);
          signals.push(this._normalize(tweet, keyword));
        }
      } catch (err) {
        signalLog.error('X fetch error', { keyword, error: err.message });
      }
    }

    signalLog.debug(`X: collected ${signals.length} signals`);
    return signals;
  }

  async _searchTweets(keyword) {
    const query = encodeURIComponent(
      `${keyword} (crypto OR token OR solana OR eth) -is:retweet lang:en`
    );

    const params = new URLSearchParams({
      query,
      max_results:   '20',
      'tweet.fields': 'public_metrics,created_at,author_id,entities',
      'user.fields':  'public_metrics,created_at,verified',
      expansions:     'author_id',
    });

    if (this._sinceId) {
      params.set('since_id', this._sinceId);
    }

    const url = `${X_API_BASE}/tweets/search/recent?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.status === 429) {
      signalLog.warn('X rate limit hit, backing off');
      return [];
    }

    if (!resp.ok) {
      throw new Error(`X API ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();

    // Track most recent tweet id for next poll
    if (data.meta?.newest_id) {
      this._sinceId = data.meta.newest_id;
    }

    const tweets = data.data || [];
    const usersMap = {};
    for (const user of data.includes?.users || []) {
      usersMap[user.id] = user;
    }

    return tweets.map(t => ({ ...t, _author: usersMap[t.author_id] || {} }));
  }

  _normalize(tweet, token) {
    const m = tweet.public_metrics || {};
    const author = tweet._author || {};
    const authorMetrics = author.public_metrics || {};

    return {
      id:        `x-${tweet.id}`,
      platform:  'x',
      token:     token.toUpperCase(),
      text:      tweet.text || '',
      authorId:  tweet.author_id || 'unknown',
      authorFollowers: authorMetrics.followers_count || 0,
      authorAgeDays:   this._estimateAgeDays(author.created_at),
      metrics: {
        likes:    m.like_count    || 0,
        comments: m.reply_count   || 0,
        recasts:  m.retweet_count || 0,    // retweets as recasts equivalent
        quotes:   m.quote_count   || 0,
      },
      velocity:   this._computeVelocity(tweet, m),
      walletData: {}, // X doesn't expose wallet data
      timestamp:  tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now(),
      raw:        { id: tweet.id, text: tweet.text, metrics: m },
    };
  }

  _computeVelocity(tweet, metrics) {
    const ageMs = Date.now() - new Date(tweet.created_at || Date.now()).getTime();
    const ageHours = Math.max(0.1, ageMs / 3_600_000);
    const total = (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
    return parseFloat((total / ageHours).toFixed(2));
  }

  _estimateAgeDays(createdAt) {
    if (!createdAt) return 30;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  }

  pruneKnownIds(maxSize = 5000) {
    if (this._knownIds.size > maxSize) {
      const arr = Array.from(this._knownIds);
      this._knownIds = new Set(arr.slice(-maxSize));
    }
  }
}

export const xIntegration = new XIntegration();
