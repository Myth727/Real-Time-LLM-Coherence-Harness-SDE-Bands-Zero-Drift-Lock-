/**
 * HUDSON & PERRY DRIFT LAW — CONSTANTS
 * © 2026 Hudson & Perry Research
 * @RaccoonStampede · @Prosperous727
 *
 * Core constants of the framework. κ, ε, and RESONANCE_ANCHOR
 * are the identity constants — change them only if you understand
 * what you are doing. They are exposed, not locked, by design.
 *
 * V1.5.8: Added PresetConfig type and PRESETS map. GARCH params
 * are now per-preset tunable in updateSmoothedVariance. Removed
 * VAR_SMOOTH_ALPHA (was declared but never referenced anywhere).
 */

// ── Hudson Constants ────────────────────────────────────────────
export const KAPPA            = 0.444;           // Hudson Constant — drives damping, SDE, Kalman
export const DAMPING          = 1 / (1 + KAPPA); // 0.6925
export const EPSILON          = 0.05;            // Ghost tax floor — ~5% inefficiency
export const RESONANCE_ANCHOR = 623.81;          // Hz — Zero-Drift Lock target
export const LOCK_888         = 0.888;           // Full coherence stabilization target
export const HC_MASS_LOSS     = KAPPA;           // Alias — Hudson Constant (mass-loss domain)
export const AGAPE_STAB       = 0.1;             // Agape stabilization coefficient
export const SENSITIVITY      = 0.30;            // HALO threshold scalar
export const HALO_THRESHOLD   = 0.0004 * (1 + SENSITIVITY); // 0.00052

// ── Kalman ──────────────────────────────────────────────────────
export const KALMAN_R       = 0.015; // Observation noise variance
export const KALMAN_SIGMA_P = 0.06;  // Process noise parameter

// ── SDE Parameters ──────────────────────────────────────────────
export const SDE_PARAMS = {
  alpha:  -0.25,                  // Mean-reversion (negative = stable OU)
  beta_p:  0.18,                  // Periodic forcing amplitude
  omega:   2 * Math.PI / 12,      // Forcing frequency (12-step period)
  sigma:   0.10,                  // Base diffusion coefficient
  kappa:   KAPPA,                 // Hudson Constant — locked to framework identity
};

// ── GARCH(1,1) defaults ─────────────────────────────────────────
// These are module-level defaults. Pass a PresetConfig to
// updateSmoothedVariance to use per-preset GARCH tuning.
export const GARCH_OMEGA = 0.02;
export const GARCH_ALPHA = 0.15;
export const GARCH_BETA  = 0.80;

// ── Variance thresholds ─────────────────────────────────────────
export const VAR_DECOHERENCE = 0.200;
export const VAR_CAUTION     = 0.120;
export const VAR_CALM        = 0.080;
export const LOCK_888_STREAK = 5;

// ── Drift Law ───────────────────────────────────────────────────
export const BETA_C  = 0.2;
export const ALPHA_S = 1.8;

// ── Token limits ────────────────────────────────────────────────
export const NORMAL_MAX_TOKENS    = 1000;
export const MUTE_MAX_TOKENS      = 120;
export const DRIFT_GATE_WORD_LIMIT = 120;
export const RAG_TOP_K            = 3;
export const PRUNE_THRESHOLD      = 8;
export const PRUNE_KEEP           = 5;

// ── Harness modes ───────────────────────────────────────────────
export const HARNESS_MODES = {
  audit:    { gamma_h: 0.05,  label: 'AUDIT',      threshold: 1.1  },
  moderate: { gamma_h: 50,    label: 'MODERATE',   threshold: 0.72 },
  deep:     { gamma_h: 5000,  label: 'DEEP CLEAN', threshold: 0.62 },
  extreme:  { gamma_h: 10000, label: 'EXTREME',    threshold: 0.50 },
} as const;

export type HarnessMode = keyof typeof HARNESS_MODES;

// ── Mute phrases ────────────────────────────────────────────────
export const MUTE_PHRASES = [
  'how do i ', 'what should i', 'walk me through', 'give me a plan',
  'outline the steps', 'what are the steps', 'step by step',
  'list the steps', 'can you plan', 'create a roadmap', 'make a roadmap',
];

// ── Preset configuration type ───────────────────────────────────
/**
 * All non-constant parameters tunable per preset.
 * κ, ε, and RESONANCE_ANCHOR are NOT in presets — they are framework
 * identity constants and remain fixed across all preset modes.
 */
export interface PresetConfig {
  label:             string;
  description:       string;
  varDecoherence:    number;
  varCaution:        number;
  varCalm:           number;
  lock888Streak:     number;
  lock888AvgCFloor:  number;
  driftGateWordLimit:number;
  muteMaxTokens:     number;
  garchOmega:        number;
  garchAlpha:        number;
  garchBeta:         number;
  sdeAlpha:          number;
  sdeBetaP:          number;
  sdeSigma:          number;
  pruneThreshold:    number;
  pruneKeep:         number;
  driftEscalateMod:  number;
  driftEscalateDeep: number;
  driftEscalateExtreme: number;
  healthDriftWeight: number;
  healthBSigWeight:  number;
  healthHSigWeight:  number;
}

// ── Industry presets ────────────────────────────────────────────
export const PRESETS: Record<string, PresetConfig> = {
  DEFAULT: {
    label: 'DEFAULT', description: 'Original Hudson & Perry settings',
    varDecoherence: 0.200, varCaution: 0.120, varCalm: 0.080,
    lock888Streak: 5, lock888AvgCFloor: 0.72,
    driftGateWordLimit: 120, muteMaxTokens: 120,
    garchOmega: 0.02, garchAlpha: 0.15, garchBeta: 0.80,
    sdeAlpha: -0.25, sdeBetaP: 0.18, sdeSigma: 0.10,
    pruneThreshold: 8, pruneKeep: 5,
    driftEscalateMod: 3, driftEscalateDeep: 5, driftEscalateExtreme: 8,
    healthDriftWeight: 8, healthBSigWeight: 4, healthHSigWeight: 6,
  },
  TECHNICAL: {
    label: 'TECHNICAL', description: 'Code reviews, audits, engineering',
    varDecoherence: 0.180, varCaution: 0.100, varCalm: 0.060,
    lock888Streak: 5, lock888AvgCFloor: 0.75,
    driftGateWordLimit: 200, muteMaxTokens: 200,
    garchOmega: 0.02, garchAlpha: 0.12, garchBeta: 0.83,
    sdeAlpha: -0.30, sdeBetaP: 0.15, sdeSigma: 0.08,
    pruneThreshold: 10, pruneKeep: 6,
    driftEscalateMod: 3, driftEscalateDeep: 5, driftEscalateExtreme: 8,
    healthDriftWeight: 10, healthBSigWeight: 3, healthHSigWeight: 8,
  },
  CREATIVE: {
    label: 'CREATIVE', description: 'Writing, brainstorming, narrative',
    varDecoherence: 0.280, varCaution: 0.160, varCalm: 0.100,
    lock888Streak: 4, lock888AvgCFloor: 0.65,
    driftGateWordLimit: 300, muteMaxTokens: 300,
    garchOmega: 0.03, garchAlpha: 0.18, garchBeta: 0.75,
    sdeAlpha: -0.18, sdeBetaP: 0.22, sdeSigma: 0.14,
    pruneThreshold: 6, pruneKeep: 4,
    driftEscalateMod: 4, driftEscalateDeep: 7, driftEscalateExtreme: 12,
    healthDriftWeight: 5, healthBSigWeight: 2, healthHSigWeight: 4,
  },
  RESEARCH: {
    label: 'RESEARCH', description: 'Academic, long-form analysis',
    varDecoherence: 0.220, varCaution: 0.130, varCalm: 0.085,
    lock888Streak: 6, lock888AvgCFloor: 0.70,
    driftGateWordLimit: 250, muteMaxTokens: 180,
    garchOmega: 0.02, garchAlpha: 0.13, garchBeta: 0.82,
    sdeAlpha: -0.22, sdeBetaP: 0.20, sdeSigma: 0.11,
    pruneThreshold: 12, pruneKeep: 8,
    driftEscalateMod: 4, driftEscalateDeep: 6, driftEscalateExtreme: 10,
    healthDriftWeight: 8, healthBSigWeight: 5, healthHSigWeight: 7,
  },
  MEDICAL: {
    label: 'MEDICAL/LEGAL', description: 'High-stakes — tightest settings',
    varDecoherence: 0.150, varCaution: 0.090, varCalm: 0.055,
    lock888Streak: 6, lock888AvgCFloor: 0.80,
    driftGateWordLimit: 80, muteMaxTokens: 80,
    garchOmega: 0.015, garchAlpha: 0.10, garchBeta: 0.87,
    sdeAlpha: -0.35, sdeBetaP: 0.12, sdeSigma: 0.07,
    pruneThreshold: 6, pruneKeep: 5,
    driftEscalateMod: 2, driftEscalateDeep: 4, driftEscalateExtreme: 6,
    healthDriftWeight: 12, healthBSigWeight: 6, healthHSigWeight: 10,
  },
};
