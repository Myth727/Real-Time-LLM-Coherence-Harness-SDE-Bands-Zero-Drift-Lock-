# ARCHITECT — Universal Coherence Engine

## Full-stack inference-time LLM stability layer

**Version 1.5.37** · © 2026 Hudson & Perry Research
**Authors:** David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede)) & David Perry ([@Prosperous727](https://x.com/Prosperous727))
**License:** MIT

> ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE.
> All outputs are mathematical proxy indicators. No warranty expressed or implied.
>
> **Active development:** Some features in the ⚗ Advanced tab are experimental and may have rough edges. The FEATURES, MATH, and DISPLAY tabs are stable on all devices.

---

## ▶ Run it now — 3 steps

No install. No server. Runs as a single Claude artifact.

**1. Download `ARCHITECT.jsx` from this repo**

**2. Open [claude.ai](https://claude.ai) and start a new conversation**

**3. Paste this:**

```
Create an artifact from this file. Run it exactly as-is.
[paste the full contents of ARCHITECT.jsx]
```

Open **TUNE** to select an industry preset, then start chatting. The engine monitors every response in real time.

---

## What ARCHITECT does

Per-turn TF-IDF + Jensen-Shannon coherence scoring, Kalman-smoothed trajectory tracking, GARCH(1,1) variance modeling, Monte Carlo SDE uncertainty bands, post-audit loop, behavioral and hallucination signal detection, and automatic corrective pipe injection — all running client-side in a single React artifact with no external dependencies.

Every response is scored, modeled, and fed back as corrective directives before the next turn. Drift is detected at three escalation levels. The harness adapts to your workflow via seven industry presets.

---

## Validated Features

| Feature | Description |
|---------|-------------|
| **Kalman Filter** | Time-varying smoothed coherence trajectory — most reliable signal |
| **GARCH(1,1) Variance** | Volatility clustering across sessions. Per-preset omega/alpha/beta |
| **TF-IDF + JSD Scoring** | 5-component weighted coherence score. All weights tunable |
| **Monte Carlo SDE Bands** | 50-path OU ensemble defines uncertainty band on chart |
| **SDE Path Visualization** | Live ensemble paths rendered on chart. Opacity tunable |
| **Post-Audit Loop** | Second coherence pass (LIGHT / FULL / CUSTOM threshold) |
| **Pipe Injection** | Corrective directives in every system prompt automatically |
| **Drift Gate** | Word-limit clamp at moderate/deep/extreme drift levels |
| **Mute Mode** | Token-cap trigger on high-variance or signal-heavy responses |
| **Behavioral Detection** | 6 proxies: sycophancy, hype, topic hijack, flooding, roleplay, elaboration |
| **Hallucination Detection** | 3 proxies with preset-aware thresholds |
| **Session Health** | 0–100 composite score with per-preset penalty weights |
| **Context Pruning** | Auto-trim context at threshold, keep most recent turns |
| **RAG Memory** | Retrieve-augment from session history, configurable top-K |
| **Session Rewind** | Restore any prior state from 20-turn rolling buffer |
| **Circuit Signal** | Live full adder pass rate from Poole CA Sim in sidebar |
| **Research Export** | CSV + JSONL per-turn metrics for offline analysis |

---

## Industry Presets

| Preset | Variance Tolerance | Best For |
|--------|-------------------|----------|
| DEFAULT | 0.200 / 0.120 / 0.080 | General use |
| TECHNICAL | 0.180 / 0.100 / 0.060 | Code, audits, engineering |
| CREATIVE | 0.280 / 0.160 / 0.100 | Writing, brainstorming |
| RESEARCH | 0.220 / 0.130 / 0.085 | Academic, long-form analysis |
| MEDICAL | 0.150 / 0.090 / 0.055 | High-stakes clinical/legal |
| **CIRCUIT** | **0.140 / 0.080 / 0.050** | **Logic verification, cascading reasoning** |
| CUSTOM | user-defined | Fully configurable |

Variance columns: decoherence / caution / calm thresholds.
CIRCUIT has the tightest settings of all presets — below even MEDICAL — built for logic verification workflows where AI reasoning chains must stay maximally consistent.

---

## Advanced / Experimental (opt-in, consent required)

All features below are behind an explicit unlock gate in **TUNE → ⚗ ADVANCED**. Labeled experimental. Not used in standard coherence scoring.

- **Alt SDE Models** — CIR (Cox-Ingersoll-Ross) or Heston stochastic volatility instead of HPDL OU
- **Custom Rails** — plain-language behavioral guidelines injected into every prompt
- **Stability Panel** — convergence sidebar tracking attractor math
- **Edit Constants** — tune the damping constant and stability anchor
- **MHT Study** — Metatron-Hudson Theory SDE: Robitaille Helix invariants, H_drift annihilator, DATL Heartbeat
- **Poole Manifold CA Sim** — 3D cellular automaton (B:5-7/S:5-9 default), live canvas, full adder 8/8 truth table

---

## Repository structure — a note

> This repo is actively being organized. The TypeScript SDK files are currently in the root of the main branch rather than in a `/sdk` folder — a known structural issue being corrected soon. `ARCHITECT.jsx` is always current and fully functional regardless of SDK folder structure.

---

## What's New — V1.5.37

- **API prefill bug fixed** — deep/extreme drift mode could produce an apiMessages array ending with `role:"assistant"`, causing a fatal API error. Now strips trailing assistant messages before every API call.
- **JSX Babel fixes** — template literals in two JSX attributes replaced with string concatenation.
- **pooleGen persisted** — CA generator counter now survives session reload.

See `CHANGELOG.md` for the complete version history (V1.3 → V1.5.37).

---

## SDK (TypeScript)

The math functions are available as a standalone TypeScript package with no UI dependencies.

```bash
git clone https://github.com/Myth727/ARCHITECT-Universal-Coherence-Engine
npm install && npm run build
```

```typescript
import { computeCoherence, kalmanStep, updateSmoothedVariance,
         buildPipeInjection, PRESETS } from './index';

const cfg    = PRESETS.CIRCUIT;
const score  = computeCoherence(response, history);
const newVar = updateSmoothedVariance(scoreHistory, prev, cfg);
const kalman = kalmanStep(state, score, turn * (2*Math.PI/12), SDE_PARAMS);
const pipe   = buildPipeInjection(newVar, kalman.x, kalman.P,
                 calmStreak, driftCount, 'audit', turn, 0, 0, null, cfg);
const systemPrompt = basePrompt + pipe;
```

**SDK files:** `constants.ts` · `coherence.ts` · `drift.ts` · `engine.ts` · `signals.ts` · `sde.ts` · `storage.ts` · `index.ts`

---

## Core Constants

```typescript
EPSILON  // 0.05   — minimum coherence floor
DAMPING  // 0.6925 — smoothing coefficient (1/(1+κ))
```

Advanced users can modify additional framework constants via **TUNE → ⚗ ADVANCED**. Non-default values operate outside the validated configuration.

---

## Citation

```
Perry, D. & Hudson, D. (2026). ARCHITECT: Universal Coherence Engine.
Hudson & Perry Research. @RaccoonStampede · @Prosperous727
```

---

*© 2026 Hudson & Perry Research — Experimental R&D. All outputs are proxy indicators.*
