# Contributing to Hudson & Perry's Drift Law

Thank you for your interest. This is an active R&D project. Contributions are welcome in the following areas.

## Ways to Contribute

### 1. Validation Data
The most valuable contribution right now is empirical data.

- Run sessions with the harness and export RESEARCH CSVs
- Use the human override scoring (MY: field) to rate turns 0–1
- Export with ratings to get the correlation coefficient
- Share your session data (anonymized) as a GitHub issue or discussion

This directly addresses the open validation items:
- C-score vs human judgment correlation
- H-signal false positive rate in real sessions

### 2. Bug Reports
Open an issue with:
- Which version of the JSX you are using
- What you expected vs what happened
- The ARCHITECT log output if relevant (copy from the ARCHITECT modal)
- Session ID (shown in the SUMMARY card and all exports)

### 3. Mathematical Review
The framework is open for mathematical scrutiny.

- SDE stability analysis under different parameter regimes
- GARCH parameter sensitivity
- Coherence weight optimization
- Kalman R/σP tuning for different conversation domains

Open an issue tagged `[math]` with your analysis.

### 4. SDK Extensions
The SDK (`/sdk/src/`) is MIT licensed and modular. Each component is independently usable.

- Adding support for other LLM APIs (OpenAI, Grok, Gemini)
- Alternative coherence metrics
- Domain-specific signal detection patterns
- Storage adapters for different environments

Open a pull request with tests and documentation.

### 5. Preset Contributions
If you have tuned a CUSTOM preset that works well for a specific domain, share the parameter values as a GitHub discussion. Validated presets may be added to the DEFAULT preset library.

## What We Are Not Looking For

- Auto-adaptation of κ = 0.444 — this is the framework identity constant, not a hyperparameter
- Modifications that treat ε = 0.05 as a free parameter — it is the ghost tax floor
- Changes that remove the R&D disclaimer or imply clinical/legal validation

## Code Style

The JSX follows a single-file architecture by design. All logic lives in `ARCHITECT.jsx`. When proposing changes:

- Keep JSX structural changes minimal — wrap with `display:none` rather than conditional rendering where possible
- Avoid template literals inside the `S={}` styles object — use string concatenation instead
- Balance verification: `{` and `}` counts must match after any change
- Test in a Claude artifact before submitting

## Research Attribution

If you publish research using this framework or its data, please cite:

```
Perry, D. & Hudson, D. (2026). Hudson & Perry's Drift Law — ARCHITECT V1.5.2.
Hudson & Perry Research. github.com/Myth727/hudson-perry-drift-law
```

## Contact

Open a GitHub issue or reach out on X:
- @Prosperous727 (David Perry)
- @RaccoonStampede (David Hudson)

---

*All contributions are subject to the MIT License terms.*
