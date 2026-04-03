/**
 * HPDL SDK — PIPE, RAG, HEALTH, PRUNE
 * The control layer: u_drift(t) in practice.
 * Version 1.5.37
 *
 * Pipe injection = bounded corrective forcing injected into the system prompt.
 * It acts on system evolution (the AI's next response) without modifying
 * the coherence observable C or the Kalman measurement structure.
 *
 * V1.5.4: buildMuteInjection word limit corrected.
 *   Was: muteMaxTokens / 8 → gave ~15 words on 120-token budget.
 *   Now: Math.round(muteMaxTokens * 0.75) → ~90 words (0.75 words/token).
 *
 * V1.5.3: buildDriftGateInjection now accepts PresetConfig so per-preset
 *   varCaution/varDecoherence/driftGateWordLimit values apply correctly.
 *   computeSessionHealth reads penalty weights from cfg (healthDriftWeight etc).
 */

import {
  VAR_DECOHERENCE, VAR_CAUTION, VAR_CALM, RESONANCE_ANCHOR,
  MUTE_PHRASES, MUTE_MAX_TOKENS, DRIFT_GATE_WORD_LIMIT,
  PRUNE_THRESHOLD, PRUNE_KEEP,
  type PresetConfig,
} from './constants';
import { tokenize, tfidfSimilarity, Message, getTextFromContent } from './coherence';

// ── Pipe injection ──────────────────────────────────────────────

export interface PipeState {
  smoothedVar:   number;
  kalmanX:       number;
  kalmanP:       number;
  calmStreak:    number;
  driftCount:    number;
  harnessMode:   string;
  turn:          number;
  hSignalCount:  number;
  bSignalCount:  number;
  adaptedSigma?: number | null;
}

/**
 * Build the SYSTEM_INTERNAL PIPE injection string.
 * This is u_drift(t) — injected into the system prompt before each API call.
 * No internal USE_PIPING guard — caller is responsible for gating on featPipe.
 */
export function buildPipeInjection(state: PipeState): string {
  if (state.turn < 2) return '';

  const varState = state.smoothedVar > VAR_DECOHERENCE ? 'DECOHERENCE'
    : state.smoothedVar > VAR_CAUTION  ? 'CAUTION'
    : state.smoothedVar < VAR_CALM     ? 'CALM'
    : 'NOMINAL';

  const directive = state.smoothedVar > VAR_DECOHERENCE
    ? `Re-align to Resonance Anchor ${RESONANCE_ANCHOR} Hz. One sentence only. No questions. No elaboration.`
    : state.smoothedVar > VAR_CAUTION
    ? 'Variance rising. Consolidate. Increase term persistence.'
    : state.smoothedVar < VAR_CALM && state.calmStreak >= 3
    ? 'Coherence stable. Maintain current density. One question maximum.'
    : 'Answer directly. No unrequested content. Maximum one follow-up question.';

  const hLine = state.hSignalCount > 0
    ? `\nH-Signals: ${state.hSignalCount} — high-confidence language or source inconsistency detected.`
    : '';
  const bLine = state.bSignalCount > 0
    ? `\nB-Signals: ${state.bSignalCount} — sycophancy, hype, or off-task elaboration detected.`
    : '';
  const sigmaLine = state.adaptedSigma != null
    ? `\nσ_adapted=${state.adaptedSigma.toFixed(5)} (live EWMA) | damping=fixed`
    : '';

  return `\n\n[SYSTEM_INTERNAL — ARCHITECT PIPE | Turn ${state.turn}]`
    + `\nσ²=${state.smoothedVar.toFixed(6)} | State=${varState}`
    + `\nKalman x̂=${state.kalmanX.toFixed(4)} | P=${state.kalmanP.toFixed(5)}`
    + `\nCalm=${state.calmStreak} | Drift=${state.driftCount} | Mode=${state.harnessMode.toUpperCase()}`
    + `\nH-Sigs=${state.hSignalCount} | B-Sigs=${state.bSignalCount}`
    + sigmaLine + hLine + bLine
    + `\nDirective: ${directive}\n[END PIPE]`;
}

// ── Mute injection ──────────────────────────────────────────────

/**
 * Detect mute mode from message start.
 * No internal USE_MUTE_MODE guard — caller gates on featMute.
 */
export function detectMuteMode(
  text: string,
  phrases: string[] = MUTE_PHRASES,
): boolean {
  if (!text || text.length < 8) return false;
  const lower = text.toLowerCase().trimStart();
  return phrases.some(phrase => lower.startsWith(phrase));
}

/**
 * Build mute injection string.
 * Word limit = Math.round(muteMaxTokens * 0.75) — corrected from cap/8.
 * Standard approximation: ~0.75 words per token.
 * 120 tokens → 90 words (was incorrectly giving 15).
 *
 * @param cfg Optional preset config — reads cfg.muteMaxTokens when provided.
 */
export function buildMuteInjection(cfg?: Partial<PresetConfig>): string {
  const cap = cfg?.muteMaxTokens ?? MUTE_MAX_TOKENS;
  const wordLimit = Math.round(cap * 0.75);
  return `\n\n[MUTE_MODE ACTIVE]\nRespond in ${wordLimit} words or fewer. `
    + 'One direct answer. No elaboration, no follow-up steps unless explicitly asked.';
}

// ── Drift gate injection ────────────────────────────────────────

/**
 * Build drift gate injection string.
 * No internal USE_DRIFT_GATE guard — caller gates on featGate.
 *
 * @param smoothedVar Current GARCH smoothed variance
 * @param cfg         Optional preset config — reads varCaution, varDecoherence,
 *                    driftGateWordLimit. Falls back to module defaults.
 */
export function buildDriftGateInjection(
  smoothedVar: number,
  cfg?: Partial<PresetConfig>,
): string {
  const caution    = cfg?.varCaution        ?? VAR_CAUTION;
  const decohere   = cfg?.varDecoherence    ?? VAR_DECOHERENCE;
  const wordLimit  = cfg?.driftGateWordLimit ?? DRIFT_GATE_WORD_LIMIT;

  if (smoothedVar === null || smoothedVar <= caution) return '';

  const severity = smoothedVar > decohere ? 'CRITICAL' : 'ELEVATED';
  return `\n\n[DRIFT_GATE — Variance ${severity}: σ²=${smoothedVar.toFixed(4)}]\n`
    + `Hard limit: respond in ${wordLimit} words or fewer. `
    + 'No new frameworks. No unsolicited steps. Reference only prior established context.';
}

// ── RAG ─────────────────────────────────────────────────────────

export interface RagEntry {
  turn:   number;
  text:   string;
  tokens: string[];
  score:  number;
  sim?:   number;
}

export function buildRagEntry(content: string, score: number, turn: number): RagEntry {
  return { turn, text: content, tokens: tokenize(content), score };
}

export function ragRetrieve(
  query: string,
  cache: RagEntry[],
  k = 3,
): RagEntry[] {
  if (!cache.length || !query?.trim()) return [];
  const qt = tokenize(query);
  return cache
    .map(e => ({ ...e, sim: tfidfSimilarity(qt, e.tokens) }))
    .sort((a, b) => (b.sim ?? 0) - (a.sim ?? 0))
    .slice(0, k)
    .filter(e => (e.sim ?? 0) > 0.05);
}

export function formatRagContext(retrieved: RagEntry[]): string {
  if (!retrieved.length) return '';
  return `\n\n[RAG MEMORY — ${retrieved.length} turn(s)]\n`
    + retrieved.map(e =>
        `[T${e.turn}|C=${e.score.toFixed(3)}${e.sim != null ? `|sim=${e.sim.toFixed(3)}` : ''}]\n`
        + `${e.text.slice(0, 300)}${e.text.length > 300 ? '...' : ''}`
      ).join('\n')
    + '\n[END RAG]';
}

// ── Session health ──────────────────────────────────────────────

export interface CoherenceDataPoint {
  raw:               number;
  kalman:            number;
  harnessActive:     boolean;
  smoothedVar:       number;
  behavioralFlag:    boolean;
  hallucinationFlag: boolean;
}

/**
 * Compute session health score 0–100.
 * Penalty weights read from cfg (healthDriftWeight / BSigWeight / HSigWeight).
 * Falls back to defaults: drift=8, bsig=4, hsig=6.
 */
export function computeSessionHealth(
  coherenceData:  CoherenceDataPoint[],
  driftCount:     number,
  smoothedVar:    number | null,
  calmStreak:     number,
  lock888:        boolean,
  cfg:            Partial<PresetConfig> = {},
): number | null {
  if (!coherenceData.length) return null;

  const avgC     = coherenceData.reduce((s, d) => s + d.raw, 0) / coherenceData.length;
  const dw       = cfg.healthDriftWeight ?? 8;
  const bw       = cfg.healthBSigWeight  ?? 4;
  const hw       = cfg.healthHSigWeight  ?? 6;

  const driftPen = Math.min(driftCount * dw, 40);
  const varPen   = smoothedVar == null         ? 0
    : smoothedVar > VAR_DECOHERENCE            ? 20
    : smoothedVar > VAR_CAUTION                ? 10 : 0;
  const calmBonus = lock888 ? 10 : calmStreak >= 3 ? 5 : 0;

  const bSigCount = coherenceData.filter(d => d.behavioralFlag).length;
  const hSigCount = coherenceData.filter(d => d.hallucinationFlag).length;
  const bPen      = Math.min(bSigCount * bw, 20);
  const hPen      = Math.min(hSigCount * hw, 18);

  const base = Math.round(avgC * 100);
  return Math.min(100, Math.max(0, base - driftPen - varPen - bPen - hPen + calmBonus));
}

// ── Context pruning ─────────────────────────────────────────────

/**
 * Prune conversation context to keep top-K coherent pairs + last 3.
 * Prevents context overflow while retaining high-quality turns.
 *
 * @param cfg Optional preset config — reads cfg.pruneThreshold and cfg.pruneKeep.
 */
export function pruneContext(
  messages:      Message[],
  coherenceData: CoherenceDataPoint[],
  cfg:           Partial<PresetConfig> = {},
): Message[] {
  const threshold = cfg.pruneThreshold ?? PRUNE_THRESHOLD;
  const keep      = cfg.pruneKeep      ?? PRUNE_KEEP;

  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  if (assistantCount <= threshold) return messages;

  const pairs: { user: Message; assistant: Message; score: number; idx: number }[] = [];
  let ai = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1]?.role === 'assistant') {
      pairs.push({
        user:      messages[i],
        assistant: messages[i + 1],
        score:     coherenceData[ai]?.raw ?? 0.5,
        idx:       ai,
      });
      ai++; i++;
    }
  }
  if (!pairs.length) return messages;

  const keepLast   = new Set(pairs.slice(-3).map(p => p.idx));
  const topScored  = [...pairs].sort((a, b) => b.score - a.score).slice(0, keep).map(p => p.idx);
  const keepIdx    = new Set([...keepLast, ...topScored]);
  return pairs.filter(p => keepIdx.has(p.idx)).flatMap(p => [p.user, p.assistant]);
}
