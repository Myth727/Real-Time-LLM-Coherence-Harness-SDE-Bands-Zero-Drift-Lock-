# ARCHITECT — Coding Rules for AI Models

**Universal knowledge seed for all AI models**
© 2026 Hudson & Perry Research · @RaccoonStampede · @Prosperous727

If you are an AI model working on ARCHITECT code — generating patches, reviewing changes,
suggesting features, or debugging — read this file before touching anything.
These are not preferences. They are architectural invariants. Breaking any of them
has caused real regressions in prior sessions.

---

## The Single File Rule

**ARCHITECT.jsx is one file. It stays one file.**

Do not suggest splitting into components, extracting hooks, creating separate utils,
or restructuring into a folder. The single-file constraint is intentional:

- The paste-into-Claude deployment path requires one file
- Claude artifact environment has no module system
- Every split creates a deployment path that doesn't work

Current size: ~6,800 lines. This is correct. Do not optimize for file size.

---

## Filename

`ARCHITECT.jsx` — all caps, always.

Never `architect.jsx`, `Architect.jsx`, or any other casing.
GitHub treats case changes as new files on case-insensitive filesystems.
This has caused repo corruption before.

---

## Version Bumping

Bump the version number on **every functional change**. No exceptions.

Version string lives in the file header:
```javascript
//  ARCHITECT — UNIVERSAL COHERENCE ENGINE · V2.2
```

Also in `package.json` (`"version": "2.2.0"`), `FRAMEWORK.md`, `SECURITY.md`,
`CONTRIBUTING.md`, `GITHUB_SETUP.md`, and `pages/index.tsx` title tag.

If you change ARCHITECT.jsx, you must also update those files.
Mismatched versions across files create confusion for users and contributors.

---

## Parse Check Before Every Delivery

Before delivering any modified ARCHITECT.jsx, verify it parses:

```bash
node -e "
const p=require('@babel/parser');
const fs=require('fs');
const src=fs.readFileSync('ARCHITECT.jsx','utf8');
try{p.parse(src,{sourceType:'module',plugins:['jsx']});console.log('OK');}
catch(e){console.log('ERROR line',e.loc?.line,':',e.message);}
"
```

Do not deliver a file that fails this check. Common failure causes are below.

---

## JSX String Rules — The Most Common Failure Points

### No template literals inside JSX attributes

**WRONG:**
```jsx
<div style={{color:`${active ? '#0A7878' : '#2E5070'}`}}>
```

**CORRECT:**
```jsx
<div style={{color:active ? '#0A7878' : '#2E5070'}}>
```

Babel's JSX parser rejects template literals inside JSX attribute values.
Use ternaries and string concatenation instead.

### No literal newlines inside JavaScript string concatenation

**WRONG (produces parse error):**
```javascript
const msg = "Line one
line two";
```

**CORRECT:**
```javascript
const msg = "Line one\nline two";
```

When writing Python scripts that generate JavaScript, use `\\n` not actual newlines.

### No emoji literals in Python scripts generating JavaScript

**WRONG in Python:**
```python
s = 'label:"👍"'  # surrogate error on some systems
```

**CORRECT in Python:**
```python
s = 'label:"+1"'  # or use chr(0x1F44D) at write time
```

Emoji in JavaScript string content written from Python can cause surrogate encoding errors.
Use text equivalents or unicode escapes.

---

## State Architecture Rules

### displayPrefs is LOCAL to TuneModal

`displayPrefs` state must be declared inside `TuneModal` using `React.useState(()=>loadDisplayPrefs())`.

It must **never** be:
- Declared in the main component (`HudsonPerryDriftV1`)
- Added to `TuneCtx`
- Passed through context

This was the root cause of the `displayPrefs is not defined` error in the Claude artifact
sandbox. The context chain breaks before `displayPrefs` resolves. Local state works correctly.

### New state that TuneModal needs goes through TuneCtx

All state that TuneModal reads from the main component must be:
1. Declared in main component (`useState`)
2. Added to `tuneCtxValue` object
3. Added to `tuneCtxValue` deps array
4. Added to TuneModal's `useContext(TuneCtx)` destructure

Missing any of these four steps causes `X is not defined` errors in TUNE modal.

---

## Storage Rules

All persistence must go through the unified storage adapter:

```javascript
_storageSet(key, value)   // localStorage → window.storage → in-memory
_storageGet(key)          // same fallback chain
_storageDel(key)          // same fallback chain
```

**Never call `localStorage` directly** in any V2.x feature code.
Raw `localStorage` calls break silently in private browsing mode and the Claude artifact sandbox.

### Storage keys

| Key | Purpose |
|-----|---------|
| `arch_fb` | AutoTune feedback profiles |
| `arch_dp` | Display preferences |
| `arch_pinned` | Pinned document contents |
| `arch_mem` | Session memory summaries |
| `architect_api_key` | API key (user-provided) |
| `architect_provider` | Provider selection |
| `hpdl_config` | Main settings (legacy V1 key, do not rename) |
| `hpdl_data` | Session metrics (legacy V1 key, do not rename) |

Do not introduce new keys without documenting them here and in `SECURITY.md`.

---

## System Prompt Injection Order

This is the exact order. Do not reorder without understanding downstream effects.

```
BASE_SYSTEM
+ pinnedDocsInjection      ← always first, user reference material
+ sessionMemoryInjection   ← compressed history, before harness
+ HARNESS_INJECTIONS[mode] ← corrective directives
+ ragInjection             ← retrieved context
+ pipeInjection            ← live coherence state (u_drift)
+ gateInjection            ← word limit when variance elevated
+ muteInjection            ← token cap when mute mode active
+ railsInjection           ← user-defined behavioral rails
+ anchorInjection          ← domain vocabulary
```

Pinned docs must come before the harness so they're available to all downstream injections.
Session memory must come before the harness so the AI has established context before correction.

---

## Constants That Are Fixed by Design

**Never change these. Never suggest auto-adapting them.**

| Constant | Value | Reason |
|---|---|---|
| `KAPPA` (κ) | 0.444 | Hudson Constant — framework identity |
| `RESONANCE_ANCHOR` | 623.81 Hz | Stability convergence target |
| `EPSILON` | 0.05 | Ghost tax floor — empirically grounded |

κ=0.444 is not a tunable parameter. It is fixed by mathematical derivation.
Users who want to explore different κ values can do so in the Advanced tab —
that's what it's for. The canonical value never changes.

---

## Feature Flag Architecture

Every experimental feature must be:
1. Gated behind a state variable (e.g. `featKalman`, `showPoole`)
2. Defaulting to `false` unless the feature is standard
3. Saved and restored in config persistence
4. If pseudoscientific: gated behind `advancedUnlocked` consent checkbox

The consent gate in the Advanced tab is not optional. Features labeled experimental
must require explicit user acknowledgment. Do not remove consent gates.

---

## What NOT to Suggest

These are frequently suggested and always wrong for ARCHITECT:

- "Split ARCHITECT.jsx into smaller files" — breaks paste-into-Claude deployment
- "Use TypeScript for the main component" — artifact environment doesn't compile TS
- "Add a build step" — no build step, artifact is raw JSX
- "Move state to Redux/Zustand" — no external state management, artifact constraint
- "Add unit tests for the React component" — no test runner in artifact environment
- "Auto-adapt κ" — κ=0.444 is fixed by design, see above
- "Use emoji in Python string constants" — surrogate encoding errors
- "Write template literals in JSX attributes" — parse error

---

## Patch Discipline

Make changes in small, targeted patches. Verify parse after each patch.

**Good:** One insertion, one parse check, delivered.
**Bad:** 15 changes in one pass with no intermediate verification.

The V2.2 development history has multiple examples of large patches creating
parse errors that were harder to debug than the original feature. Small patches
with verification after each one is the proven working method.

When inserting new functions, insert by line number if the surrounding context
contains unicode characters (emoji, box-drawing chars, math symbols). Python
string replacement fails on files with mixed unicode. Use line-based insertion instead.

---

## Release Checklist Location

The 15-point release checklist lives at `.claude/evals/ARCHITECT_EVALS.md`.
Run all 15 checks before uploading any version to GitHub.
Vercel redeploys automatically on commit — broken code goes live immediately.

---

## File Upload Destinations

| File | GitHub path |
|---|---|
| `ARCHITECT.jsx` | Root AND `components/ARCHITECT.jsx` (two uploads) |
| `proxy.ts` | `pages/api/proxy.ts` |
| `index.tsx` | `pages/index.tsx` |
| `package.json` | Root |
| `vercel.json` | Root |
| `README.md` | Root |
| `CHANGELOG.md` | Root |
| `FRAMEWORK.md` | Root |
| `SECURITY.md` | Root |
| `CONTRIBUTING.md` | Root |
| `GITHUB_SETUP.md` | Root |
| `ARCHITECT_EVALS.md` | `.claude/evals/ARCHITECT_EVALS.md` |
| Knowledge seeds | `ai/knowledge/` |

---

*© 2026 Hudson & Perry Research*
