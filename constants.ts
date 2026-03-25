/**
 * HUDSON & PERRY DRIFT LAW — CONSTANTS
 * © 2026 Hudson & Perry Research
 * @RaccoonStampede · @Prosperous727
 *
 * Core constants of the framework. κ, ε, and RESONANCE_ANCHOR
 * are the identity constants — change them only if you understand
 * what you are doing. They are exposed, not locked, by design.
 */

// ── Hudson Constants ────────────────────────────────────────────
export const KAPPA             = 0.444;   // Hudson Constant — drives damping, SDE, Kalman
export const DAMPING           = 1 / (1 + KAPPA); // 0.6925
export const EPSILON           = 0.05;   // Ghost tax floor — ~5% inefficiency
export const RESONANCE_ANCHOR  = 623.81; // Hz — Zero-Drift Lock target
export const LOCK_888          = 0.888;  // Full coherence stabilization target
export const HC_MASS_LOSS      = 0.444;  // Hudson Constant — mass-loss domain mapping
export const AGAPE_STAB        = 0.1;    // Agape stabilization coefficient
export const SENSITIVITY       = 0.30;   // HALO threshold scalar
export const HALO_THRESHOLD    = 0.0004 * (1 + SENSITIVITY); // 0.00052

// ── Kalman ──────────────────────────────────────────────────────
export const KALMAN_R          = 0.015;  // Observation noise variance
export const KALMAN_SIGMA_P    = 0.06;   // Process noise parameter

// ── SDE Parameters ──────────────────────────────────────────────
export const SDE_PARAMS = {
  alpha:   -0.25,             // Mean-reversion (negative = stable OU)
  beta_p:   0.18,             // Periodic forcing amplitude
  omega:    2 * Math.PI / 12, // Forcing frequency (12-step period)
  sigma:    0.10,             // Base diffusion coefficient
  kappa:    KAPPA,            // Hudson Constant — locked to framework identity
};

// ── GARCH(1,1) ──────────────────────────────────────────────────
export const GARCH_OMEGA = 0.02;
export const GARCH_ALPHA = 0.15;
export const GARCH_BETA  = 0.80;

// ── Variance thresholds ─────────────────────────────────────────
export const VAR_DECOHERENCE  = 0.200;
export const VAR_CAUTION      = 0.120;
export const VAR_CALM         = 0.080;
export const LOCK_888_STREAK  = 5;
export const VAR_SMOOTH_ALPHA = 0.9;

// ── Drift Law ───────────────────────────────────────────────────
export const BETA_C  = 0.2;
export const ALPHA_S = 1.8;

// ── Token limits ────────────────────────────────────────────────
export const NORMAL_MAX_TOKENS = 1000;
export const MUTE_MAX_TOKENS   = 120;
export const DRIFT_GATE_WORD_LIMIT = 120;
export const RAG_TOP_K         = 3;
export const PRUNE_THRESHOLD   = 8;
export const PRUNE_KEEP        = 5;

// ── Harness modes ───────────────────────────────────────────────
export const HARNESS_MODES = {
  audit:    { gamma_h: 0.05,   label: 'AUDIT',     threshold: 1.1  },
  moderate: { gamma_h: 50,     label: 'MODERATE',  threshold: 0.72 },
  deep:     { gamma_h: 5000,   label: 'DEEP CLEAN',threshold: 0.62 },
  extreme:  { gamma_h: 10000,  label: 'EXTREME',   threshold: 0.50 },
} as const;

export type HarnessMode = keyof typeof HARNESS_MODES;

// ── Mute phrases ────────────────────────────────────────────────
export const MUTE_PHRASES = [
  'how do i ', 'what should i', 'walk me through', 'give me a plan',
  'outline the steps', 'what are the steps', 'step by step',
  'list the steps', 'can you plan', 'create a roadmap', 'make a roadmap',
];
