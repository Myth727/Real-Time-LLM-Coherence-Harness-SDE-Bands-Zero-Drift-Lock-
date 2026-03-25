/**
 * HPDL SDK — PIPE, RAG, HEALTH, PRUNE
 * The control layer: u_drift(t) in practice.
 *
 * Pipe injection = bounded corrective forcing injected into the system prompt.
 * It acts on system evolution (the AI's next response) without modifying
 * the coherence observable C or the Kalman measurement structure.
 */

import {
  VAR_DECOHERENCE, VAR_CAUTION, VAR_CALM, RESONANCE_ANCHOR,
  MUTE_PHRASES, MUTE_MAX_TOKENS, DRIFT_GATE_WORD_LIMIT,
  PRUNE_THRESHOLD, PRUNE_KEEP,
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
    ? `\nσ_adapted=${state.adaptedSigma.toFixed(5)} (live EWMA) | κ=0.444 (fixed)`
    : '';

  return `\n\n[SYSTEM_INTERNAL — HUDSON & PERRY PIPE | Turn ${state.turn}]`
    + `\nσ²=${state.smoothedVar.toFixed(6)} | State=${varState}`
    + `\nKalman x̂=${state.kalmanX.toFixed(4)} | P=${state.kalmanP.toFixed(5)}`
    + `\nCalm=${state.calmStreak} | Drift=${state.driftCount} | Mode=${state.harnessMode.toUpperCase()}`
    + `\nH-Sigs=${state.hSignalCount} | B-Sigs=${state.bSignalCount}`
    + sigmaLine + hLine + bLine
    + `\nDirective: ${directive}\n[END PIPE]`;
}

// ── Mute injection ──────────────────────────────────────────────
export function detectMuteMode(
  text:    string,
  phrases: string[] = MUTE_PHRASES,
): boolean {
  if (!text || text.length < 8) return false;
  const lower = text.toLowerCase().trimStart();
  return phrases.some(phrase => lower.startsWith(phrase));
}

export function buildMuteInjection(muteMaxTokens = MUTE_MAX_TOKENS): string {
  return `\n\n[MUTE_MODE ACTIVE]\nRespond in ${muteMaxTokens / 8 | 0} words or fewer. `
    + 'One direct answer. No elaboration, no follow-up steps unless explicitly asked.';
}

// ── Drift gate injection ────────────────────────────────────────
export function buildDriftGateInjection(
  smoothedVar:    number,
  varCaution:     number = VAR_CAUTION,
  varDecoherence: number = VAR_DECOHERENCE,
  wordLimit:      number = DRIFT_GATE_WORD_LIMIT,
): string {
  if (smoothedVar === null || smoothedVar <= varCaution) return '';
  const severity = smoothedVar > varDecoherence ? 'CRITICAL' : 'ELEVATED';
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
}

export function buildRagEntry(content: string, score: number, turn: number): RagEntry {
  return { turn, text: content, tokens: tokenize(content), score };
}

export function ragRetrieve(
  query: string,
  cache: RagEntry[],
  k     = 3,
): RagEntry[] {
  if (!cache.length || !query?.trim()) return [];
  const qt = tokenize(query);
  return cache
    .map(e => ({ ...e, sim: tfidfSimilarity(qt, e.tokens) }))
    .sort((a: any, b: any) => b.sim - a.sim)
    .slice(0, k)
    .filter((e: any) => e.sim > 0.05);
}

export function formatRagContext(retrieved: (RagEntry & { sim?: number })[]): string {
  if (!retrieved.length) return '';
  return `\n\n[RAG MEMORY — ${retrieved.length} turn(s)]\n`
    + retrieved.map(e =>
        `[T${e.turn}|C=${e.score.toFixed(3)}${(e as any).sim ? `|sim=${(e as any).sim.toFixed(3)}` : ''}]\n${e.text.slice(0, 300)}${e.text.length > 300 ? '...' : ''}`
      ).join('\n')
    + '\n[END RAG]';
}

// ── Session health ──────────────────────────────────────────────
export interface CoherenceDataPoint {
  raw:              number;
  kalman:           number;
  harnessActive:    boolean;
  smoothedVar:      number;
  behavioralFlag:   boolean;
  hallucinationFlag:boolean;
}

export interface HealthConfig {
  healthDriftWeight?: number;
  healthBSigWeight?:  number;
  healthHSigWeight?:  number;
}

/**
 * Compute session health score (0–100).
 * Higher = more coherent session. Penalizes drift, B-sigs, H-sigs, variance.
 */
export function computeSessionHealth(
  coherenceData: CoherenceDataPoint[],
  driftCount:    number,
  smoothedVar:   number | null,
  calmStreak:    number,
  lock888:       boolean,
  cfg:           HealthConfig = {},
): number | null {
  if (!coherenceData.length) return null;
  const avgC       = coherenceData.reduce((s, d) => s + d.raw, 0) / coherenceData.length;
  const dw         = cfg.healthDriftWeight ?? 8;
  const bw         = cfg.healthBSigWeight  ?? 4;
  const hw         = cfg.healthHSigWeight  ?? 6;
  const driftPen   = Math.min(driftCount * dw, 40);
  const varPen     = smoothedVar == null ? 0
    : smoothedVar > VAR_DECOHERENCE ? 20
    : smoothedVar > VAR_CAUTION     ? 10 : 0;
  const calmBonus  = lock888 ? 10 : calmStreak >= 3 ? 5 : 0;
  const bSigCount  = coherenceData.filter(d => d.behavioralFlag).length;
  const hSigCount  = coherenceData.filter(d => d.hallucinationFlag).length;
  const bPen       = Math.min(bSigCount * bw, 20);
  const hPen       = Math.min(hSigCount * hw, 18);
  const base       = Math.round(avgC * 100);
  return Math.min(100, Math.max(0, base - driftPen - varPen - bPen - hPen + calmBonus));
}

// ── Context pruning ─────────────────────────────────────────────
/**
 * Prune conversation context to keep top-K coherent pairs + last 3.
 * Prevents context overflow while retaining high-quality turns.
 */
export function pruneContext(
  messages:      Message[],
  coherenceData: CoherenceDataPoint[],
  threshold      = PRUNE_THRESHOLD,
  keep           = PRUNE_KEEP,
): Message[] {
  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  if (assistantCount <= threshold) return messages;

  const pairs: { user: Message; assistant: Message; score: number; idx: number }[] = [];
  let ai = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1]?.role === 'assistant') {
      pairs.push({ user: messages[i], assistant: messages[i + 1],
        score: coherenceData[ai]?.raw ?? 0.5, idx: ai });
      ai++; i++;
    }
  }
  if (!pairs.length) return messages;

  const keepLast   = new Set(pairs.slice(-3).map(p => p.idx));
  const topScored  = [...pairs].sort((a, b) => b.score - a.score).slice(0, keep).map(p => p.idx);
  const keepIdx    = new Set([...keepLast, ...topScored]);
  return pairs.filter(p => keepIdx.has(p.idx)).flatMap(p => [p.user, p.assistant]);
}
