// distribution/xBot.js — HYPELOCK X Distribution Bot
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { distLog } from '../utils/logger.js';

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = CONFIG.INTEGRATIONS;
const X_API_BASE = 'https://api.twitter.com/2';

/**
 * XBot
 *
 * Posts signal insights to X (Twitter).
 * Uses OAuth 1.0a for write access (v2 tweets endpoint).
 *
 * Templates rotate based on signal type to avoid repetitive posting.
 */
export class XBot {

  constructor() {
    this._templates = TWEET_TEMPLATES;
    this._postedIds = new Set();
  }

  /**
   * Post a signal alert to X.
   * Respects cooldown. Returns post result.
   */
  async post(signalResult, cleanSignal) {
    if (!CONFIG.DISTRIBUTION.X_ENABLED) {
      distLog.debug('X distribution disabled, skipping');
      return { skipped: true, reason: 'disabled' };
    }

    if (signalResult.score < CONFIG.DISTRIBUTION.MIN_SCORE_TO_DISTRIBUTE) {
      return { skipped: true, reason: 'score_too_low' };
    }

    if (!store.canPost('x')) {
      return { skipped: true, reason: 'cooldown' };
    }

    const text = this._buildTweet(signalResult, cleanSignal);
    const result = await this._tweet(text);

    if (result.success) {
      store.markPosted('x');
      distLog.info('X post published', { tweetId: result.id, token: cleanSignal.token });
    }

    return result;
  }

  _buildTweet(scoreResult, signal) {
    const template = this._pickTemplate(scoreResult);
    const token    = signal.token || 'TOKEN';
    const score    = scoreResult.score.toFixed(0);
    const action   = scoreResult.action;
    const platform = signal.platform?.toUpperCase() || 'SOCIAL';
    const conf     = (scoreResult.confidence * 100).toFixed(0);

    return template
      .replace('{TOKEN}', `$${token}`)
      .replace('{SCORE}', score)
      .replace('{ACTION}', action)
      .replace('{PLATFORM}', platform)
      .replace('{CONFIDENCE}', conf);
  }

  _pickTemplate(scoreResult) {
    const templates = this._templates[scoreResult.action] || this._templates['WATCH'];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ── OAuth 1.0a signed request (X v2 tweets) ───────────────────────────────
  async _tweet(text) {
    if (!X_API_KEY || !X_ACCESS_TOKEN) {
      distLog.warn('X bot: missing OAuth credentials, running in dry-run mode');
      distLog.info('[DRY-RUN] Would tweet:', { text });
      return { success: true, dryRun: true, id: `dryrun-${Date.now()}` };
    }

    try {
      // For full OAuth 1.0a signing, use a library like oauth-1.0a in production.
      // Here we demonstrate the fetch structure — add signing middleware in deployment.
      const resp = await fetch(`${X_API_BASE}/tweets`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': this._buildOAuthHeader('POST', `${X_API_BASE}/tweets`),
        },
        body:   JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`X API ${resp.status}: ${err}`);
      }

      const data = await resp.json();
      return { success: true, id: data.data?.id };

    } catch (err) {
      distLog.error('X post failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  // Placeholder — implement full OAuth 1.0a in production (use oauth-1.0a package)
  _buildOAuthHeader(method, url) {
    return `OAuth oauth_consumer_key="${X_API_KEY}", oauth_token="${X_ACCESS_TOKEN}"`;
  }
}

// ── TWEET TEMPLATES ──────────────────────────────────────────────────────────
const TWEET_TEMPLATES = {
  EXECUTE: [
    `🔴 HYPELOCK ALPHA DETECTED\n\n$${'{TOKEN}'} hype score: {SCORE}/100\nConfidence: {CONFIDENCE}%\nSource: {PLATFORM}\n\nSignal quality: EXECUTE\n\n#crypto #alpha #hypelock`,
    `⚡ HIGH SIGNAL: {TOKEN}\n\nHYPELOCK detected unusual attention patterns.\nScore: {SCORE} | Confidence: {CONFIDENCE}%\n\nEarly signal captured from {PLATFORM}.\n\n#solana #alpha`,
    `🎯 HYPELOCK ALERT\n\nToken: {TOKEN}\nSignal Strength: {SCORE}/100\nPlatform: {PLATFORM}\n\nThis is not financial advice. DYOR.\n\n#web3 #crypto #hypelock`,
  ],
  WATCH: [
    `👀 HYPELOCK WATCHING\n\n{TOKEN} entering hype accumulation phase.\nScore: {SCORE}/100 | Building momentum on {PLATFORM}\n\nTracking...\n\n#crypto #web3`,
    `📡 Signal detected: {TOKEN}\n\nHYPELOCK flagged early momentum on {PLATFORM}.\nScore: {SCORE} | Status: MONITORING\n\n#solana #alpha #hypelock`,
  ],
  IGNORE: [
    `🤖 HYPELOCK scan complete.\n\nLow signal environment detected.\nFiltering noise. Waiting for quality signals.\n\n#hypelock #crypto`,
  ],
};

export const xBot = new XBot();
