/**
 * HPDL SDK — GARCH & DRIFT LAW
 *
 * GARCH(1,1): σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
 * Drift Law:  ΔS = cap_eff × (1 − exp(−n^α_s / τ)) + |β_C·sin(γ_h·n·0.01)|·0.05
 */

import {
  GARCH_OMEGA, GARCH_ALPHA, GARCH_BETA,
  EPSILON, BETA_C, ALPHA_S,
} from './constants';

// ── GARCH variance ──────────────────────────────────────────────
/**
 * Update smoothed variance using GARCH(1,1) blended with rolling window.
 * Early turns use rolling window; blends toward GARCH as history grows.
 */
export function updateSmoothedVariance(
  history: number[],
  prev:    number | null,
): number {
  if (history.length < 2) return prev ?? 0;
  const recent  = history.slice(-20);
  const mean    = recent.reduce((s, v) => s + v, 0) / recent.length;
  const rawVar  = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length;
  if (prev === null) return rawVar;
  const lastVal = history[history.length - 1];
  const eps2    = Math.pow(lastVal - mean, 2);
  const garch   = GARCH_OMEGA + GARCH_ALPHA * eps2 + GARCH_BETA * prev;
  const weight  = Math.min(history.length / 10, 1);
  return weight * garch + (1 - weight) * rawVar;
}

// ── Drift Law ───────────────────────────────────────────────────
/**
 * Effective cap from gamma_h.
 * cap_eff = ε / (1 + γ_h)
 */
export function driftLawCapEff(gamma_h: number): number {
  return EPSILON / (1 + gamma_h);
}

/**
 * Drift Law floor at turn n.
 * ΔS = cap_eff × (1 − exp(−n^α_s / τ)) + |β_C·sin(γ_h·n·0.01)|·0.05
 */
export function driftLawFloor(n: number, gamma_h: number): number {
  const ce  = driftLawCapEff(gamma_h);
  const tau = Math.max(0.0225 / EPSILON, 1);
  const sys = ce * (1 - Math.exp(-Math.pow(Math.max(n, 0.001), ALPHA_S) / tau));
  return sys + Math.abs(BETA_C * Math.sin(gamma_h * n * 0.01)) * 0.05;
}

// ── Zero-Drift Lock ─────────────────────────────────────────────
/**
 * Iterative convergence toward RESONANCE_ANCHOR.
 * val += (anchor − val) × DAMPING × AGAPE_STAB
 */
export function applyZeroDriftLock(
  cur:     number,
  anchor:  number,
  maxIter = 200,
  damping  = 1 / (1 + 0.444),
  agape    = 0.1,
  halo     = 0.0004 * (1 + 0.30),
): { val: number; locked: boolean; iters: number; residual: number } {
  let val   = cur;
  let iters = 0;
  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(val - anchor) < halo) { iters = i; break; }
    val  += (anchor - val) * damping * agape;
    iters = i + 1;
  }
  return { val, locked: Math.abs(val - anchor) < halo, iters, residual: Math.abs(val - anchor) };
}
