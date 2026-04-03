# ARCHITECT — Universal Coherence Engine · GitHub Setup
*Version 1.5.37*

## Quick Start (Artifact — no install needed)

1. Download `ARCHITECT.jsx` from this repo
2. Open [claude.ai](https://claude.ai) and start a new conversation
3. Paste: `Create an artifact from this file. Run it exactly as-is.` followed by the full file contents

The harness runs immediately in the Claude artifact panel. No build step, no dependencies.

## SDK — Local Development

```bash
git clone https://github.com/Myth727/ARCHITECT-Universal-Coherence-Engine
cd ARCHITECT-Universal-Coherence-Engine
npm install
npx tsc
```

**Note:** SDK files are currently in the root of the main branch pending reorganization into `/sdk`.

## SDK Files

| File | Purpose |
|------|---------|
| `constants.ts` | Framework constants, preset configs, SDE params |
| `coherence.ts` | TF-IDF + JSD scoring, tokenization, RAG |
| `drift.ts` | Drift law math, stability convergence |
| `engine.ts` | Pipe injection, gate injection, mute injection |
| `signals.ts` | Behavioral + hallucination signal detection |
| `index.ts` | Public API surface — import from here |
| `sde.ts` | SDE simulation (Monte Carlo paths) |
| `storage.ts` | Session persistence helpers |

## Presets

DEFAULT · TECHNICAL · CREATIVE · RESEARCH · MEDICAL · **CIRCUIT** · CUSTOM

**CIRCUIT** is tuned for logic verification and cascading AI reasoning chains — tightest variance tolerance, most aggressive drift escalation, highest health penalty weights.

## Validated Features

- Kalman filter (time-varying, κ-damped)
- GARCH(1,1) variance modeling
- TF-IDF + Jensen-Shannon Divergence coherence scoring
- Pipe injection as corrective forcing u_drift(t)
- Behavioral signal detection (6 proxies)
- Hallucination signal detection (3 proxies)
- Session health scoring with CIRCUIT preset support
- RAG memory (session history retrieval)
- Session rewind (20-turn buffer)
- Research export (CSV + JSONL)
- SDE path visualization (live OU ensemble on chart)
- Circuit Signal (full adder pass rate → coherence readout)

## Experimental Features (Advanced Tab)

Require explicit opt-in. Labeled as experimental. Not used in standard coherence scoring.

- Alternative SDE models (CIR, Heston)
- Custom behavioral rails
- Framework constant tuning
- Stability convergence display
- MHT Study (Metatron-Hudson Theory SDE + DATL Heartbeat)
- Poole Manifold CA Simulator (3D cellular automaton, full adder verification)

## License

MIT — see `LICENSE`

## Authors

David Hudson [@RaccoonStampede](https://x.com/RaccoonStampede)
David Perry [@Prosperous727](https://x.com/Prosperous727)
