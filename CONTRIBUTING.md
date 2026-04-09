# Contributing to ARCHITECT
*Version 1.5.39*

Thank you for your interest in contributing to ARCHITECT — a universal coherence engine built on top of Claude.

## What this project is

ARCHITECT is an active R&D project. The core (PRESETS, FEATURES, MATH tabs) is stable. The ⚗ Advanced tab contains experimental, unvalidated features clearly labeled as such. Contributions to either layer are welcome.

## How to contribute

**Bug reports** — Open an issue describing the behavior, the version (shown in TUNE modal footer), the device and browser, and steps to reproduce.

**Feature suggestions** — Open an issue with the label `enhancement`. Describe the use case, not just the feature.

**Code contributions** — Fork the repo, make your changes, open a pull request. Keep changes surgical — one concern per PR.

**SDK improvements** — The TypeScript SDK files are in the root of main (pending reorganization into `/sdk`). If you improve the math, update both the `.ts` file and the corresponding function in `ARCHITECT.jsx`.

## Framing guidelines

- **Standard features** (PRESETS, FEATURES, MATH tabs): claims must be supported by the math or by observable behavior.
- **Advanced/experimental features**: clearly label as experimental. Do not promote experimental results as validated findings.
- **Constants** (damping, stability anchor): these are framework identity values. Modifications belong in the Advanced tab, clearly labeled.

## What we're looking for

- Performance improvements (render optimization, memoization)
- Mobile UX improvements (Samsung Android, iOS Safari)
- New validated coherence metrics
- Better RAG retrieval strategies
- Standalone deploy path (Vercel / Next.js)
- SDK test coverage
- G0DM0D3 / Hermes Agent integration research
- Poole Manifold CA extensions (3D rendering, larger grid sizes, animated step mode)
- Circuit Benchmark improvements (additional logic gate tests beyond full adder)
- MHT Study extensions (additional SDE models, empirical validation against real data)

## What we're not looking for right now

- Changes that remove experimental warning banners in the Advanced tab
- Claims that any experimental feature has been empirically validated without data
- Breaking changes to the hpdl_config storage schema without a migration path

## Code style

- Single file for the artifact (`ARCHITECT.jsx`) — no splitting
- Surgical patches — read the surrounding code before touching anything
- Version bump in the file header on any functional change
- Comment any non-obvious math

## Contact

X: @RaccoonStampede (David Hudson) · @Prosperous727 (David Perry)

MIT Licensed — fork freely.
