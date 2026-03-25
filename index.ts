/**
 * HUDSON & PERRY DRIFT LAW — SDK
 * Version 1.5.1
 *
 * © 2026 Hudson & Perry Research
 * Authors: David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)
 * License: MIT
 *
 * The mathematical engine behind the ARCHITECT coherence harness.
 * Extract, use, and build on any of the components independently.
 *
 * Quick start:
 *   import { computeCoherence, kalmanStep, buildPipeInjection } from 'hpdl-sdk';
 *
 *   const score  = computeCoherence(response, history);
 *   const kalman = kalmanStep(state, score, turn * (2*Math.PI/12), SDE_PARAMS);
 *   const pipe   = buildPipeInjection({ smoothedVar, kalmanX: kalman.x, ... });
 */

// Constants — all exposed, none locked
export * from './constants';

// SDE simulation and Kalman filter
export {
  simulateSDE,
  sdePercentilesAtStep,
  kalmanStep,
  kalmanDualStep,
} from './sde';
export type { SDEParams, KalmanState } from './sde';

// Coherence scoring
export {
  tokenize,
  getTextFromContent,
  tfidfSimilarity,
  jensenShannonDivergence,
  computeCoherence,
  DEFAULT_WEIGHTS,
} from './coherence';
export type { CoherenceWeights, Message, ContentBlock } from './coherence';

// GARCH variance and Drift Law
export {
  updateSmoothedVariance,
  driftLawCapEff,
  driftLawFloor,
  applyZeroDriftLock,
} from './drift';

// Signal detection
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

// Engine: pipe injection, RAG, health, pruning
export {
  buildPipeInjection,
  detectMuteMode,
  buildMuteInjection,
  buildDriftGateInjection,
  buildRagEntry,
  ragRetrieve,
  formatRagContext,
  computeSessionHealth,
  pruneContext,
} from './engine';
export type {
  PipeState,
  RagEntry,
  CoherenceDataPoint,
  HealthConfig,
} from './engine';

// Storage polyfill
export { storage } from './storage';
export type { StorageAdapter, StorageResult } from './storage';
