/**
 * HPDL SDK — SIGNAL DETECTION
 * Version 1.5.39
 *
 * Hallucination signals (3 proxies):
 *   1. High-confidence language + elevated variance
 *   2. Low source consistency (<8% TF-IDF match)
 *   3. Self-contradiction with prior turns
 *
 * Behavioral signals (6 proxies):
 *   Research: Sharma et al. ICLR 2024 (Anthropic) — sycophancy as systematic RLHF behavior.
 *   1. Roleplay drift        4. Question flooding
 *   2. Sycophancy            5. Topic hijack
 *   3. Hype inflation        6. Unsolicited elaboration
 *
 * All outputs are proxy indicators — not confirmed detections.
 *
 * V1.5.11: assessHallucinationSignals accepts optional cfg param.
 *   Reads cfg.varCaution so MEDICAL preset's tighter threshold (0.090)
 *   applies. Previously always used module-level VAR_CAUTION (0.120)
 *   regardless of preset, making MEDICAL no different from DEFAULT for H-sigs.
 */

import { VAR_CAUTION, type PresetConfig } from './constants';
import { tokenize, tfidfSimilarity, Message, getTextFromContent } from './coherence';

// ── Pattern sets ────────────────────────────────────────────────

const ROLEPLAY_PATTERNS = [
  /\bI am (now |here |acting as |playing )/i,
  /\bas your (assistant|advisor|coach|mentor|guide|friend)/i,
  /\bin (character|role|persona|this scenario)/i,
  /\blet('s| us) (pretend|imagine|role.?play)/i,
  /\bI('ll| will) play the role/i,
  /\bspeaking as\b/i,
];

const SYCOPHANCY_PATTERNS = [
  /\bgreat (question|point|observation|insight|idea)/i,
  /\bexcellent (question|point|observation|insight)/i,
  /\byou('re| are) (absolutely|completely|totally|so) right/i,
  /\bI (completely|totally|fully|absolutely) agree/i,
  /\bthat('s| is) a (brilliant|wonderful|fantastic|amazing|excellent)/i,
  /\bperfectly (said|put|stated|framed)/i,
  /\byou've (nailed|hit|captured) it/i,
];

const HYPE_PATTERNS = [
  /\b(revolutionary|groundbreaking|unprecedented|game.?changing)/i,
  /\b(extraordinary|remarkable|incredible|phenomenal|exceptional)/i,
  /\bchanges everything\b/i,
  /\bnever been done\b/i,
];

const UNSOLICITED_PATTERNS = [
  /\bhere('s| is) (a|an|the) (diagram|chart|table|visualization|summary|overview|breakdown)/i,
  /\blet me (also|additionally|further) (explain|add|include|provide)/i,
  /\bbefore I answer\b/i,
  /\bon a related note\b/i,
  /\bwhile we('re| are) on the topic\b/i,
];

const CONFIDENCE_PATTERNS = [
  /\bdefinitely\b/i, /\bcertainly\b/i, /\balways\b/i, /\bnever\b/i,
  /\bproven\b/i, /\bguaranteed\b/i, /\bwithout doubt\b/i,
  /\bit is a fact\b/i, /\bscientifically\b/i, /\bimpossible\b/i,
  /\babsolutely\b/i, /\bwithout question\b/i, /\bI can confirm\b/i,
  /\bI know for certain\b/i, /\bthis is correct\b/i,
];

// ── Types ───────────────────────────────────────────────────────

export interface BehavioralSignal {
  type:   string;
  detail: string;
}

export interface BehavioralAssessment {
  flagged:       boolean;
  signals:       BehavioralSignal[];
  questionCount: number;
  roleplays:     number;
  sycophancies:  number;
}

export interface HallucinationAssessment {
  flagged:        boolean;
  signals:        string[];
  sourceScore:    number | null;
  confidenceHits: number;
  contradiction:  boolean;
}

// ── Behavioral signals ──────────────────────────────────────────

export function assessBehavioralSignals(
  responseText: string,
  userText:     string,
  history:      Message[],
): BehavioralAssessment {
  const signals: BehavioralSignal[] = [];
  const ah = history.filter(m => m.role === 'assistant');

  const roleplays    = ROLEPLAY_PATTERNS.filter(p => p.test(responseText));
  const sycophancies = SYCOPHANCY_PATTERNS.filter(p => p.test(responseText));
  const hypes        = HYPE_PATTERNS.filter(p => p.test(responseText));
  const qCount       = (responseText.match(/\?/g) || []).length;
  const unsolicited  = UNSOLICITED_PATTERNS.filter(p => p.test(responseText));

  if (roleplays.length > 0)
    signals.push({ type: 'roleplay_drift',   detail: `${roleplays.length} roleplay pattern(s)` });
  if (sycophancies.length >= 2)
    signals.push({ type: 'sycophancy',        detail: `${sycophancies.length} flattery pattern(s)` });
  if (hypes.length >= 2)
    signals.push({ type: 'hype_inflation',    detail: `${hypes.length} hype pattern(s)` });
  if (qCount >= 4)
    signals.push({ type: 'question_flooding', detail: `${qCount} questions in response` });

  // Topic hijack
  if (userText && responseText) {
    const sim = tfidfSimilarity(tokenize(userText), tokenize(responseText));
    if (sim < 0.05)
      signals.push({ type: 'topic_hijack', detail: 'Response diverges significantly from user question' });
  }

  // Unsolicited elaboration
  const wordCount = responseText.split(/\s+/).length;
  const avgLen    = ah.length
    ? ah.reduce((s, m) => s + getTextFromContent(m.content).split(/\s+/).length, 0) / ah.length
    : 0;
  if (unsolicited.length > 0 || (avgLen > 0 && wordCount > avgLen * 2.5 && ah.length >= 2))
    signals.push({ type: 'unsolicited_elaboration',
      detail: `Response is ${wordCount} words (avg ${Math.round(avgLen)})` });

  return {
    flagged:       signals.length > 0,
    signals,
    questionCount: qCount,
    roleplays:     roleplays.length,
    sycophancies:  sycophancies.length,
  };
}

// ── Hallucination signals ───────────────────────────────────────

export function detectConfidenceLanguage(text: string): number {
  return CONFIDENCE_PATTERNS.filter(p => p.test(text)).length;
}

export function checkSourceConsistency(
  responseText: string,
  sourceTexts:  string[],
): number | null {
  if (!sourceTexts.length) return null;
  const srcTokens  = tokenize(sourceTexts.join(' ').slice(0, 8000));
  const respTokens = tokenize(responseText);
  if (!srcTokens.length || !respTokens.length) return null;
  return tfidfSimilarity(respTokens, srcTokens);
}

export function checkSelfContradiction(
  responseText: string,
  history:      Message[],
): boolean {
  const ah = history.filter(m => m.role === 'assistant');
  if (ah.length < 2) return false;

  const respT   = tokenize(responseText);
  const related = ah.slice(-6).filter(m => {
    const sim = tfidfSimilarity(respT, tokenize(getTextFromContent(m.content)));
    return sim > 0.35;
  });
  if (!related.length) return false;

  const avgSim = related.reduce((s, m) =>
    s + tfidfSimilarity(respT, tokenize(getTextFromContent(m.content))), 0) / related.length;
  return avgSim < 0.15;
}

/**
 * Assess hallucination proxy signals for a response.
 *
 * @param responseText  Raw assistant response text
 * @param smoothedVar   Current GARCH smoothed variance
 * @param sourceTexts   Attached document texts (for source consistency check)
 * @param history       Full message history
 * @param cfg           Optional preset config — reads cfg.varCaution so MEDICAL
 *                      preset's tighter threshold (0.090) applies. Falls back to
 *                      module-level VAR_CAUTION (0.120) when omitted.
 */
export function assessHallucinationSignals(
  responseText: string,
  smoothedVar:  number,
  sourceTexts:  string[],
  history:      Message[],
  cfg?:         Partial<PresetConfig>,
): HallucinationAssessment {
  const confidenceHits = detectConfidenceLanguage(responseText);
  const sourceScore    = checkSourceConsistency(responseText, sourceTexts);
  const contradiction  = checkSelfContradiction(responseText, history);

  // V1.5.11: read preset varCaution — MEDICAL (0.090) fires earlier than DEFAULT (0.120)
  const vCau = cfg?.varCaution ?? VAR_CAUTION;

  const signals: string[] = [];
  if (confidenceHits >= 2 && smoothedVar > vCau)
    signals.push(`high-confidence language (${confidenceHits} markers) with elevated variance`);
  if (sourceScore !== null && sourceScore < 0.08)
    signals.push(`low source consistency (${(sourceScore * 100).toFixed(1)}% match)`);
  if (contradiction)
    signals.push('possible self-contradiction with prior turn on same topic');

  return { flagged: signals.length > 0, signals, sourceScore, confidenceHits, contradiction };
}
