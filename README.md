# ARCHITECT — Universal Coherence Engine

## Full-stack LLM coherence engine with AutoTune, feedback learning, and reflexive analysis. Monte Carlo SDE bands, Kalman, GARCH, per-turn scoring, signal detection, domain anchoring. V2.2 — paste into Claude or deploy on Vercel.

**V2.2** · © 2026 Hudson & Perry Research
**Authors:** David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede)) · David Perry ([@Prosperous727](https://x.com/Prosperous727))
**License:** MIT · [Live Demo](https://architect-universal-coherence-engin.vercel.app/)

> ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE.
> All outputs are mathematical proxy indicators. No warranty expressed or implied.

---

## There is one file: `ARCHITECT.jsx`

It runs two ways depending on how you use it.

---

## ▶ Option 1 — Paste into Claude (instant, no setup)

1. Download `ARCHITECT.jsx` from the root of this repo
2. Open [claude.ai](https://claude.ai) and start a new conversation
3. Paste: `Create an artifact from this file. Run it exactly as-is.` followed by the full file contents

Works immediately. No account, no server, no install.

---

## ▶ Option 2 — Deploy on Vercel (any browser, cross-session memory)

**Live demo:** [architect-universal-coherence-engin.vercel.app](https://architect-universal-coherence-engin.vercel.app/)

1. Fork this repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your fork
3. Vercel auto-detects Next.js → tap **Deploy**

No environment variables needed. Users provide their own API keys.

**Vercel adds:**
- Semantic coherence scoring — all-MiniLM-L6-v2 ONNX neural embeddings (~23MB, cached after first load)
- Unscented Kalman Filter (UKF) — sigma-point propagation for nonlinear dynamics
- Multi-provider — Anthropic, OpenAI, or Grok
- Cross-session persistence — pinned docs, feedback profiles, session memory survive browser restarts

---

## What ARCHITECT does

**Core monitoring engine:** Per-turn coherence scoring → Kalman-smoothed trajectory → GARCH(1,1) variance modeling → Monte Carlo SDE uncertainty bands → compressed pipe injection → post-audit loop → drift escalation → corrective directives.

**V2.2 intelligence layer:**

| Feature | What it does |
|---|---|
| **AutoTune** | Detects conversation context per turn (code/creative/analytical/conversational/chaotic), selects optimal temperature and sampling params automatically |
| **Feedback Loop** | +1/−1 thumbs per response. EMA learning personalizes AutoTune profiles. Persists across sessions. |
| **Reflexive Analysis** | Sends session coherence fingerprint to LLM → returns prioritized config suggestions |
| **Knowledge Anchors** | Domain vocabulary (Medical, Legal, Engineering, Finance, Research) calibrates drift detection to your field |
| **Persistent Doc Slots** | Pin up to 3 documents — injected every turn before harness content, never pruned, never forgotten |
| **Session Memory** | Auto-compresses history at turns 10/20/30 into a protected context slot. Solves long-session forgetfulness. |
| **META Panel** | Second AI chat with full ARCHITECT architecture + live session data embedded. Answers "why did coherence drop at turn 7" with exact values. |
| **Quick Tools Drawer** | CALC (SDE/GARCH parameter preview), VERIFY (15 live session checks), EXPORT (CSV/JSONL/TXT) |
| **Storage Unification** | All persistence through unified adapter: localStorage → window.storage → in-memory fallback. Safe in private mode and artifact sandbox. |

---

## Feature Comparison

| Feature | Claude artifact | Vercel |
|---|:---:|:---:|
| TF-IDF + JSD coherence scoring | ✓ | ✓ fallback |
| Semantic embeddings (all-MiniLM-L6-v2) | — | ✓ |
| Linear Kalman filter | ✓ | — |
| Unscented Kalman Filter (UKF) | — | ✓ |
| GARCH(1,1) + jump-diffusion | ✓ | ✓ |
| Monte Carlo SDE bands | ✓ | ✓ |
| AutoTune | ✓ | ✓ |
| Feedback loop (EMA learning) | ✓ | ✓ |
| Reflexive session analysis | ✓ | ✓ |
| Knowledge Anchors | ✓ | ✓ |
| Persistent Document Slots | ✓ session | ✓ cross-session |
| Strategic Session Memory | ✓ session | ✓ cross-session |
| META Panel | ✓ | ✓ |
| Quick Tools (CALC/VERIFY/EXPORT) | ✓ | ✓ |
| Display preferences (themes, font, compact) | ✓ | ✓ |
| H-signals + B-signals | ✓ | ✓ |
| Session rewind, RAG, bookmarks | ✓ | ✓ |
| Integrity Floor | ✓ | ✓ |
| Multi-provider (OpenAI, Grok) | — | ✓ |
| API key persistence | — | ✓ |
| Works without Claude account | — | ✓ |

---

## Industry Presets

| Preset | Dec / Cau / Calm | Best For |
|---|---|---|
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

- Alt SDE Models (CIR, Heston stochastic volatility)
- Custom behavioral rails
- Stability convergence panel (RESONANCE_ANCHOR = 623.81 Hz)
- Edit constants (κ, ε, GARCH params)
- MHT Study (Metatron-Hudson Theory SDE)
- Poole Manifold CA Simulator (3D cellular automaton, full adder verification)
- Integrity Floor (DRIFT vs INTEGRITY BREACH detection)

---

## SDK (TypeScript)

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

## Project Structure

```
ARCHITECT.jsx              ← paste into Claude
components/ARCHITECT.jsx   ← same file, used by Next.js
pages/api/proxy.ts         ← multi-provider proxy (Anthropic · OpenAI · Grok)
pages/index.tsx            ← Next.js entry
public/embedder.worker.js  ← neural embedding Web Worker (Vercel only)
sdk/*.ts                   ← TypeScript math library
.claude/evals/ARCHITECT_EVALS.md  ← 15-check release checklist
ai/knowledge/
  DIALOGUE_BASELINES.md        ← healthy session reference for all AI models
  HALLUCINATION_REFERENCE.md   ← H-signal proxy guide for all AI models
  ARCHITECT_CODING_RULES.md    ← coding invariants for any AI working on this repo
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
