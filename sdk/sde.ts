/**
 * ARCHITECT — Universal Coherence Engine
 * SDK: SDE Simulation & Kalman Filter
 * Version 1.5.42
 * © 2026 Hudson & Perry Research
 *
 * SDE: Time-varying OU + periodic forcing + GARCH-in-Mean + jump-diffusion
 * dε(t) = a(t)ε(t)dt + b dW_t + J dN(λ)
 * a(t) = (α + β·sin(ωt) - δ·σ²(t)) / (1 + κ)
 * b    = σ / (1 + κ)
 *
 * References:
 *   GARCH-in-Mean: Engle, Lilien & Robins (1987)
 *   Jump-diffusion: Merton (1976)
 */

import { KAPPA, SDE_PARAMS, KALMAN_R, KALMAN_SIGMA_P } from './constants';

// ── Types ─────────────────────────────────────────────────────────

export interface SDEParams {
  alpha: number;        // mean reversion rate (negative for stability)
  beta_p: number;       // periodic forcing amplitude
  omega: number;        // periodic forcing frequency (default 2π/12)
  sigma: number;        // base diffusion coefficient
  kappa: number;        // damping constant (0.444 Hudson / 0.500 Standard)
  delta?: number;       // GARCH-in-Mean coupling coefficient (V1.5.39)
  jumpIntensity?: number; // Poisson jump arrival rate λ (V1.5.39)
  jumpMagnitude?: number; // jump size |J| (V1.5.39)
}

export interface KalmanState {
  x: number;  // filtered state estimate (coherence trajectory)
  P: number;  // error covariance
}

export interface SDEPercentiles {
  p10: number;
  p90: number;
}

// ── LCG Random Number Generator ───────────────────────────────────
// Deterministic seed = reproducible bands across renders

function makeRng(seed = 42): () => number {
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

// ── SDE Simulation ────────────────────────────────────────────────

/**
 * Simulate Monte Carlo paths of the HPDL coherence SDE.
 * V1.5.39: GARCH-in-Mean (delta) and jump-diffusion (Merton 1976) added.
 *
 * @param params  SDE parameters (uses SDE_PARAMS defaults if omitted)
 * @param T       Simulation horizon (turns × time step)
 * @param dt      Time step (default 0.02)
 * @param nPaths  Number of Monte Carlo paths (default 50)
 * @param seed    RNG seed for reproducibility (default 42)
 * @returns       Array of Float32Array paths
 */
export function simulateSDE(
  params: Partial<SDEParams> = {},
  T = 20,
  dt = 0.02,
  nPaths = 50,
  seed = 42
): Float32Array[] {
  const p: SDEParams = { ...SDE_PARAMS, ...params };
  const {
    alpha, beta_p, omega, sigma, kappa,
    delta = 0, jumpIntensity = 0, jumpMagnitude = 0,
  } = p;

  const lam = 1 / (1 + kappa);
  const nSteps = Math.ceil(T / dt);
  const rng = makeRng(seed);
  const paths: Float32Array[] = [];
  const jumpProb = 1 - Math.exp(-jumpIntensity * dt);
  let runVar = 0;

  for (let path = 0; path < nPaths; path++) {
    const arr = new Float32Array(nSteps + 1);
    arr[0] = 0;
    for (let i = 1; i <= nSteps; i++) {
      const t = i * dt;
      // GARCH-in-Mean: high variance pushes drift toward mean reversion
      const a_t = lam * (alpha + beta_p * Math.sin(omega * t) - delta * runVar);
      const b = lam * sigma;
      const noise = b * Math.sqrt(dt) * randn(rng);
      const jump = rng() < jumpProb
        ? (rng() > 0.5 ? 1 : -1) * jumpMagnitude
        : 0;
      arr[i] = arr[i - 1] + a_t * arr[i - 1] * dt + noise + jump;
      // Simple EWM variance for GARCH-in-Mean
      runVar = 0.85 * runVar + 0.15 * Math.pow(arr[i] - arr[i - 1], 2);
    }
    paths.push(arr);
  }
  return paths;
}

/**
 * Extract P10/P90 percentile band at a given simulation step.
 */
export function sdePercentilesAtStep(
  paths: Float32Array[],
  step: number
): SDEPercentiles {
  const vals = paths
    .map(p => p[Math.min(step, p.length - 1)])
    .sort((a, b) => a - b);
  const n = vals.length;
  return {
    p10: vals[Math.floor(n * 0.10)],
    p90: vals[Math.floor(n * 0.90)],
  };
}

// ── Kalman Filter ──────────────────────────────────────────────────

/**
 * Single Kalman filter update step.
 * V1.5.39: GARCH-in-Mean coupled via smoothedVar + delta.
 *
 * @param state       Current Kalman state {x, P}
 * @param obs         New coherence score observation
 * @param t           Current time (turn × 2π/12)
 * @param params      SDE parameters (for process model F)
 * @param kalR        Observation noise variance (default KALMAN_R)
 * @param kalSigP     Process noise std dev (default KALMAN_SIGMA_P)
 * @param smoothedVar Current GARCH variance (for GARCH-in-Mean, default 0)
 * @returns           Updated Kalman state
 */
export function kalmanStep(
  state: KalmanState,
  obs: number,
  t: number,
  params: Partial<SDEParams> = {},
  kalR = KALMAN_R,
  kalSigP = KALMAN_SIGMA_P,
  smoothedVar = 0
): KalmanState {
  const p: SDEParams = { ...SDE_PARAMS, ...params };
  const { alpha, beta_p, omega, kappa, delta = 0 } = p;
  const lam = 1 / (1 + kappa);
  // GARCH-in-Mean: variance reduces drift under high volatility
  const a_t = lam * (alpha + beta_p * Math.sin(omega * t) - delta * smoothedVar);
  const F = 1 + a_t;
  const Q = Math.pow(kalSigP * lam, 2);
  const x_p = F * state.x;
  const P_p = F * F * state.P + Q;
  const K = P_p / (P_p + kalR);
  return {
    x: x_p + K * (obs - x_p),
    P: (1 - K) * P_p,
  };
}

/**
 * Compute drift law floor — minimum coherence at turn n under harness mode.
 * ΔS = cap_eff × (1 − exp(−n^α_s / τ)) + |β_c · sin(γ_h · n · 0.01)| × 0.05
 */
export function driftLawFloor(
  n: number,
  gamma_h: number,
  epsilon = 0.05,
  alphaS = 1.8,
  betaC = 0.2
): number {
  const capEff = epsilon / (1 + gamma_h);
  const tau = Math.max(0.0225 / epsilon, 1);
  const sys = capEff * (1 - Math.exp(-Math.pow(Math.max(n, 0.001), alphaS) / tau));
  return sys + Math.abs(betaC * Math.sin(gamma_h * n * 0.01)) * 0.05;
}
