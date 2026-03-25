# HPDL SDK
## Hudson & Perry's Drift Law — AI Coherence Engine

**Version 1.5.1** · © 2026 Hudson & Perry Research  
**Authors:** David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede)) & David Perry ([@Prosperous727](https://x.com/Prosperous727))  
**License:** MIT  

> ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE.  
> All outputs are mathematical proxy indicators. No warranty expressed or implied.

---

## What this is

The mathematical engine extracted from the [ARCHITECT V1.5.1](https://github.com/hudson-perry/hpdl-sdk) artifact — the AI coherence harness built by Hudson & Perry. Every function used in the live tool is exposed here as a clean TypeScript package with zero UI dependencies.

**What it implements:**
- **SDE simulation** — Monte Carlo paths with LCG RNG (deterministic, reproducible)
- **Kalman filter** — time-varying, κ-damped, with dual-observation mode
- **GARCH(1,1) variance** — volatility clustering for AI response streams
- **Coherence scoring** — TF-IDF + JSD + length/structure/persistence
- **Signal detection** — 6 behavioral proxies + 3 hallucination proxies
- **Drift Law** — ghost tax floor, cap_eff, escalation modes
- **Pipe injection** — `u_drift(t)` — the control layer injected into system prompts
- **RAG** — retrieve-augment from session history
- **Session health** — 0–100 composite score
- **Storage polyfill** — works in Claude artifact sandbox, browser, or Node

---

## Install

```bash
npm install hpdl-sdk
```

Or clone and build:
```bash
git clone https://github.com/hudson-perry/hpdl-sdk
cd hpdl-sdk
npm install
npm run build
```

---

## Quick Start

```typescript
import {
  computeCoherence,
  kalmanStep,
  updateSmoothedVariance,
  assessBehavioralSignals,
  buildPipeInjection,
  computeSessionHealth,
  SDE_PARAMS,
  KAPPA,
  EPSILON,
} from 'hpdl-sdk';

// Score a new AI response against conversation history
const score = computeCoherence(responseText, messages);

// Update Kalman filter
const t_k = turn * (2 * Math.PI / 12);
const newKalman = kalmanStep(kalmanState, score, t_k, SDE_PARAMS);

// Update variance
const newVar = updateSmoothedVariance(scoreHistory, smoothedVar);

// Detect behavioral signals
const behavioral = assessBehavioralSignals(responseText, userText, messages);

// Build pipe injection for next prompt
const pipe = buildPipeInjection({
  smoothedVar: newVar,
  kalmanX: newKalman.x,
  kalmanP: newKalman.P,
  calmStreak, driftCount,
  harnessMode: 'audit',
  turn, hSignalCount: 0, bSignalCount: 0,
});

// Inject into your system prompt
const systemPrompt = basePrompt + pipe;
```

---

## Core Constants

All constants are exposed. The Hudson Constants are the framework identity:

```typescript
import { KAPPA, EPSILON, RESONANCE_ANCHOR, DAMPING } from 'hpdl-sdk';

KAPPA            // 0.444  — Hudson Constant. Drives all damping.
EPSILON          // 0.05   — Ghost tax floor. ~5% inefficiency.
RESONANCE_ANCHOR // 623.81 — Hz. Zero-Drift Lock target.
DAMPING          // 0.6925 — 1/(1+κ)
```

> κ, ε, and RESONANCE_ANCHOR are exposed and changeable. They are the framework identity — modify them only if you understand what you are doing and acknowledge you are departing from the published framework.

---

## API Reference

### `computeCoherence(newContent, history, weights?, repThreshold?)`
Scores a new response against conversation history.  
Returns a score in **[0.30, 0.99]**.

```typescript
const score = computeCoherence(
  responseText,
  messages,
  { tfidf: 0.25, jsd: 0.25, length: 0.25, structure: 0.15, persistence: 0.10 },
  0.65 // repetition penalty threshold
);
```

### `kalmanStep(state, obs, t, params?, kalR?, kalSigP?)`
Single Kalman filter update. Returns new `{ x, P }`.

### `kalmanDualStep(state, liveScore, postAuditScore, t, ...)`
Dual-filter: two observations per turn (live + post-audit).

### `simulateSDE(params?, T?, dt?, nPaths?, seed?)`
Monte Carlo SDE simulation. Returns `Float32Array[]` paths.

### `updateSmoothedVariance(history, prev)`
GARCH(1,1) blended with rolling window variance.

### `assessBehavioralSignals(responseText, userText, history)`
Returns `{ flagged, signals, questionCount, roleplays, sycophancies }`.

### `assessHallucinationSignals(responseText, smoothedVar, sourceTexts, history)`
Returns `{ flagged, signals, sourceScore, confidenceHits, contradiction }`.

### `buildPipeInjection(state)`
Returns the `[SYSTEM_INTERNAL — HUDSON & PERRY PIPE]` string for system prompt injection.

### `computeSessionHealth(coherenceData, driftCount, smoothedVar, calmStreak, lock888, cfg?)`
Returns **0–100** session health score.

### `driftLawFloor(n, gamma_h)`
Drift Law floor value at turn `n` under harness mode `gamma_h`.

### `applyZeroDriftLock(cur, anchor?, maxIter?, ...)`
Iterative convergence toward RESONANCE_ANCHOR.

### `storage`
Auto-detecting storage adapter. Works in Claude artifact sandbox (`window.storage`), browser (`localStorage`), or Node (in-memory).

---

## Two-Level Architecture

```
STRUCTURAL LAYER (SDE + Drift Law)
  → defines where meaningful signal emerges

CONTROL LAYER (Pipe injection = u_drift(t))
  → keeps the system in that regime

  dψ/dt = F_system(ψ) + u_drift(t)

u_drift(t) acts on system evolution only.
It does not modify the coherence observable C
or its Kalman/GARCH measurement structure.
```

---

## Citation

If you use this in published research:

```
Hudson, D. & Perry, D. (2026). Hudson & Perry's Drift Law — ARCHITECT V1.5.1.
Hudson & Perry Research. @RaccoonStampede · @Prosperous727
```

---

## Related

- **ARCHITECT artifact** — full React UI with live coherence dashboard
- **Framework document** — mathematical derivations (available in-app via GUIDE → FRAMEWORK)
- **Research exports** — CSV + JSONL session data for surrogate model training

---

*© 2026 Hudson & Perry Research — Experimental R&D. All outputs are proxy indicators.*
