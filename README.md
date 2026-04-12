# ARCHITECT — Universal Coherence Engine

## Full-stack inference-time LLM stability layer

**V2.0** · © 2026 Hudson & Perry Research
**Authors:** David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede)) & David Perry ([@Prosperous727](https://x.com/Prosperous727))
**License:** MIT

> ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE.
> All outputs are mathematical proxy indicators. No warranty expressed or implied.

---

## There is one file: `ARCHITECT.jsx`

It runs two ways depending on how you use it.

---

## ▶ Option 1 — Paste into Claude (instant, no setup)

**1. Download `ARCHITECT.jsx` from the root of this repo**

**2. Open [claude.ai](https://claude.ai) and start a new conversation**

**3. Paste this:**

```
Create an artifact from this file. Run it exactly as-is.
[paste the full contents of ARCHITECT.jsx]
```

Works immediately. No account, no server, no install.

**What you get:** Full ARCHITECT with TF-IDF + JSD coherence scoring, Kalman filter, GARCH, SDE bands, all signal detection, all presets, all sidebar features, session rewind, research export.

---

## ▶ Option 2 — Deploy on Vercel (full V2.0, any browser)

**Live demo:** [architect-coherence-engine.vercel.app](https://architect-coherence-engine-exaly2fuv.vercel.app)
*(Replace this URL with your own deployment URL)*

The same `ARCHITECT.jsx` is used here — it lives at `components/ARCHITECT.jsx` inside the Next.js project. Vercel activates the extra V2.0 features that require a server and Web Worker.

**What you get on top of Option 1:**
- **Semantic coherence scoring** — all-MiniLM-L6-v2 neural embeddings replace TF-IDF. Meaning-based, not word-based. Loads once (~23MB), cached in your browser forever after.
- **Unscented Kalman Filter (UKF)** — handles nonlinear drift dynamics more accurately
- **Multi-provider** — use Anthropic, OpenAI, or Grok API keys
- **Key persistence** — your API key saved in your browser. Type it once, remembered.
- **Works on any device** — no Claude account needed

### Deploy your own instance

1. Fork this repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your fork
3. Vercel auto-detects Next.js — tap **Deploy**
4. No environment variables needed — users provide their own API keys

### V2.0 project structure

```
ARCHITECT.jsx              ← root copy — paste this into Claude
components/
  ARCHITECT.jsx            ← same file, used by Next.js
pages/
  index.tsx                ← mounts the app
  api/
    proxy.ts               ← API proxy (Anthropic · OpenAI · Grok)
public/
  embedder.worker.js       ← neural embedding worker
sdk/
  *.ts                     ← TypeScript math library
```

---

## What ARCHITECT does

Per-turn coherence scoring, Kalman-smoothed trajectory tracking, GARCH(1,1) variance modeling with jump-diffusion, Monte Carlo SDE uncertainty bands, post-audit loop, behavioral and hallucination signal detection, EWMA trend tracking, semantic anchor distance monitoring, Integrity Floor breach detection, and automatic corrective pipe injection — running client-side in Option 1, or as a full production deployment in Option 2.

---

## Validated Features

| Feature | Option 1 (Claude) | Option 2 (Vercel) |
|---------|:-----------------:|:-----------------:|
| TF-IDF + JSD coherence scoring | ✓ | ✓ (fallback) |
| Semantic embeddings (all-MiniLM-L6-v2) | — | ✓ |
| Linear Kalman filter | ✓ | — |
| Unscented Kalman Filter (UKF) | — | ✓ |
| GARCH(1,1) + jump-diffusion | ✓ | ✓ |
| Monte Carlo SDE bands | ✓ | ✓ |
| EWMA + Anchor chart lines | ✓ | ✓ |
| Momentum + Anchor dist sidebar | ✓ | ✓ |
| Behavioral + hallucination detection | ✓ | ✓ |
| Session health, rewind, RAG | ✓ | ✓ |
| Integrity Floor (V1.5.42) | ✓ | ✓ |
| Framework Mode HUDSON/STANDARD | ✓ | ✓ |
| Multi-provider (OpenAI, Grok) | — | ✓ |
| API key persistence | — | ✓ |
| Works without Claude account | — | ✓ |

---

## Industry Presets

| Preset | Dec / Cau / Calm | Best For |
|--------|-----------------|----------|
| DEFAULT | 0.200 / 0.120 / 0.080 | General use |
| TECHNICAL | 0.180 / 0.100 / 0.060 | Code, audits, engineering |
| CREATIVE | 0.280 / 0.160 / 0.100 | Writing, brainstorming |
| RESEARCH | 0.220 / 0.130 / 0.085 | Academic, long-form analysis |
| MEDICAL | 0.150 / 0.090 / 0.055 | High-stakes clinical/legal |
| **CIRCUIT** | **0.140 / 0.080 / 0.050** | **Logic verification** |
| CUSTOM | user-defined | Fully configurable |

---

## Advanced / Experimental (opt-in, consent required)

All behind **TUNE → ⚗ ADVANCED**. Labeled experimental.

- **Alt SDE Models** — CIR or Heston stochastic volatility
- **Custom Rails** — behavioral guidelines injected into every prompt
- **Stability Panel** — convergence tracking toward RESONANCE_ANCHOR
- **Edit Constants** — tune κ (0.00–5.00), live λ=1/(1+κ) display
- **MHT Study** — Metatron-Hudson Theory SDE module
- **Poole Manifold CA Sim** — 3D cellular automaton, full adder truth table
- **Integrity Floor** — DRIFT vs INTEGRITY BREACH threshold detection

---

## SDK (TypeScript)

Math functions available as a standalone package. Files in `sdk/`.

```typescript
import { computeCoherence, kalmanStep, updateSmoothedVariance,
         buildPipeInjection, PRESETS } from './sdk/index';

const cfg    = PRESETS.CIRCUIT;
const score  = computeCoherence(response, history);
const newVar = updateSmoothedVariance(scoreHistory, prev, cfg);
const kalman = kalmanStep(state, score, turn * (2*Math.PI/12), SDE_PARAMS);
const pipe   = buildPipeInjection(newVar, kalman.x, kalman.P,
                 calmStreak, driftCount, 'audit', turn, 0, 0, null, cfg);
```

---

## Citation

```
Perry, D. & Hudson, D. (2026). ARCHITECT: Universal Coherence Engine.
Hudson & Perry Research. @RaccoonStampede · @Prosperous727
github.com/Myth727/ARCHITECT-Universal-Coherence-Engine
```

---

*© 2026 Hudson & Perry Research — Experimental R&D. All outputs are proxy indicators.*
