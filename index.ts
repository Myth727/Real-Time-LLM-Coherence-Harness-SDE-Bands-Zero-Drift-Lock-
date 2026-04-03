/**
 * ARCHITECT — UNIVERSAL COHERENCE ENGINE — SDK
 * Version 1.5.37
 *
 * © 2026 Hudson & Perry Research
 * Authors: David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)
 * License: MIT
 *
 * Quick start:
 *   import { computeCoherence, kalmanStep, buildPipeInjection, PRESETS } from 'hpdl-sdk';
 *
 *   const cfg    = PRESETS.TECHNICAL;
 *   const score  = computeCoherence(response, history);
 *   const newVar = updateSmoothedVariance(scoreHistory, prev, cfg);
 *   const kalman = kalmanStep(state, score, turn * (2*Math.PI/12), SDE_PARAMS);
 *   const pipe   = buildPipeInjection({
 *                    smoothedVar: newVar, kalmanX: kalman.x, kalmanP: kalman.P,
 *                    calmStreak, driftCount, harnessMode: 'audit', turn,
 *                    hSignalCount: 0, bSignalCount: 0, adaptedSigma: null,
 *                  });
 *
 * cfg threading (V1.5.9-V1.5.13):
 *   All key functions accept an optional Partial<PresetConfig> as their last
 *   param. Pass PRESETS.MEDICAL, PRESETS.CREATIVE etc. for preset-specific
 *   thresholds. All functions fall back to module-level defaults when omitted.
 */

// ── Constants — all exposed, none locked ────────────────────────
export * from './constants';
export type { PresetConfig } from './constants';

// ── SDE simulation and Kalman filter ────────────────────────────
export {
  simulateSDE,
  sdePercentilesAtStep,
  kalmanStep,
  kalmanDualStep,
} from './sde';
export type { SDEParams, KalmanState } from './sde';

// ── Coherence scoring ───────────────────────────────────────────
export {
  tokenize,
  getTextFromContent,
  buildTermFreq,
  tfidfSimilarity,
  jensenShannonDivergence,
  computeCoherence,
  DEFAULT_WEIGHTS,
} from './coherence';
export type { CoherenceWeights, Message, ContentBlock } from './coherence';

// ── GARCH variance and Drift Law ─────────────────────────────────
export {
  updateSmoothedVariance,  // cfg → per-preset GARCH params (V1.5.3)
  driftLawCapEff,          // epsilon param (V1.5.3)
  driftLawFloor,           // epsilon param (V1.5.3)
  applyZeroDriftLock,
} from './drift';

// ── Signal detection ─────────────────────────────────────────────
export {
  assessBehavioralSignals,
  assessHallucinationSignals,  // cfg → preset varCaution threshold (V1.5.11)
  detectConfidenceLanguage,
  checkSourceConsistency,
  checkSelfContradiction,
} from './signals';
export type {
  BehavioralSignal,
  BehavioralAssessment,
  HallucinationAssessment,
} from './signals';

// ── Engine: pipe injection, RAG, health, pruning ─────────────────
export {
  buildPipeInjection,       // cfg → preset var thresholds (V1.5.9)
  detectMuteMode,
  buildMuteInjection,       // cfg → muteMaxTokens; word limit cap*0.75 (V1.5.4)
  buildDriftGateInjection,  // cfg → preset thresholds + word limit (V1.5.3)
  buildRagEntry,
  ragRetrieve,
  formatRagContext,
  computeSessionHealth,     // cfg → health penalty weights
  pruneContext,             // cfg → pruneThreshold/pruneKeep
} from './engine';
export type {
  PipeState,
  RagEntry,
  CoherenceDataPoint,
} from './engine';

// ── Storage polyfill ─────────────────────────────────────────────
export { storage } from './storage';
export type { StorageAdapter, StorageResult } from './storage';
