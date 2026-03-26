# Hudson & Perry's Drift Law — ARCHITECT

## AI Coherence Harness · Real-Time LLM Monitoring

**Version 1.5.15** · © 2026 Hudson & Perry Research
**Authors:** David Hudson ([@RaccoonStampede](https://x.com/RaccoonStampede)) & David Perry ([@Prosperous727](https://x.com/Prosperous727))
**License:** MIT

> ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE.
> All outputs are mathematical proxy indicators. No warranty expressed or implied.

---

## ▶ Use it right now in Claude — 3 steps

The fastest way to run ARCHITECT is directly inside Claude as a single-file artifact. No installs, no setup, no account needed beyond Claude.

**1. Download `ARCHITECT.jsx` from this repo**

**2. Open [claude.ai](https://claude.ai) and start a new conversation**

**3. Paste this message:**

```
Create an artifact from this file. Run it exactly as-is.
[paste the full contents of ARCHITECT.jsx]
```

That's it. The full coherence harness — live chart, Kalman filter, GARCH variance, signal detection, pipe injection, presets, rewind — runs immediately in the artifact panel. Your API key is handled automatically by the Claude sandbox.

> **Tip:** Once running, open **TUNE** to pick an industry preset (TECHNICAL, CREATIVE, MEDICAL etc.), then start chatting. The harness monitors every response in real time.

---

## What this is

A real-time coherence monitoring engine for LLM conversations — a scientific instrument for studying AI drift. Every response is scored with TF-IDF + Jensen-Shannon Divergence, tracked with a Kalman filter, modeled with GARCH(1,1) variance, and fed back as corrective directives before the next turn.

Reviewed externally as *"top 1% of personal AI tooling — research-lab level inside a React app."*

**What it implements:**

- **SDE simulation** — Monte Carlo paths with LCG RNG (deterministic, reproducible)
- **Kalman filter** — time-varying, κ-damped, with dual-observation post-audit mode
- **GARCH(1,1) variance** — volatility clustering, per-preset tunable parameters
- **Coherence scoring** — TF-IDF + JSD + length / structure / persistence, tunable weights
- **Signal detection** — 6 behavioral proxies + 3 hallucination proxies with false-positive tracking
- **Drift Law** — ghost tax floor (ε=0.05), tunable epsilon, cap_eff, four escalation modes
- **Pipe injection** — `u_drift(t)` — the control layer injected into system prompts
- **RAG** — retrieve-augment from session history, configurable top-K
- **Session health** — 0–100 composite score with per-preset penalty weights
- **Industry presets** — DEFAULT / TECHNICAL / CREATIVE / RESEARCH / MEDICAL / CUSTOM
- **Storage polyfill** — works in Claude artifact sandbox, browser, or Node
- **Context architecture** — React.memo modal isolation, React Context state delivery

---

## SDK Install (for developers)

The TypeScript SDK exposes every math function independently — no UI, no React, importable into any project.

```bash
npm install hpdl-sdk
```

Or clone and build:

```bash
git clone https://github.com/Myth727/Real-Time-LLM-Coherence-Harness-SDE-Bands-Zero-Drift-Lock-
cd Real-Time-LLM-Coherence-Harness-SDE-Bands-Zero-Drift-Lock-
npm install
npm run build
```

---

## SDK Quick Start

```typescript
import {
  computeCoherence,
  kalmanStep,
  updateSmoothedVariance,
  assessBehavioralSignals,
  assessHallucinationSignals,
  buildPipeInjection,
  computeSessionHealth,
  SDE_PARAMS,
  KAPPA,
  EPSILON,
  PRESETS,
} from 'hpdl-sdk';

// Score a new AI response against conversation history
const score = computeCoherence(responseText, messages);

// Update Kalman filter (t_k in SDE time units)
const t_k = turn * (2 * Math.PI / 12);
const newKalman = kalmanStep(kalmanState, score, t_k, SDE_PARAMS);

// Update GARCH variance — pass active preset config for per-preset GARCH params
const cfg = PRESETS.TECHNICAL;
const newVar = updateSmoothedVariance(scoreHistory, smoothedVar, cfg);

// Detect signals
const behavioral = assessBehavioralSignals(responseText, userText, messages);
const hallucination = assessHallucinationSignals(responseText, newVar, attachments, messages);

// Build pipe injection — u_drift(t) for next system prompt
const pipe = buildPipeInjection({
  smoothedVar: newVar,
  kalmanX: newKalman.x,
  kalmanP: newKalman.P,
  calmStreak, driftCount,
  harnessMode: 'audit',
  turn,
  hSignalCount: 0,
  bSignalCount: 0,
});

// Inject into your system prompt before the next API call
const systemPrompt = basePrompt + pipe;
```

---

## Core Constants

All constants are exposed. The Hudson Constants are the framework identity:

```typescript
import { KAPPA, EPSILON, RESONANCE_ANCHOR, DAMPING } from 'hpdl-sdk';

KAPPA            // 0.444  — Hudson Constant. Drives all damping.
EPSILON          // 0.05   — Ghost tax floor. ~5% inefficiency in complex systems.
RESONANCE_ANCHOR // 623.81 — Hz. Zero-Drift Lock convergence target.
DAMPING          // 0.6925 — 1/(1+κ)
```

> κ, ε, and RESONANCE_ANCHOR are exposed and adjustable. They are the framework identity constants. Modifying them means departing from the published framework — outputs with non-default values carry no validation basis.

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

The TF-IDF component uses a 2-document IDF model: terms unique to one response get weight `log(2) ≈ 0.693`, shared terms get weight 0. This is intentional — it measures vocabulary shift, not overlap.

### `kalmanStep(state, obs, t, params?, kalR?, kalSigP?)`

Single Kalman filter update. Returns new `{ x, P }`.

### `kalmanDualStep(state, liveScore, postAuditScore, t, params?, kalR?, kalSigP?)`

Dual-filter: applies two observations per turn (live score + post-audit score). Tightens estimate when post-audit diverges from live.

### `simulateSDE(params?, T?, dt?, nPaths?, seed?)`

Monte Carlo SDE simulation. Returns `Float32Array[]` paths. Deterministic via LCG RNG with fixed seed.

### `updateSmoothedVariance(history, prev, cfg?)`

GARCH(1,1) blended with rolling window variance. Reads `cfg.garchOmega`, `cfg.garchAlpha`, `cfg.garchBeta` when provided — enabling per-preset GARCH tuning. Falls back to module-level defaults when cfg is omitted.

### `assessBehavioralSignals(responseText, userText, history)`

Returns `{ flagged, signals, questionCount, roleplays, sycophancies }`.

Detects: roleplay drift, sycophancy (2+ patterns), hype inflation (2+ patterns), question flooding (4+), topic hijack (TF-IDF < 5%), unsolicited elaboration.

### `assessHallucinationSignals(responseText, smoothedVar, attachments, history)`

Returns `{ flagged, signals, sourceScore, confidenceHits, contradiction }`.

Detects: high-confidence language + elevated variance, low source match (< 8%) vs attached documents, possible self-contradiction with prior turns.

### `buildPipeInjection(state)`

Returns the `[SYSTEM_INTERNAL — HUDSON & PERRY PIPE]` string for system prompt injection. This is `u_drift(t)` — the feedback control term that acts on the AI's next response without modifying the coherence measurement structure.

### `buildMuteInjection(cfg?)`

Returns mute directive string. Word limit = `Math.round(muteMaxTokens × 0.75)` — corrected from the original `÷8` calculation.

### `buildDriftGateInjection(smoothedVar, cfg?)`

Returns drift gate directive string. Empty string when variance is below caution threshold.

### `computeSessionHealth(coherenceData, driftCount, smoothedVar, calmStreak, lock888, cfg?)`

Returns **0–100** session health score. Penalty weights are read from `cfg` (healthDriftWeight, healthBSigWeight, healthHSigWeight) — enabling per-preset severity tuning.

### `driftLawCapEff(gamma_h, epsilon?)`

Cap efficiency for given harness mode. `epsilon` defaults to EPSILON (0.05) but is now a parameter — pass `mathEpsilon` for user-tuned values.

### `driftLawFloor(n, gamma_h, epsilon?)`

Drift Law floor value at turn `n` under harness mode `gamma_h`.

### `applyZeroDriftLock(cur, anchor?, maxIter?)`

Iterative convergence toward RESONANCE_ANCHOR. Returns `{ val, locked, iters, residual }`. Up to 200 iterations — call via useMemo in React contexts.

### `buildTermFreq(tokens)`

Canonical term frequency builder. Used internally by both `tfidfSimilarity` and `jensenShannonDivergence`. Filters stop words, normalizes by total count.

### `detectMuteMode(text, phrases?)`

Returns boolean. No internal USE_MUTE_MODE guard — caller is responsible for gating on feature toggle state.

### `storage`

Auto-detecting storage adapter. Tries `window.storage` (Claude artifact sandbox), falls back to `localStorage` (browser), then in-memory (Node). Matches the split-key design: `hpdl_config` for settings, `hpdl_data` for session metrics.

---

## Two-Level Architecture

```
STRUCTURAL LAYER (SDE + Drift Law)
  → defines where meaningful signal emerges in any complex system

CONTROL LAYER (Pipe injection = u_drift(t))
  → keeps the system in the coherent regime

  dψ/dt = F_system(ψ) + u_drift(t)

u_drift(t) acts on system evolution only.
It does not modify the coherence observable C
or its Kalman / GARCH measurement structure.
This is engineering feedback control — not physics rewriting.
```

---

## Industry Presets

The ARCHITECT tool ships with six preset configurations that tune all non-constant parameters:

| Preset | Use case | GARCH β | SDE α | Drift escalation |
|--------|----------|---------|-------|-----------------|
| DEFAULT | General | 0.80 | −0.25 | 3/5/8 |
| TECHNICAL | Code, audits | 0.83 | −0.30 | 3/5/8 |
| CREATIVE | Writing, narrative | 0.75 | −0.18 | 4/7/12 |
| RESEARCH | Academic, long-form | 0.82 | −0.22 | 4/6/10 |
| MEDICAL | High-stakes | 0.87 | −0.35 | 2/4/6 |
| CUSTOM | User-defined | any | any | any |

All preset values flow through `cfg` parameters in the SDK functions. Pass `PRESETS.MEDICAL` etc. to match the live tool's behavior exactly.

---

## ARCHITECT V1.5.13 — What's New Since V1.5.8

The ARCHITECT artifact (ARCHITECT.jsx) is the live React implementation. V1.5.9–V1.5.13 adds:

- **Math tunables persist** — coherence weights, Kalman R/SigP, SDE params, post-audit threshold all survive session reload (V1.5.13)
- **Typing bug resolved** — `onInput` + `onCompositionEnd` + guarded `setHasInput`. No more character jumping in the artifact iframe (V1.5.9)
- **cfg fully threaded** — `buildPipeInjection`, `assessHallucinationSignals`, `downloadResearch`, status bar, varColor all read preset thresholds. MEDICAL/CREATIVE etc. now behave correctly end-to-end (V1.5.9–V1.5.11)
- **cfg memoized** — `PRESETS[activePreset]` wrapped in `useMemo` — was rebuilding a new reference every render and invalidating `sendMessage` constantly (V1.5.11)
- **Rewind prev/next fixed** — both buttons now compare against actual buffer bounds, not hardcoded 1 or `turnSnapshots.length` (V1.5.10/V1.5.12)
- **Research CSV health corrected** — export now uses preset penalty weights, matching the live session health score (V1.5.12)
- **researchNotes uncontrolled** — textarea no longer triggers re-renders on every keystroke. beforeunload flush prevents notes from being lost (V1.5.9/V1.5.12)
- **ScoreBadge extracted** — stable component type above main component (V1.5.12)
- **liveSDEOverride, harnessChangeLog, cap_eff, contextPruned** — all memoized (V1.5.12/V1.5.13)
- **S styles memoized** — `useMemo([harnessMode])` (V1.5.9)
- **8 comment stubs cleaned** — all truncated `// V1.` stubs replaced with proper descriptions (V1.5.13)
- **React Context architecture** — TuneCtx and SessionCtx replace prop-drilling. Modal call sites are zero-prop (V1.5.8)

See `CHANGELOG.md` for the complete version history (V1.3 → V1.5.15).

---

## ARCHITECT_V158.pdf

The PDF document (`ARCHITECT_V1513.pdf`) contains:
- Full mathematical derivations
- Framework validation status
- R&D disclaimer and legal notice
- Citation guidance

---

## Citation

If you use this in published research:

```
Hudson, D. & Perry, D. (2026). Hudson & Perry's Drift Law — ARCHITECT V1.5.15.
Hudson & Perry Research. https://github.com/Myth727/Real-Time-LLM-Coherence-Harness-SDE-Bands-Zero-Drift-Lock-
@RaccoonStampede · @Prosperous727
```

---

## Related

- **ARCHITECT artifact** — paste `ARCHITECT.jsx` into a Claude artifact for the full live UI
- **FRAMEWORK.md** — mathematical derivations and validation status
- **CHANGELOG.md** — complete version history P1–P39+

---

*© 2026 Hudson & Perry Research — Experimental R&D. All outputs are proxy indicators.*
