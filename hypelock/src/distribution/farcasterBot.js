// distribution/farcasterBot.js — HYPELOCK Farcaster Distribution Bot
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { distLog } from '../utils/logger.js';

const { FARCASTER_HUB_URL, FARCASTER_FID, FARCASTER_SIGNER_UUID } = CONFIG.INTEGRATIONS;

/**
 * FarcasterBot
 *
 * Posts signal updates to Farcaster via Neynar API.
 * Emphasizes "early detection" narrative to build builder credibility.
 */
export class FarcasterBot {

  async post(signalResult, cleanSignal) {
    if (!CONFIG.DISTRIBUTION.FARCASTER_ENABLED) {
      return { skipped: true, reason: 'disabled' };
    }

    if (signalResult.score < CONFIG.DISTRIBUTION.MIN_SCORE_TO_DISTRIBUTE) {
      return { skipped: true, reason: 'score_too_low' };
    }

    if (!store.canPost('farcaster')) {
      return { skipped: true, reason: 'cooldown' };
    }

    const text = this._buildCast(signalResult, cleanSignal);
    const result = await this._cast(text);

    if (result.success) {
      store.markPosted('farcaster');
      distLog.info('Farcaster cast published', { hash: result.hash, token: cleanSignal.token });
    }

    return result;
  }

  _buildCast(scoreResult, signal) {
    const token = signal.token || 'TOKEN';
    const score = scoreResult.score.toFixed(0);
    const conf  = (scoreResult.confidence * 100).toFixed(0);
    const plat  = signal.platform?.toUpperCase() || 'MULTI';

    const templates = CAST_TEMPLATES[scoreResult.action] || CAST_TEMPLATES.WATCH;
    const tpl = templates[Math.floor(Math.random() * templates.length)];

    return tpl
      .replace(/{TOKEN}/g, `$${token}`)
      .replace(/{SCORE}/g, score)
      .replace(/{CONFIDENCE}/g, conf)
      .replace(/{PLATFORM}/g, plat);
  }

  async _cast(text) {
    if (!FARCASTER_SIGNER_UUID || !FARCASTER_FID) {
      distLog.info('[DRY-RUN] Would cast to Farcaster:', { text });
      return { success: true, dryRun: true, hash: `dryrun-${Date.now()}` };
    }

    try {
      // Neynar API for publishing casts
      const resp = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key':      CONFIG.INTEGRATIONS.FARCASTER_SIGNER_UUID,
        },
        body: JSON.stringify({
          signer_uuid: FARCASTER_SIGNER_UUID,
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) {
        throw new Error(`Neynar API ${resp.status}: ${await resp.text()}`);
      }

      const data = await resp.json();
      return { success: true, hash: data.cast?.hash };

    } catch (err) {
      distLog.error('Farcaster cast failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

const CAST_TEMPLATES = {
  EXECUTE: [
    `🔴 HYPELOCK early signal:\n\n{TOKEN} just crossed attention threshold.\nScore: {SCORE}/100 | Confidence: {CONFIDENCE}%\nSource: {PLATFORM}\n\nBuilding attention intelligence, one signal at a time. /hypelock`,
    `⚡ Attention spike detected: {TOKEN}\n\nHYPELOCK captured this {CONFIDENCE}% confidence signal from {PLATFORM}.\n\nThis is what early looks like. /hypelock`,
  ],
  WATCH: [
    `👀 HYPELOCK monitoring {TOKEN}\n\nScore: {SCORE}/100. Momentum building on {PLATFORM}.\n\nTracking signal evolution... /hypelock`,
    `📡 {TOKEN} flagged by HYPELOCK.\n\nEarly accumulation phase detected. Score: {SCORE} | {PLATFORM}\n\n/hypelock /solana`,
  ],
  IGNORE: [
    `🤖 HYPELOCK online. Filtering noise.\n\nNo quality signals at this time. The market is quiet — or just hiding it well.\n\n/hypelock`,
  ],
};

export const farcasterBot = new FarcasterBot();
