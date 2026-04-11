# ARCHITECT — Universal Coherence Engine · Framework Document

**Version 3.6 | V1.5.43 | © 2026 Hudson & Perry Research**
David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)

---

## Overview

Three integrated layers sharing the damping constant κ = 0.444:

1. **SDE Model** — tracks error dynamics over time
2. **Drift Law** — macro inefficiency auditor
3. **AI Coherence Engine (ARCHITECT)** — live implementation

---

## Two-Level Architecture

**STRUCTURAL LAYER** — defines where meaningful signal emerges.
The SDE and Drift Law specify the location and nature of observable coherence phenomena in any complex system.

**CONTROL LAYER** — keeps the system in that regime.
The harness acts as a bounded control term u_drift(t):

```
dψ/dt = F_system(ψ) + u_drift(t)
```

u_drift(t) acts on system evolution only. It does not modify the coherence observable C or its Kalman/GARCH measurement structure. This is engineering feedback control — not a redefinition of the governing dynamics.

The pipe injection IS u_drift(t) in practice:

- Acts on system evolution (the AI's next response)
- Does not modify the coherence observable C
- Does not alter the Kalman or GARCH measurement structure

---

## Part 1 — Stochastic Differential Equation

```
dε(t) = a(t) ε(t) dt + b dW_t
a(t)  = (α + β_p · sin(ωt)) / (1 + κ)
b     = σ / (1 + κ)
```

**Locked parameters:**

- κ = 0.444 (Hudson Constant)
- α = −0.25 (mean-reversion)
- β_p = 0.18 (periodic forcing)
- ω = 2π/12 (12-step period)
- σ = 0.10 (diffusion)
- DAMPING = 1/(1+κ) = 0.6925

**Stability:** guaranteed when α < 0.
β = 0 → Ornstein-Uhlenbeck process.
β > 0 → OU extended with periodic forcing.

**GARCH(1,1) variance:**

```
σ²_t = ω_g + α_g · ε²_{t-1} + β_g · σ²_{t-1}
```

Default: ω_g = 0.02 | α_g = 0.15 | β_g = 0.80

As of V1.5.3, all three GARCH parameters are per-preset tunable. Industry presets specify their own ω_g/α_g/β_g values. The CUSTOM preset exposes all three in the TUNE panel. GARCH defaults apply when no cfg is provided.

**Kalman filter:**

```
F   = 1 + a(t_k)
Q   = (KALMAN_SIGMA_P × λ)²
x̂  = x_p + K × (obs − x_p)
P   = (1 − K) × P_p
```

KALMAN_R = 0.015 | KALMAN_SIGMA_P = 0.06 | λ = 1/(1+κ)

**Dual Kalman (V1.5.2+):** When post-audit mode is active, a second Kalman pass uses the post-audit score as a second observation per turn. This tightens the state estimate when post-audit diverges from the live score.

---

## Part 2 — Drift Law

```
ΔS = cap_eff × (1 − exp(−n^α_s / τ))
   + |β_C × sin(γ_h × n × 0.01)| × 0.05

cap_eff = ε / (1 + γ_h)
```

- ε = 0.05 (ghost tax floor — ~5% inefficiency in complex systems)
- α_s = 1.8
- τ = max(0.0225/ε, 1)

As of V1.5.3, ε is a parameter in both `driftLawCapEff` and `driftLawFloor`. The MATH tab in ARCHITECT exposes it as `mathEpsilon` (default 0.05). This threads through to the chart floor bands and cap_eff display. ε = 0.05 remains the published framework default — modifying it operates outside validated territory.

**Modes:** AUDIT(γ=0.05) → MODERATE(50) → DEEP(5000) → EXTREME(10000)

---

## Part 3 — Coherence Scoring

```
C = 0.25 × TF-IDF + 0.25 × (1−JSD) + 0.25 × lenScore
  + 0.15 × struct + 0.10 × persist
  × repetitionPenalty

Floor: 0.30 | Ceiling: 0.99
```

- **TF-IDF:** 2-document cosine similarity on weighted term vectors. IDF = log(2/df) where df ∈ {1, 2}. Terms shared by both responses get IDF = 0 (log(1) = 0). Terms unique to one response get IDF = log(2) ≈ 0.693. This is intentional — the component measures vocabulary shift, not overlap. Overlap is measured by JSD and persistence.
- **JSD:** Jensen-Shannon Divergence, bounded [0,1], symmetric. Chuang et al. 2024 (DoLa) confirms JSD as correct tool for semantic shift detection.
- **lenScore:** exp(−|newLen − avgLen| / avgLen × 2)
- **struct:** exp(−|newSents − avgSents| / avgSents × 1.5)
- **persist:** top-15 prior term overlap into new response
- **repPenalty:** 0.65 if overlap with last reply > threshold (default 0.65), else 1.0

All five coherence weights and the repetition threshold are tunable in the MATH tab as of V1.5.0.

---

## Part 4 — Signal Detection

**Hallucination Signals (H-SIG) — 3 proxies:**

1. High-confidence language (2+ markers) AND σ² > VAR_CAUTION (0.120 default)
2. Source consistency: TF-IDF < 8% vs attached text documents
3. Self-contradiction: avg similarity < 15% vs last 6 related turns

**Behavioral Signals (B-SIG) — 6 proxies:**
Research basis: Sharma et al. ICLR 2024 (Anthropic) — sycophancy as systematic RLHF behavior.

1. Roleplay drift (1+ roleplay pattern)
2. Sycophancy (2+ agreement/flattery patterns)
3. Hype inflation (2+ superlative patterns)
4. Question flooding (4+ question marks)
5. Topic hijack (TF-IDF < 5% vs user message)
6. Unsolicited elaboration (unrequested content patterns OR > 2.5× session avg length)

**False positive tracking (V1.5.2+):** The LOG modal renders a FALSE+ button on each signal event. User corrections are stored as a separate dataset and exported in RESEARCH CSV. Correction count shown in LOG header.

All signals are proxy indicators. Honest framing enforced throughout.

---

## Part 5 — Biological Anchor

~5.48% lower empathy network activity (fMRI, Lamm et al. 2011) maps to ε = 0.05 inefficiency floor — same constant appearing independently in neuroscience and computational drift modeling.

Cross-domain convergence, not causal claim.
Source: Hudson, D. (2026). *Quantum Moral Navigation.* KDP.

**EEG empirical reference (external, non-affiliated):**
Meditation EEG dataset ds001787 shows activation concentrated at S ≈ 0.54–0.62, coinciding with a measured sensitivity peak at S* ≈ 0.549. Consistent with the harness operating band. Informational only — not a claim of joint authorship.

---

## Part 6 — Control Layer Function

The harness component of u_drift(t) includes:

1. **Variance-sensitive damping** — GARCH + Kalman smoothing reduces excursions in high-variance regimes
2. **State estimation** — Kalman x̂ tracks coherence trajectory
3. **Bounded corrective forcing** — pipe injection directives prevent runaway divergence without overriding the model
4. **Attractor re-locking** — Zero-Drift Lock iteratively converges toward RESONANCE_ANCHOR (623.81 Hz)

The pipe injection IS u_drift(t):

- Acts on system evolution (the AI's next response)
- Does not modify C
- Does not alter Kalman or GARCH measurement structure
- Engineering feedback control, not physics rewriting

---

## Part 7 — Industry Presets

As of V1.5.0, all non-constant parameters are preset-configurable. Six presets ship with ARCHITECT:

| Preset | Purpose | GARCH β | SDE α | Health drift wt |
|--------|---------|---------|-------|----------------|
| DEFAULT | General | 0.80 | −0.25 | 8 |
| TECHNICAL | Code, audits, engineering | 0.83 | −0.30 | 10 |
| CREATIVE | Writing, brainstorming | 0.75 | −0.18 | 5 |
| RESEARCH | Academic, long-form | 0.82 | −0.22 | 8 |
| MEDICAL | High-stakes, clinical-adjacent | 0.87 | −0.35 | 12 |
| CUSTOM | User-defined, all params editable | any | any | any |

The meta-harness (V1.5.0+) can auto-switch presets based on session health — e.g. CREATIVE → TECHNICAL on variance spike. CUSTOM and MEDICAL are never auto-switched.

---

## Part 8 — Post-Audit

As of V1.5.0, ARCHITECT can run a second coherence pass after each response is generated:

- **OFF** — no second pass
- **LIGHT** — fires when Kalman x̂ < 0.70 (something already looked off)
- **FULL** — every turn
- **CUSTOM** — user-set Kalman threshold

Post-audit scores against `finalMessages` (full history including the new reply) vs. the live score which scores against `newMessages` (history before the reply). This gives a genuine second perspective.

**Quiet fail:** if post-audit C < live C by > 0.08, the turn is flagged in the event log and RESEARCH CSV. This catches cases where the model sounded confident but lost coherence on review.

The dual Kalman step applies post-audit score as a second observation when post-audit is active, tightening the state estimate.

---

## Validation Status

**Confirmed:**
- SDE math ✓
- Kalman filter ✓
- GARCH(1,1) ✓
- TF-IDF + JSD scoring ✓
- Pipe injection ✓
- Behavioral signal detection ✓
- Per-preset GARCH tuning ✓ (V1.5.3)
- Epsilon parameterization ✓ (V1.5.3)
- Post-audit dual Kalman ✓ (V1.5.2)
- Context architecture ✓ (V1.5.21)

**Requires validation:**
- C-score vs. human judgment correlation
- H-signal false positive rate
- 623.81 Hz physical anchor (RESONANCE_ANCHOR)
- Cross-domain applicability claims

---

## V1.5.3–V1.5.21 Additions

**V1.5.3**
- GARCH parameters now per-preset — `updateSmoothedVariance` takes cfg param
- Epsilon parameterized in `driftLawCapEff`/`driftLawFloor` — mathEpsilon tunable in MATH tab
- Snapshot lock888Achieved uses `cfg.lock888Streak` per preset (was hardcoded 5)
- hpdl_data save includes eventLog in deps — prevents post-rewind inconsistency
- Feature toggle fix — detectMuteMode, buildDriftGateInjection, buildPipeInjection internal constant guards removed; live feat states govern behavior

**V1.5.4**
- `input` removed from sendMessage dep array — read via inputValueRef (stops keystroke-triggered callback recreation)
- buildTfIdf + buildTermFreqDist merged into single `buildTermFreq` function
- 2-doc IDF design documented inline
- Mute word limit corrected: `cap × 0.75` (was `cap ÷ 8`)

**V1.5.5**
- `applyZeroDriftLock` and `exportBlock` wrapped in useMemo (200-iter loop no longer runs every render)
- URL.revokeObjectURL removed from removeAttachment (was no-op on data URIs)
- processFiles catch now logs console.error
- MATH tab ↺ reset buttons fixed — were setter(val), now setter(def)

**V1.5.6**
- Typing-in-textarea bug fixed — uncontrolled textarea, inputValueRef, hasInput boolean
- Light/daytime theme — THEME constant, 35 semantic tokens, full color pass
- 7 modal sub-components extracted from main render (1175 lines removed from render body)

**V1.5.7**
- Text contrast increased — all mid/dim/faint THEME tokens darkened
- resetSession clears textarea DOM, inputValueRef, hasInput
- Feature toggle OFF row background fixed (was near-black in light theme)
- JSX header stripped — patch history moved to CHANGELOG.md

**V1.5.21**
- React Context migration — TuneCtx (30+ tune params) and SessionCtx (session/modal state)
- Modal call sites reduced to zero-prop `<TuneModal />` etc.
- Context values memoized (useMemo) — modals only re-render when their slice of state changes
- Declaration order fix — context values placed after all useCallback declarations

---

## V1.5.2 Additions (retained for reference)

- SDE paths: tunable 5–1000. Default 50. α/β_p/σ each independently editable with toggle.
- Post-audit: CUSTOM mode with user-set Kalman threshold.
- Session summary: 8-metric card, health, drift events, top mode.
- Meta-harness: auto-preset switching on session health.
- MATH tab: all 5 coherence weights editable, live sum warning.
- ARCHITECT panel: severity, source, hint, stack trace, COPY ALL.
- Export modal: CHAT/LOG/RESEARCH content with COPY ALL fallback.
- Dual Kalman: post-audit score as second observation.
- False positive feedback: FALSE+ button, correction dataset.
- SDE path export: Monte Carlo paths CSV for surrogate model training.
- Research notes: free-form, persisted, stamped on exports.

---

*© 2026 David Hudson & David Perry — Experimental R&D. All outputs are proxy indicators.*
*𝕏 @RaccoonStampede · @Prosperous727*
