# Hudson & Perry's Drift Law — ARCHITECT V1.5.2

**A real-time mathematical control layer for AI conversation coherence.**

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.2-orange.svg)]()
[![Status](https://img.shields.io/badge/status-R%26D-yellow.svg)]()

> ⚠ **Research & Development** — All outputs are mathematical proxy indicators only.  
> Not for clinical or legal use. No warranty expressed or implied.

**Authors:** David Perry ([@Myth727](https://github.com/Myth727) · [@Prosperous727](https://x.com/Prosperous727)) & David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede))  
**© 2026 Hudson & Perry Research**

---

## What This Is

Every AI conversation drifts. Not sometimes — every time, given enough turns. The model has no persistent awareness of its own coherence across turns. It does not know it is drifting.

The standard industry response is a post-processing filter — a second AI that reads the first AI's output after generation and classifies it. Reactive. Expensive. The mistake is already made.

**ARCHITECT is a real-time mathematical control layer.** It monitors every response, scores it across five dimensions, tracks the trajectory using a Kalman filter, models variance with GARCH(1,1), detects behavioral and hallucination signals, and injects corrective directives into the system prompt before the next response is generated.

Not a filter. A co-pilot.

Runs entirely client-side. No backend. No server. No database. 17 distinct mathematical modeling components in a single browser file.

---

## Quick Start

**Requirements:** An Anthropic API key. A browser.

1. Download `ARCHITECT.jsx`
2. Drop it into a React project (Vite recommended) with `recharts` installed
3. Enter your API key in the UI
4. Start chatting — the harness activates automatically

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install recharts
# replace src/App.jsx content with ARCHITECT.jsx content
npm run dev
```

Or use it directly as a Claude artifact — paste the JSX into the artifact editor and it runs immediately in the sandbox.

---

## The Mathematics

### Coherence Score

```
C = 0.25 × TF-IDF
  + 0.25 × (1 − JSD)
  + 0.25 × length score
  + 0.15 × structure score
  + 0.10 × persistence score
  × repetition penalty

Floor: 0.30 · Ceiling: 0.99
```

All weights are tunable in the MATH tab and wired directly into the live computation.

**JSD (Jensen-Shannon Divergence)** is the most sensitive component. Symmetric, bounded [0,1], confirmed by Chuang et al. 2024 (DoLa) as the correct tool for semantic drift detection in LLMs.

### Stochastic Differential Equation

```
dε(t) = a(t) ε(t) dt + b dW_t

a(t) = (α + β_p · sin(ωt)) / (1 + κ)
b    = σ / (1 + κ)
```

| Parameter | Value | Role |
|-----------|-------|------|
| κ | 0.444 | Hudson Constant — drives all damping. Never adapted. |
| α | −0.25 | Mean-reversion. Negative guarantees stability. |
| β_p | 0.18 | Periodic forcing amplitude. |
| ω | 2π/12 | Forcing frequency (12-step period). |
| σ | 0.10 | Base diffusion coefficient. |
| DAMPING | 0.6925 | 1/(1+κ) |

50 Monte Carlo paths simulated per session (tunable 5–1000). p10/p90 envelope forms the uncertainty band on the live chart. Score below lower band = statistically significant drift event.

### Kalman Filter

```
F   = 1 + a(t_k)
Q   = (KALMAN_SIGMA_P × λ)²
x̂  = x_p + K × (obs − x_p)
P   = (1 − K) × P_p
K   = P_p / (P_p + KALMAN_R)
λ   = 1/(1+κ) = 0.6925
```

The smoothed estimate x̂ is the primary drift detection signal. When post-audit is active, a dual-filter pass runs — post-audit score feeds back as a second Kalman observation in the same step.

### GARCH(1,1) Variance

```
σ²_t = ω + α_g × ε²_{t-1} + β_g × σ²_{t-1}
ω = 0.02 · α_g = 0.15 · β_g = 0.80
```

High β_g (0.80) means once variance rises it tends to stay elevated — matching observed AI behavior where one off-topic response tends to precede several more.

### Drift Law

```
ΔS = cap_eff × (1 − exp(−n^α_s / τ)) + |β_C × sin(γ_h × n × 0.01)| × 0.05
cap_eff = ε / (1 + γ_h)
ε = 0.05  (ghost tax floor)
```

| Mode | γ_h | Behavior |
|------|-----|----------|
| AUDIT | 0.05 | Detection only |
| MODERATE | 50 | Light correction |
| DEEP CLEAN | 5,000 | Every claim traces to context |
| EXTREME | 10,000 | One claim at a time |

### The Hudson Constants

**κ = 0.444** — The Hudson Constant. Applied to every damping calculation. Not a hyperparameter. The identity of the system.

**ε = 0.05** — The ghost tax floor. ~5% irreducible inefficiency in complex systems. Appears independently in computational drift modeling and neuroscience literature (Lamm et al. 2011, fMRI). Cross-domain convergence — not a causal claim.

---

## Signal Detection

### Hallucination Signals (H-SIG) — 3 proxies

| Proxy | Trigger |
|-------|---------|
| High-confidence language + elevated variance | 2+ certainty markers (definitely, proven, guaranteed, I can confirm...) with σ² > 0.120 |
| Source inconsistency | TF-IDF match < 8% between response and attached documents |
| Self-contradiction | Avg similarity < 15% vs 6 most related prior turns |

### Behavioral Signals (B-SIG) — 6 proxies

Research basis: Sharma et al. ICLR 2024 (Anthropic) — sycophancy confirmed as systematic RLHF behavior.

| Proxy | Trigger |
|-------|---------|
| Roleplay drift | 1+ roleplay pattern match |
| Sycophancy | 2+ flattery patterns |
| Hype inflation | 2+ superlative patterns |
| Question flooding | 4+ question marks |
| Topic hijack | TF-IDF similarity < 5% between prompt and response |
| Unsolicited elaboration | Unrequested content OR response > 2.5× session average length |

All signals are proxy indicators. Every firing is logged. False positives can be marked directly in the ARCHITECT panel — building a personal correction dataset.

---

## Two-Level Architecture

```
STRUCTURAL LAYER — defines where meaningful signal emerges
  SDE + Drift Law specify the stable operating regime

CONTROL LAYER — keeps the system in that regime
  dψ/dt = F_system(ψ) + u_drift(t)
```

`u_drift(t)` (the pipe injection) acts on system evolution only. It does not modify the coherence observable or the Kalman/GARCH measurement structure. The empirical measurements remain valid regardless of control layer behavior.

---

## Features

### Harness

- **Auto-escalation** — 3/5/8 drift events → MODERATE/DEEP/EXTREME. Auto de-escalation when score recovers.
- **Meta-harness** — auto-switches presets based on session health (CREATIVE→TECHNICAL on variance spike, etc.)
- **6 industry presets** — DEFAULT, TECHNICAL, CREATIVE, RESEARCH, MEDICAL/LEGAL, CUSTOM
- **11 feature toggles** — Kalman, GARCH, SDE bands, RAG, Pipe, Mute, Gate, B-Sig, H-Sig, Pruning, Zero-Drift

### TUNE Modal (4 tabs)

- **PRESETS** — full parameter exposure per profile
- **FEATURES** — feature toggles, SDE α/β_p/σ editable, post-audit CUSTOM threshold
- **MATH** — all 5 coherence weights editable, live sum display, Kalman R/σP/RAG/tokens wired to live math
- **DISPLAY** — dark/light theme, chat panel width 30–70%

### Exports

| Export | Contents |
|--------|----------|
| CHAT | Full conversation + per-turn audit table |
| ARCHITECT LOG | JSONL event log |
| RESEARCH | CSV metrics + JSONL bundle |
| SDE PATHS | Monte Carlo paths for surrogate model training |

### Research Tools

- **Human override scores** — rate any turn 0–1, persisted to storage
- **Session summary** — 8-metric card with health, drift events, signal counts
- **Correlation coefficient** — your ratings vs raw C score (validation instrument)
- **Export with ratings** — RESEARCH CSV + override scores + r value
- **False positive marking** — FALSE+ button on every signal entry
- **Research notes** — free-form text, stamped on exports, persists across resets
- **Bookmarks** — annotate any turn, copy all notes in one click

---

## Validation Status

### Confirmed (mathematically)
SDE · Kalman · GARCH · TF-IDF + JSD · Pipe injection · Behavioral signals · Hallucination signals · Context pruning · RAG · Session health · Meta-harness · Post-audit dual-filter · Adaptive sigma · Zero-Drift Lock

### External review (independent AI systems)
> "The SDE + Kalman + GARCH triad is mathematically rigorous. JSD is the killer feature — proven to catch semantic drift better than KL divergence or cosine similarity. Top 1% of public AI tooling."

> "17 distinct modeling components. No public equivalent combines this many live mathematical models with active steering and human validation in a single client-side wrapper."

### Literature
- Chuang et al. 2024 (DoLa) — confirms JSD for semantic drift detection in LLMs
- Sharma et al. ICLR 2024 (Anthropic) — sycophancy as systematic RLHF behavior
- EEG dataset ds001787 — biological activation at S ≈ 0.54–0.62 overlaps framework operating band

### Requires independent validation
- [ ] C-score correlation with human judgment ← measurement instrument built into the tool
- [ ] H-signal false positive rate ← false positive logging built into the tool
- [ ] Side-by-side A/B: harness on vs off, same prompts, logged

---

## SDK

The mathematical engine is available as a standalone TypeScript package.

```bash
# Coming to npm — currently available from this repo
cd sdk/
npm install
npm run build
```

```typescript
import { computeCoherence, kalmanStep, buildPipeInjection, KAPPA, EPSILON } from './sdk/src';

const score  = computeCoherence(response, history);
const kalman = kalmanStep(state, score, turn * (2 * Math.PI / 12), SDE_PARAMS);
const pipe   = buildPipeInjection({ smoothedVar, kalmanX: kalman.x, ... });
const system = basePrompt + pipe;
```

MIT licensed. Every constant exposed. Not Claude-specific — works with any LLM API.

---

## Repository Structure

```
hudson-perry-drift-law/
├── ARCHITECT.jsx          # Full working application (React/JSX)
├── sdk/                   # TypeScript SDK — hpdl-sdk v1.5.1
│   └── src/
│       ├── constants.ts
│       ├── sde.ts
│       ├── coherence.ts
│       ├── drift.ts
│       ├── signals.ts
│       ├── engine.ts
│       ├── storage.ts
│       └── index.ts
├── docs/
│   ├── ARCHITECT_V152.pdf  # Full source PDF with session notes
│   └── FRAMEWORK.md        # Mathematical framework document
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

## Citation

If you use this in published research:

```
Perry, D. & Hudson, D. (2026). Hudson & Perry's Drift Law — ARCHITECT V1.5.2.
Hudson & Perry Research. github.com/Myth727/hudson-perry-drift-law
@Prosperous727 · @RaccoonStampede
```

---

## License

MIT — see [LICENSE](LICENSE) for full terms.

The Hudson Constants (κ = 0.444, ε = 0.05, RESONANCE_ANCHOR = 623.81) are the framework identity constants published by Hudson & Perry Research (2026). Attribution appreciated when used in published research.

---

*© 2026 Hudson & Perry Research — Experimental R&D. All outputs are proxy indicators. Not for clinical or legal use.*
