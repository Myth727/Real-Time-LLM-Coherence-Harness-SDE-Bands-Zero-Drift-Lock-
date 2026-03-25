# Hudson & Perry's Drift Law — Framework Document

**Version 3.2 | V1.5.2 | © 2026 Hudson & Perry Research**  
David Perry (@Prosperous727) & David Hudson (@RaccoonStampede)

---

## Overview

Three connected tools sharing the Hudson Constant κ = 0.444:

1. **SDE Model** — tracks error dynamics over time
2. **Drift Law** — macro inefficiency auditor
3. **AI Coherence Harness (ARCHITECT)** — live implementation

---

## Two-Level Architecture

**STRUCTURAL LAYER** — defines where meaningful signal emerges.  
The SDE and Drift Law specify the location and nature of observable coherence phenomena in any complex system.

**CONTROL LAYER** — keeps the system in that regime.  
The harness acts as a bounded control term u_drift(t):

```
dψ/dt = F_system(ψ) + u_drift(t)
```

u_drift(t) acts on system evolution only. It does not modify the coherence observable O or its Jacobian structure. This is engineering feedback control — not a redefinition of the governing dynamics.

The pipe injection IS u_drift(t) in practice:

* Acts on system evolution (the AI's next response)
* Does not modify the coherence observable C
* Does not alter the Kalman or GARCH measurement structure

---

## Part 1 — Stochastic Differential Equation

```
dε(t) = a(t) ε(t) dt + b dW_t
a(t)  = (α + β_p · sin(ωt)) / (1 + κ)
b     = σ / (1 + κ)
```

**Locked parameters:**

* κ = 0.444 (Hudson Constant)
* α = −0.25 (mean-reversion)
* β_p = 0.18 (periodic forcing)
* ω = 2π/12 (12-step period)
* σ = 0.10 (diffusion)
* DAMPING = 1/(1+κ) = 0.6925

**Stability:** guaranteed when α < 0.  
β = 0 → Ornstein-Uhlenbeck process.  
β > 0 → OU extended with periodic forcing.

**GARCH(1,1) variance:**

```
σ²_t = ω + α_g · ε²_{t-1} + β_g · σ²_{t-1}
ω = 0.02 | α_g = 0.15 | β_g = 0.80
```

**Kalman filter:**

```
F   = 1 + a(t_k)
Q   = (KALMAN_SIGMA_P × λ)²
x̂  = x_p + K × (obs − x_p)
P   = (1 − K) × P_p
```

KALMAN_R = 0.015 | KALMAN_SIGMA_P = 0.06 | λ = 1/(1+κ)

---

## Part 2 — Drift Law

```
ΔS = cap_eff × (1 − exp(−n^α_s / τ))
   + |β_C × sin(γ_h × n × 0.01)| × 0.05

cap_eff = ε / (1 + γ_h)
```

* ε = 0.05 (ghost tax floor — ~5% inefficiency in complex systems)
* α_s = 1.8
* τ = max(0.0225/ε, 1)

**Modes:** AUDIT(γ=0.05) → MODERATE(50) → DEEP(5000) → EXTREME(10000)

---

## Part 3 — Coherence Scoring

```
C = 0.25 × TF-IDF + 0.25 × (1−JSD) + 0.25 × lenScore
  + 0.15 × struct + 0.10 × persist
  × repetitionPenalty

Floor: 0.30 | Ceiling: 0.99
```

* **TF-IDF:** cosine similarity on weighted term vectors
* **JSD:** Jensen-Shannon Divergence, bounded [0,1], symmetric. Chuang et al. 2024 (DoLa) confirms JSD as correct tool for semantic shift detection.
* **lenScore:** exp(−|newLen − avgLen| / avgLen × 2)
* **struct:** exp(−|newSents − avgSents| / avgSents × 1.5)
* **persist:** top-15 prior term overlap into new response
* **repPenalty:** 0.65 if overlap with last reply > 65%, else 1.0

---

## Part 4 — Signal Detection

**Hallucination Signals (H-SIG) — 3 proxies:**

1. High-confidence language (2+ markers) AND σ² > 0.120
2. Source consistency: TF-IDF < 8% vs attached documents
3. Self-contradiction: avg similarity < 15% vs last 6 related turns

**Behavioral Signals (B-SIG) — 6 proxies:**  
Research: Sharma et al. ICLR 2024 (Anthropic) — sycophancy as systematic RLHF behavior.

1. Roleplay drift
2. Sycophancy (2+ patterns)
3. Hype inflation (2+ patterns)
4. Question flooding (4+)
5. Topic hijack (TF-IDF < 5%)
6. Unsolicited elaboration (unrequested content OR > 2.5× avg length)

All signals are proxy indicators. Honest framing enforced.

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
4. **Attractor re-locking** — Zero-Drift Lock stabilizes the system near the resonance anchor

The pipe injection IS u_drift(t):

* Acts on system evolution (the AI's next response)
* Does not modify C
* Does not alter Kalman or GARCH measurement structure
* Engineering feedback control, not physics rewriting

---

## Validation Status

**Confirmed:** SDE math ✓ | Kalman ✓ | GARCH ✓ | TF-IDF+JSD ✓ | Pipe injection ✓ | Behavioral detection ✓

**Requires validation:** C-score vs human judgment | H-signal false positive rate | 623.81 Hz physical anchor

---

## V1.5.x Feature Log

* SDE paths: tunable 5–1000. Default 50. α/β_p/σ each independently editable with toggle.
* Post-audit: CUSTOM mode with user-set Kalman threshold.
* Human override scores: MY: field per turn, correlation with raw C exported.
* Session summary: 8-metric card, health, drift events, top mode.
* Meta-harness: auto-preset switching on session health.
* MATH tab: all 5 coherence weights editable, live sum warning.
* DISPLAY tab: dark/light theme, sidebar width slider.
* ARCHITECT panel: severity, source, hint, stack trace, COPY ALL.
* Export modal: CHAT/LOG/RESEARCH content with COPY ALL fallback.
* Dual Kalman: post-audit score as second observation.
* False positive feedback: FALSE+ button, correction dataset.
* SDE path export: Monte Carlo paths CSV for surrogate model training.
* Research notes: free-form, persisted, stamped on exports.
* window.storage two-key split (hpdl_config / hpdl_data).
* Session UUID stamped on all exports.
* Token estimate display.
* Industry presets (DEFAULT, TECHNICAL, CREATIVE, RESEARCH, MEDICAL/LEGAL, CUSTOM).
* 11 feature toggles.
* Mute phrase editor — custom phrases, persisted.
* Bookmark notes — annotation field per bookmark.
* Health penalty weights exposed per preset.
* Export toggle state included in session export block.
* Post-audit: Off / Light / Full modes. Quiet fail detection and logging.
* SDE path count tunable in TUNE: 10/25/50/100/150/200/250/300/500 + custom to 1000.

---

## V1.5.2 Patch Notes

Two silent persistence bugs fixed. No math changes. No behavior changes.

**Patch 1 — Version strings unified across all internal references**

Prior to this patch, three different version strings existed in the same file:
- Export block header: `V1.5.1`
- Framework content string: `Version 3.2 | V1.5.1`
- Guide content string: `Version 1.5`
- File header + system prompt: `V1.5.2`

All now read `V1.5.2`. Session exports stamped after this patch are unambiguously versioned.

**Patch 2 — Config save useEffect dependency array corrected**

Four state values were written into `hpdl_config` on every save but were absent from the `useEffect` dependency array:
- `nPaths`
- `postAuditMode`
- `customMutePhrases`
- `researchNotes`

Changes to these values would not trigger a config save until an unrelated state change occurred. In practice: custom mute phrase edits, post-audit mode selection, and path count changes could silently revert on session reload.

Fix: all four values added to the dep array. Config now saves immediately on any change to these fields.

---

*© 2026 David Perry & David Hudson — Experimental R&D. All outputs are proxy indicators.*
