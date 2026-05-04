// distribution/zoraPublisher.js — HYPELOCK Zora Narrative Publisher
import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';
import { store } from '../utils/memoryStore.js';
import { distLog } from '../utils/logger.js';

const { ZORA_API_KEY, ZORA_WALLET_ADDRESS } = CONFIG.INTEGRATIONS;

/**
 * ZoraPublisher
 *
 * Publishes signal outputs as "attention artifacts" on Zora.
 * Creates market perception loops by making signal data mintable.
 *
 * In practice: uses Zora's API to create 1155 editions.
 * Each EXECUTE signal can become a collectible artifact.
 */
export class ZoraPublisher {

  async publish(signalResult, cleanSignal) {
    if (!CONFIG.DISTRIBUTION.ZORA_ENABLED) {
      return { skipped: true, reason: 'disabled' };
    }

    // Only publish EXECUTE-grade signals as artifacts
    if (signalResult.action !== 'EXECUTE') {
      return { skipped: true, reason: 'not_execute_grade' };
    }

    if (!store.canPost('zora')) {
      return { skipped: true, reason: 'cooldown' };
    }

    const artifact = this._buildArtifact(signalResult, cleanSignal);
    const result   = await this._mintArtifact(artifact);

    if (result.success) {
      store.markPosted('zora');
      distLog.info('Zora artifact published', { token: cleanSignal.token, contractAddress: result.contractAddress });
    }

    return result;
  }

  _buildArtifact(scoreResult, signal) {
    const token     = signal.token || 'UNKNOWN';
    const score     = scoreResult.score.toFixed(0);
    const timestamp = new Date().toISOString();

    return {
      name:        `HYPELOCK Signal #${Date.now()} — $${token}`,
      description: this._buildNarrative(scoreResult, signal),
      image:       this._buildSVGDataUri(token, score),
      attributes: [
        { trait_type: 'Token',      value: token },
        { trait_type: 'Score',      value: score },
        { trait_type: 'Confidence', value: (scoreResult.confidence * 100).toFixed(0) + '%' },
        { trait_type: 'Platform',   value: signal.platform || 'multi' },
        { trait_type: 'Action',     value: scoreResult.action },
        { trait_type: 'Captured',   value: timestamp },
      ],
      token,
      score,
      timestamp,
    };
  }

  _buildNarrative(scoreResult, signal) {
    return [
      `HYPELOCK Attention Artifact`,
      ``,
      `Token: $${signal.token}`,
      `Attention Score: ${scoreResult.score.toFixed(0)}/100`,
      `Confidence: ${(scoreResult.confidence * 100).toFixed(0)}%`,
      `Source: ${signal.platform?.toUpperCase()}`,
      `Captured: ${new Date().toISOString()}`,
      ``,
      `This artifact represents a verified attention signal captured by HYPELOCK,`,
      `an AI-driven crypto attention intelligence system.`,
      ``,
      `HYPELOCK | Attention is the alpha.`,
    ].join('\n');
  }

  // Generate on-chain-friendly SVG artifact image
  _buildSVGDataUri(token, score) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#0a0a0a"/>
      <text x="200" y="120" font-family="monospace" font-size="14" fill="#00ff88" text-anchor="middle">HYPELOCK SIGNAL</text>
      <text x="200" y="200" font-family="monospace" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">$${token}</text>
      <text x="200" y="260" font-family="monospace" font-size="24" fill="#00ff88" text-anchor="middle">SCORE: ${score}</text>
      <text x="200" y="320" font-family="monospace" font-size="11" fill="#666666" text-anchor="middle">Attention Intelligence System</text>
      <rect x="20" y="20" width="360" height="360" rx="8" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.4"/>
    </svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  async _mintArtifact(artifact) {
    if (!ZORA_API_KEY || !ZORA_WALLET_ADDRESS) {
      distLog.info('[DRY-RUN] Would publish Zora artifact:', {
        name:  artifact.name,
        token: artifact.token,
        score: artifact.score,
      });
      return {
        success:         true,
        dryRun:          true,
        contractAddress: `0xDRYRUN${Date.now()}`,
      };
    }

    try {
      // Zora Create API (v3) — creates a new 1155 edition
      const resp = await fetch('https://api.zora.co/v1/create', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${ZORA_API_KEY}`,
        },
        body: JSON.stringify({
          name:          artifact.name,
          description:   artifact.description,
          image:         artifact.image,
          attributes:    artifact.attributes,
          contractType:  'ERC1155',
          royaltyBPS:    500, // 5%
          creatorAddress: ZORA_WALLET_ADDRESS,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        throw new Error(`Zora API ${resp.status}: ${await resp.text()}`);
      }

      const data = await resp.json();
      return {
        success:         true,
        contractAddress: data.contractAddress || data.address,
        tokenId:         data.tokenId,
      };

    } catch (err) {
      distLog.error('Zora publish failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export const zoraPublisher = new ZoraPublisher();
