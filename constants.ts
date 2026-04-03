/**
 * ARCHITECT — Core Constants & Presets
 * © 2026 Hudson & Perry Research
 * @RaccoonStampede · @Prosperous727
 * Version 1.5.37
 *
 * All constants used by the coherence scoring, Kalman filter, GARCH
 * variance model, SDE drift bands, and pipe injection engine.
 *
 * Standard operation uses these defaults. Experimental constants
 * (stability anchor, damping value) are accessible via the Advanced
 * tab in the UI — they are not changed here for normal use.
 */

// ── Damping & Smoothing ──────────────────────────────────────────
export const KAPPA   = 0.444;           // Damping constant — controls Kalman/SDE smoothing rate
export const DAMPING = 1 / (1 + KAPPA); // 0.6925 — derived from KAPPA, used throughout

// ── Coherence Floor ──────────────────────────────────────────────
export const EPSILON = 0.05;            // Minimum coherence floor (~5% irreducible inefficiency)

// ── Stability Convergence (Advanced / Experimental) ─────────────
// These are used by the Zero-Drift / Stability Convergence feature
// which is off by default and only accessible in the Advanced tab.
export const RESONANCE_ANCHOR = 623.81; // Convergence target for stability attractor
export const LOCK_888         = 0.888;  // Full coherence stabilization threshold
export const HC_MASS_LOSS     = KAPPA;  // Alias — same value as KAPPA
export const LOCK_888_STREAK  = 5;      // Calm turns required to achieve full stability

// ── Behavioral Detection Thresholds (Advanced / Experimental) ───
export const AGAPE_STAB      = 0.1;
export const SENSITIVITY     = 0.30;
export const HALO_THRESHOLD  = 0.0004 * (1 + SENSITIVITY); // 0.00052

// ── Kalman Filter ────────────────────────────────────────────────
export const KALMAN_R       = 0.015; // Observation noise variance — lower = trust observations more
export const KALMAN_SIGMA_P = 0.06;  // Process noise — higher = faster to track changes

// ── SDE Parameters (Ornstein-Uhlenbeck + Periodic Forcing) ──────
export const SDE_PARAMS = {
  alpha:  -0.25,               // Mean-reversion strength (negative = pulls toward mean)
  beta_p:  0.18,               // Periodic forcing amplitude
  omega:   2 * Math.PI / 12,   // Forcing frequency (12-step period)
  sigma:   0.10,               // Base diffusion (noise) coefficient
  kappa:   KAPPA,              // Damping — matches framework identity constant
};

// ── GARCH(1,1) Defaults ─────────────────────────────────────────
// Per-preset values override these when a preset is active.
export const GARCH_OMEGA = 0.02; // Baseline variance
export const GARCH_ALPHA = 0.15; // Weight on last squared error
export const GARCH_BETA  = 0.80; // Weight on previous variance estimate

// ── Variance Thresholds ─────────────────────────────────────────
export const VAR_DECOHERENCE = 0.200; // Above this: high variance, AI may be drifting
export const VAR_CAUTION     = 0.120; // Above this: rising variance, watch for drift
export const VAR_CALM        = 0.080; // Below this: stable, coherent session

// ── Drift Law Parameters ─────────────────────────────────────────
export const BETA_C  = 0.2;  // Periodic drift amplitude
export const ALPHA_S = 1.8;  // Drift exponent

// ── Token & Context Limits ───────────────────────────────────────
export const NORMAL_MAX_TOKENS     = 1000; // Standard response token budget
export const MUTE_MAX_TOKENS       = 120;  // Token cap when mute mode is active
export const DRIFT_GATE_WORD_LIMIT = 120;  // Word limit when drift gate fires
export const RAG_TOP_K             = 3;    // RAG retrieval: top-K results
export const PRUNE_THRESHOLD       = 8;    // Prune context when assistant turns exceed this
export const PRUNE_KEEP            = 5;    // Top-K coherent pairs to keep after pruning

// ── Mute Phrases — START-OF-MESSAGE triggers only ────────────────
// Matched against the trimmed lowercase start of the user message.
// engine.ts detectMuteMode uses these as the default phrase list.
export const MUTE_PHRASES: string[] = [
  'how do i ',     'what should i',  'walk me through',
  'give me a plan','outline the steps','what are the steps',
  'step by step',  'list the steps', 'can you plan',
  'create a roadmap','make a roadmap',
];

// ── Preset Configuration Type ────────────────────────────────────
export interface PresetConfig {
  label:             string;
  description:       string;
  color?:            string;
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

// ── Industry Presets ─────────────────────────────────────────────
// Each preset configures the full coherence stack for a specific use case.
// Select via TUNE → PRESETS in the UI.
export const PRESETS: Record<string, PresetConfig> = {
  DEFAULT: {
    label: 'DEFAULT', description: 'Balanced baseline for general use',
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
    label: 'TECHNICAL', description: 'Code reviews, audits, engineering — tighter variance, longer responses',
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
    label: 'CREATIVE', description: 'Writing, brainstorming, narrative — looser coherence, topic shifts expected',
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
    label: 'RESEARCH', description: 'Academic, long-form analysis — extended context, moderate drift tolerance',
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
    label: 'MEDICAL/LEGAL', description: 'High-stakes domains — tightest clinical settings, most aggressive harness',
    varDecoherence: 0.150, varCaution: 0.090, varCalm: 0.055,
    lock888Streak: 6, lock888AvgCFloor: 0.80,
    driftGateWordLimit: 80, muteMaxTokens: 80,
    garchOmega: 0.015, garchAlpha: 0.10, garchBeta: 0.87,
    sdeAlpha: -0.35, sdeBetaP: 0.12, sdeSigma: 0.07,
    pruneThreshold: 6, pruneKeep: 5,
    driftEscalateMod: 2, driftEscalateDeep: 4, driftEscalateExtreme: 6,
    healthDriftWeight: 12, healthBSigWeight: 6, healthHSigWeight: 10,
  },
  CIRCUIT: {
    label: 'CIRCUIT', description: 'Logic verification & cascading reasoning — tightest variance, aggressive drift clamping',
    varDecoherence: 0.140, varCaution: 0.080, varCalm: 0.050,
    lock888Streak: 6, lock888AvgCFloor: 0.82,
    driftGateWordLimit: 90, muteMaxTokens: 90,
    garchOmega: 0.012, garchAlpha: 0.09, garchBeta: 0.88,
    sdeAlpha: -0.38, sdeBetaP: 0.10, sdeSigma: 0.06,
    pruneThreshold: 6, pruneKeep: 5,
    driftEscalateMod: 2, driftEscalateDeep: 4, driftEscalateExtreme: 6,
    healthDriftWeight: 14, healthBSigWeight: 7, healthHSigWeight: 12,
  },
};
