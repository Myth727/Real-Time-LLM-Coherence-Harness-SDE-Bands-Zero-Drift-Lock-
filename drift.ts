/**
 * HPDL SDK — GARCH & DRIFT LAW
 *
 * GARCH(1,1): sigma2_t = omega + alpha * eps2_{t-1} + beta * sigma2_{t-1}
 * Drift Law:  deltaS = cap_eff * (1 - exp(-n^alpha_s / tau))
 *                    + |beta_C * sin(gamma_h * n * 0.01)| * 0.05
 *
 * V1.5.3 changes:
 *   - updateSmoothedVariance takes optional cfg param — reads per-preset
 *     GARCH omega/alpha/beta. Falls back to module-level defaults.
 *     Previously all presets silently used DEFAULT GARCH regardless.
 *   - driftLawCapEff and driftLawFloor take optional epsilon param —
 *     defaults to EPSILON (0.05). Allows mathEpsilon user-tuning to
 *     propagate through to chart floor bands and cap_eff display.
 */

import {
  GARCH_OMEGA, GARCH_ALPHA, GARCH_BETA,
  EPSILON, BETA_C, ALPHA_S,
  type PresetConfig,
} from './constants';

// ── GARCH variance ──────────────────────────────────────────────

/**
 * Update smoothed variance using GARCH(1,1) blended with rolling window.
 * Early turns use rolling window; blends toward GARCH as history grows.
 *
 * @param history  Score history array
 * @param prev     Previous smoothed variance (null on first call)
 * @param cfg      Optional preset config — uses cfg.garchOmega/Alpha/Beta
 *                 when provided. Falls back to module-level defaults.
 */
export function updateSmoothedVariance(
  history: number[],
  prev: number | null,
  cfg?: Partial<PresetConfig>,
): number {
  if (history.length < 2) return prev ?? 0;

  const recent  = history.slice(-20);
  const mean    = recent.reduce((s, v) => s + v, 0) / recent.length;
  const rawVar  = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length;
  if (prev === null) return rawVar;

  const lastVal = history[history.length - 1];
  const eps2    = Math.pow(lastVal - mean, 2);

  // Per-preset GARCH params — fall back to module defaults when cfg absent
  const gO = cfg?.garchOmega ?? GARCH_OMEGA;
  const gA = cfg?.garchAlpha ?? GARCH_ALPHA;
  const gB = cfg?.garchBeta  ?? GARCH_BETA;

  const garch  = gO + gA * eps2 + gB * prev;
  const weight = Math.min(history.length / 10, 1);
  return weight * garch + (1 - weight) * rawVar;
}

// ── Drift Law ───────────────────────────────────────────────────

/**
 * Effective cap from gamma_h.
 * cap_eff = epsilon / (1 + gamma_h)
 *
 * @param gamma_h  Harness mode gamma value
 * @param epsilon  Ghost tax floor (default EPSILON = 0.05)
 *                 Pass mathEpsilon for user-tuned values.
 */
export function driftLawCapEff(gamma_h: number, epsilon = EPSILON): number {
  return epsilon / (1 + gamma_h);
}

/**
 * Drift Law floor at turn n.
 * deltaS = cap_eff * (1 - exp(-n^alpha_s / tau))
 *        + |beta_C * sin(gamma_h * n * 0.01)| * 0.05
 *
 * @param n        Turn number
 * @param gamma_h  Harness mode gamma value
 * @param epsilon  Ghost tax floor (default EPSILON = 0.05)
 */
export function driftLawFloor(n: number, gamma_h: number, epsilon = EPSILON): number {
  const ce  = driftLawCapEff(gamma_h, epsilon);
  const tau = Math.max(0.0225 / epsilon, 1);
  const sys = ce * (1 - Math.exp(-Math.pow(Math.max(n, 0.001), ALPHA_S) / tau));
  return sys + Math.abs(BETA_C * Math.sin(gamma_h * n * 0.01)) * 0.05;
}

// ── Zero-Drift Lock ─────────────────────────────────────────────

/**
 * Iterative convergence toward RESONANCE_ANCHOR.
 * val += (anchor - val) * damping * agape_stab
 *
 * Up to maxIter (default 200) synchronous iterations.
 * Wrap in useMemo in React contexts — this is a blocking loop.
 */
export function applyZeroDriftLock(
  cur: number,
  anchor: number,
  maxIter  = 200,
  damping  = 1 / (1 + 0.444),
  agape    = 0.1,
  halo     = 0.0004 * (1 + 0.30),
): { val: number; locked: boolean; iters: number; residual: number } {
  let val = cur;
  let iters = 0;
  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(val - anchor) < halo) { iters = i; break; }
    val  += (anchor - val) * damping * agape;
    iters = i + 1;
  }
  return {
    val,
    locked:   Math.abs(val - anchor) < halo,
    iters,
    residual: Math.abs(val - anchor),
  };
}
