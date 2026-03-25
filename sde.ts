/**
 * HPDL SDK — SDE & KALMAN
 * Stochastic Differential Equation simulation and Kalman filter.
 *
 * SDE Model:
 *   dε(t) = a(t)ε(t)dt + b dW_t
 *   a(t)  = (α + β·sin(ωt)) / (1+κ)
 *   b     = σ / (1+κ)
 *
 * Kalman Filter (discrete, time-varying):
 *   F     = 1 + a(t_k)
 *   x̂_k  = F·x̂_{k-1} + K·(obs - F·x̂_{k-1})
 */

import { KAPPA, KALMAN_R, KALMAN_SIGMA_P, SDE_PARAMS } from './constants';

export interface SDEParams {
  alpha:  number;
  beta_p: number;
  omega:  number;
  sigma:  number;
  kappa:  number;
}

export interface KalmanState {
  x: number; // filtered estimate
  P: number; // error covariance
}

// ── LCG RNG — deterministic, matches artifact exactly ──────────
function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randn(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── SDE Simulation ──────────────────────────────────────────────
/**
 * Simulate Monte Carlo SDE paths.
 * @param params  SDE parameters (defaults to framework values)
 * @param T       Total time (default 20)
 * @param dt      Step size (default 0.02)
 * @param nPaths  Number of paths (default 50)
 * @param seed    RNG seed (default 42, deterministic)
 * @returns       Array of Float32Array paths
 */
export function simulateSDE(
  params: SDEParams = SDE_PARAMS,
  T      = 20,
  dt     = 0.02,
  nPaths = 50,
  seed   = 42,
): Float32Array[] {
  const { alpha, beta_p, omega, sigma, kappa } = params;
  const lam    = 1 / (1 + kappa);
  const nSteps = Math.ceil(T / dt);
  const rng    = makeRng(seed);
  const paths: Float32Array[] = [];

  for (let p = 0; p < nPaths; p++) {
    const path = new Float32Array(nSteps + 1);
    path[0] = 0;
    for (let i = 1; i <= nSteps; i++) {
      const t   = i * dt;
      const a_t = lam * (alpha + beta_p * Math.sin(omega * t));
      const b   = lam * sigma;
      path[i]   = path[i - 1] + a_t * path[i - 1] * dt + b * Math.sqrt(dt) * randn(rng);
    }
    paths.push(path);
  }
  return paths;
}

// ── SDE Percentiles ─────────────────────────────────────────────
/**
 * Get p10/p50/p90 percentiles of paths at a given step.
 */
export function sdePercentilesAtStep(
  paths: Float32Array[],
  step:  number,
): { p10: number; p50: number; p90: number } {
  const vals = paths
    .map(p => p[Math.min(step, p.length - 1)])
    .sort((a, b) => a - b);
  const n = vals.length;
  return {
    p10: vals[Math.floor(n * 0.10)],
    p50: vals[Math.floor(n * 0.50)],
    p90: vals[Math.floor(n * 0.90)],
  };
}

// ── Kalman Step ─────────────────────────────────────────────────
/**
 * Single Kalman filter update step.
 * @param state   Current {x, P}
 * @param obs     New observation (coherence score)
 * @param t       Current time index (turn * 2π/12)
 * @param params  SDE params used for state transition
 * @param kalR    Observation noise (default KALMAN_R)
 * @param kalSigP Process noise param (default KALMAN_SIGMA_P)
 */
export function kalmanStep(
  state:   KalmanState,
  obs:     number,
  t:       number,
  params:  SDEParams = SDE_PARAMS,
  kalR:    number    = KALMAN_R,
  kalSigP: number    = KALMAN_SIGMA_P,
): KalmanState {
  const { alpha, beta_p, omega, kappa } = params;
  const lam = 1 / (1 + kappa);
  const a_t = lam * (alpha + beta_p * Math.sin(omega * t));
  const F   = 1 + a_t;
  const Q   = Math.pow(kalSigP * lam, 2);
  const x_p = F * state.x;
  const P_p = F * F * state.P + Q;
  const K   = P_p / (P_p + kalR);
  return {
    x: x_p + K * (obs - x_p),
    P: (1 - K) * P_p,
  };
}

/**
 * Convenience: run dual Kalman (live score + post-audit score).
 * Returns state after both observations.
 */
export function kalmanDualStep(
  state:          KalmanState,
  liveScore:      number,
  postAuditScore: number,
  t:              number,
  params:         SDEParams = SDE_PARAMS,
  kalR:           number    = KALMAN_R,
  kalSigP:        number    = KALMAN_SIGMA_P,
): KalmanState {
  const after1 = kalmanStep(state, liveScore, t, params, kalR, kalSigP);
  return kalmanStep(after1, postAuditScore, t, params, kalR, kalSigP);
}
