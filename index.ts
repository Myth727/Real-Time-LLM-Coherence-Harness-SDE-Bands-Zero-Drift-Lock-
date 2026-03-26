/**
 * HUDSON & PERRY DRIFT LAW — SDK
 * Version 1.5.8
 *
 * © 2026 Hudson & Perry Research
 * Authors: David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)
 * License: MIT
 *
 * The mathematical engine behind the ARCHITECT coherence harness.
 * Extract, use, and build on any of the components independently.
 *
 * Quick start:
 *   import { computeCoherence, kalmanStep, buildPipeInjection, PRESETS } from 'hpdl-sdk';
 *
 *   const score  = computeCoherence(response, history);
 *   const kalman = kalmanStep(state, score, turn * (2*Math.PI/12), SDE_PARAMS);
 *   const pipe   = buildPipeInjection({ smoothedVar, kalmanX: kalman.x, ... });
 *
 *   // Use a preset config for per-preset GARCH tuning, health weights, etc.
 *   const cfg = PRESETS.TECHNICAL;
 *   const newVar = updateSmoothedVariance(history, prev, cfg);
 *
 * V1.5.8 changes:
 *   - Added buildTermFreq export (merged from buildTfIdf + buildTermFreqDist)
 *   - Added PRESETS and PresetConfig exports (industry presets map)
 *   - Removed HealthConfig type (merged into PresetConfig)
 *   - Version bumped from 1.5.1 to 1.5.8
 */

// ── Constants — all exposed, none locked ────────────────────────
export * from './constants';
// Explicit re-exports for the most-used types
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
  buildTermFreq,          // V1.5.4: canonical merge of buildTfIdf + buildTermFreqDist
  tfidfSimilarity,
  jensenShannonDivergence,
  computeCoherence,
  DEFAULT_WEIGHTS,
} from './coherence';
export type { CoherenceWeights, Message, ContentBlock } from './coherence';

// ── GARCH variance and Drift Law ─────────────────────────────────
export {
  updateSmoothedVariance, // V1.5.3: takes optional cfg for per-preset GARCH params
  driftLawCapEff,         // V1.5.3: takes optional epsilon param
  driftLawFloor,          // V1.5.3: takes optional epsilon param
  applyZeroDriftLock,
} from './drift';

// ── Signal detection ─────────────────────────────────────────────
export {
  assessBehavioralSignals,
  assessHallucinationSignals,
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
  buildPipeInjection,
  detectMuteMode,
  buildMuteInjection,     // V1.5.4: word limit corrected (cap*0.75 not cap/8)
  buildDriftGateInjection,// V1.5.3: accepts PresetConfig for per-preset thresholds
  buildRagEntry,
  ragRetrieve,
  formatRagContext,
  computeSessionHealth,   // reads healthDriftWeight/BSigWeight/HSigWeight from cfg
  pruneContext,           // reads pruneThreshold/pruneKeep from cfg
} from './engine';
export type {
  PipeState,
  RagEntry,
  CoherenceDataPoint,
} from './engine';

// ── Storage polyfill ─────────────────────────────────────────────
export { storage } from './storage';
export type { StorageAdapter, StorageResult } from './storage';
