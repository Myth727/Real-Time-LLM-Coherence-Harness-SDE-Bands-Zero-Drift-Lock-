# ARCHITECT — Full Changelog
**ARCHITECT — Universal Coherence Engine**
© 2026 Hudson & Perry Research
𝕏 @RaccoonStampede (David Hudson) · 𝕏 @Prosperous727 (David Perry)

## V1.5.37
- Config save useEffect dep array: added 8 missing dependencies — showSdePaths, pathOpacity, caPassRate, pooleBirth1, pooleBirth2, pooleSurv1, pooleSurv2, pooleGen. Changes to Display tab opacity and Poole CA params now correctly trigger hpdl_config persistence without requiring an unrelated state change.
- tuneCtxValue useMemo dep array: added 16 missing dependencies — showMhtStudy, all 8 MHT params (mhtPsi, mhtKappa, mhtTau, mhtGamma, mhtCap, mhtAlpha, mhtBeta, mhtSigma), showPoole, all 5 Poole params (pooleBirth1/2, pooleSurv1/2, pooleGen), caPassRate. TuneModal now re-renders correctly when Advanced tab params change.
- UI text duplication fixed: "consider reset or prune" appeared twice in token warning string at L5070.
- SDK constants.ts: added missing exports MUTE_PHRASES (string[]), PRUNE_THRESHOLD (8), PRUNE_KEEP (5) — engine.ts imports these and TypeScript compilation was failing. Resolves Issue #3 (teknium1/NousResearch).
- SDK engine.ts: pipe injection header renamed from "HUDSON & PERRY PIPE" to "ARCHITECT PIPE" — consistent with ARCHITECT.jsx L486.
- SDK index.ts: quick-start buildPipeInjection example updated to PipeState object signature, replacing stale positional argument form.
- All version strings bumped to V1.5.37.

---

## V1.5.36
- CRITICAL BUG FIX: "This model does not support assistant message prefill" error. After drift escalation to deep/extreme mode, needsHardTrim slicing could produce an apiMessages array ending with role:"assistant" (common after deleteTurn or rewind). Fix: strip trailing assistant messages from trimmedSafe before building apiMessages. Fallback: if all messages are non-user, send as-is.
- Template literals in JSX attributes fixed: L2139 Reset button title and L4814 MessageBubble key — replaced with string concatenation for Babel artifact compatibility.
- pooleGen added to hpdl_config save block — was missing, causing CA gen counter to reset on reload.
- All V1.5.35 version strings in rendered content bumped to V1.5.36.

---

## V1.5.35
- CIRCUIT preset added to PRESETS. Tightest variance tolerance of any preset (varDecoherence 0.140, below MEDICAL). Most aggressive drift escalation (2/4/6). Highest health penalty weights (14/7/12). Built for logic verification and cascading AI reasoning chains. Appears in TUNE → PRESETS alongside DEFAULT/TECHNICAL/CREATIVE/RESEARCH/MEDICAL/CUSTOM.
- Circuit Signal added to metrics sidebar. Shows full adder pass rate as a live percentage with green/amber progress bar. Visible when Poole CA sim is enabled and has run. ≥87.5% renders green.
- Full adder truth table result now wires caPassRate state via ref callback — feeds Circuit Signal readout in real time.

---

## V1.5.34
- Poole CA state declarations added (showPoole, pooleBirth1/2, pooleSurv1/2, pooleGen, caPassRate) — were missing from useState. Now properly declared, persisted to hpdl_config, and restored on mount.
- All Poole and caPassRate states wired into tuneCtxValue object, TuneModal destructuring, config save, dep array, and config restore.

---

## V1.5.33
- Poole Manifold CA Simulator added to Advanced tab (new toggle Poole CA Sim). 3D cellular automaton with B/S parameter controls (birth min/max, survive min/max, 1-13 range). Live 160×160 canvas rendering using ref callback. STEP/RESET buttons.
- Full adder truth table embedded in Poole section — all 8 A/B/Cin combinations verified, sum=A XOR B XOR Cin, carry=(A AND B)|(B AND Cin)|(A AND Cin). Shows pass count and ✓/✗ per row.
- DATL Heartbeat section added inside MHT Study panel. Computes Δ_heartbeat(t)=sin(2πt/998001)·e^(ψt/10) and N(t) scar-swarm count live from current MHT params. Oscillating bar display. Period 998001 steps (ultra-low frequency per Abaddon's spec).

---

## V1.5.32
- SDE path visualization added to coherence chart. Toggle SDE Path Viz in FEATURES tab. Up to 20 paths sampled from livePaths pool, normalized to coherence range [0.2,1.0], color matches active preset. Opacity control (0.05-0.40, default 0.15) in DISPLAY tab.
- pathChartData useMemo — only recomputes when showSdePaths, livePaths, or coherenceData changes. isAnimationActive=false for performance.
- Template literals in JSX replaced with string concatenation (key, dataKey) — artifact Babel compatibility fix.

---

## V1.5.31
- MHT Study module added to Advanced tab (Metatron-Hudson Theory SDE Study). Toggle MHT Study to access: Robitaille Helix invariants display (ψ, κ bound, τ, R_heart formula), H_drift annihilator parameter editor (ψ, κ, τ, cap, α, β, γ, σ), live computed values at t=1 (r(t), R_heart, H_drift, annihilated value, κ/τ validity). Study use only — not used in coherence scoring.
- All MHT states (showMhtStudy + 8 params) added to tuneCtxValue, TuneModal destructuring, config save/restore, dep arrays.
- MHT state declarations (9 useState calls) added to main component — were missing from earlier patch.

---

## V1.5.30
- Removed display:none hidden Hudson Constants block from JSX — 50 lines of dead code eliminated.
- Removed unused constantsModified variable declaration.

---

## V1.5.29
- CRITICAL SCROLL FIX: TUNE modal scroll container was closing prematurely after mute phrases section. Math, Display, and Advanced tabs were outside the scroll container entirely — trapped at fixed height with no scroll. Moved closing tag to just before the footer.
- ghost tax floor renamed to min floor throughout visible UI — removed pseudoscience terminology.
- README updated with active development note.

---

## V1.5.28
- Advanced tab scroll fix (Samsung Android): range inputs replaced with number inputs in CIR/Heston param sections. Range inputs on Android WebView consume touch scroll events.
- All Advanced tab params now directly type-editable, no sliders.

---

## V1.5.27
- Advanced tab toggle system fully rebuilt. Added showSdeConfig, showRailsConfig, showConstEditor, showMhtStudy boolean states. Each toggle flips its own independent boolean. Config sections appear based on booleans, not underlying values. Previously Edit Constants was broken — calling setUserKappa(KAPPA) when already at default did nothing.
- Custom Rails: sub-toggle inside config panel to enable/disable injection separately from showing editor.
- Event log type renamed LOCK_888 → FULL_STABLE.
- Full pseudoscience audit pass.

---

## V1.5.26
- WebkitOverflowScrolling:touch added to TUNE modal scroll container for iOS momentum scrolling.
- Footer κ= display removed from TUNE modal active preset line.

---

## V1.5.25
- CRITICAL SYNTAX FIX: Custom Rails textarea placeholder had literal newlines inside a double-quoted JS string — invalid token. Fixed to escaped \n sequences.
- All stale version strings (V1.5.21/22/23/24) normalized.

---

## V1.5.24
- Advanced tab rebuilt with FEATURES-style individual pill toggles. Four toggles: Alt SDE Model, Custom Rails, Stability Panel, Edit Constants. Each config section only appears when its toggle is on.

---

## V1.5.23
- CIR/Heston param sections: range sliders replaced with number inputs (Android WebView range inputs consume touch scroll events).
- All three SDE param sections visible simultaneously with active model selector buttons.

---

## V1.5.22
- κ → DAMPING stat row renamed to Damping. LOCK_888 stat row renamed to Stability. HC_MASS_LOSS and LOCK_888 removed from SDE params expanded view.
- tuneCtxValue was missing all Advanced Tab state — fixed root cause of checkbox not persisting.

---

## V1.5.21
- LOCK_888 badge renamed from 🔒 LOCK_888 to 🔒 FULL STABILITY in header.
- ZERO-DRIFT LOCK panel renamed to STABILITY CONVERGENCE. Hz unit removed from residual display.
- Zero-Drift Display toggle removed from FEATURES tab — moved to ADVANCED tab as opt-in, default OFF (featZeroDrift now defaults false).
- κ/ANCHOR MODIFIED header warning removed — these constants are Advanced-only, no header indicator needed.
- Stability Convergence toggle added inside Advanced tab with explanatory note.
- README title changed from ARCHITECT — Universal Coherence Engine — ARCHITECT to ARCHITECT — Universal Coherence Engine.
- README SDK constants block simplified — KAPPA/RESONANCE_ANCHOR/ghost tax removed, replaced with neutral EPSILON/DAMPING descriptions.
- README citation updated to neutral framing.

---

## V1.5.20
- MessageBubble extracted as React.memo component above main component. Custom equality function: only re-renders when display text, drifted state, bookmark state, cdata reference, or attachments change. In sessions with 50+ turns, previous messages no longer re-render on every state change (typing, scoring, streaming). Key uses message index + display length for stable identity. Inline IIFE for isBookmarked removed — computed once per map iteration and passed as prop.

---

## V1.5.19
- SDE params panel — removed κ=0.444 from visible label. Now reads: ω=2π/12 locked, α/β_p/σ tunable, damping constant fixed (see ⚗ ADVANCED).
- Display tab — removed 623.81 Hz resonance framing. Now reads: dark-mode first design, optimized for extended reading sessions.
- Hidden constants block labels neutralized — κ (Hudson Constant) → κ (damping), RESONANCE_ANCHOR 623.81 Hz → Stability Anchor. Neutral language throughout.
- Standard UI now fully free of κ=0.444, 623.81 Hz, and Hudson Constant references. All such framing is Advanced tab only.

---

## V1.5.18
- Hudson Constants (κ, RESONANCE_ANCHOR) moved out of FEATURES tab and into ADVANCED tab. No longer visible on the standard interface. Renamed to "Framework Constants" with neutral language.
- ZERO-DRIFT LOCK panel label — removed Hz value from visible label. Shows "ZERO-DRIFT LOCK" only.
- Adaptive sigma panel — κ=0.444 fixed (Hudson Constant) softened to "damping constant fixed (see Advanced tab)".
- CUSTOM preset warning about κ/RESONANCE_ANCHOR updated — now points to Advanced tab instead of stating values.
- Math tab — nudge note added pointing users to Advanced tab for experimental features.
- Framework Constants block added inside Advanced tab with softened language: κ described as damping constant, 623.81 described as stability anchor convergence target. No pseudoscience framing in default UI.
- README updated — clean separation of validated vs experimental. Apology note for SDK files in root.

---

## V1.5.17
- Advanced Tab added to TUNE modal — gated experimental zone, requires explicit checkbox unlock. Contains CIR and Heston alternative SDE models, Custom Rails editor. Carries clear warning: features here are experimental or unvalidated.
- CIR (Cox-Ingersoll-Ross) SDE model — dX = κ(θ−X)dt + σ√X dW. Mean-reverting, positive-valued. Three tunable params (κ, θ, σ). Available in Advanced Tab.
- Heston stochastic volatility model — dV=κ(θ−V)dt+σ√V dW₁, dS/S=√V dW₂, correlation ρ. Five tunable params. Available in Advanced Tab.
- Custom Rails — user-defined behavioral guidelines (plain language) injected into every system prompt alongside HPDL pipe directives. Toggleable on/off, persists across sessions. Available in Advanced Tab.
- All Advanced Tab state (advancedUnlocked, userRailsEnabled, userCustomRails, sdeModel, CIR/Heston params) persisted to hpdl_config and restored on mount.
- Guide rewritten — leads with what is confirmed and validated, frames Advanced tab as opt-in experimental zone.
- README rewritten — artifact-first layout, clean separation of validated vs experimental features, apology note for SDK files being in root of main branch pending folder reorganization.
- railsInj wired into system prompt assembly — Custom Rails text injected when enabled.
- stale V1.5.12 version string in TUNE modal footer fixed to V1.5.17.

---

## V1.5.16
- Q1: Model string updated from claude-sonnet-4-20250514 to claude-sonnet-4-6 (current).
- Q2: hpdl_data save dep array completed — driftCount, turnCount, calmStreak, smoothedVar, kalmanState, scoreHistory, ragCache all added. Previously these could fail to persist if only they changed without coherenceData also changing (e.g. after rewind or deleteTurn).
- Q3: activeMutePhrases wrapped in useMemo([customMutePhrases]) — was returning a new MUTE_PHRASES reference every render when no custom phrases set, silently invalidating sendMessage useCallback on every render.
- Q4: apiKeyValid wrapped in useMemo([apiKey]).

---

## V1.5.15
- Guide strings updated — Version 1.5.2 → 1.5.15 in GUIDE_CONTENT header (this was the visible version shown when user opens GUIDE modal).
- FRAMEWORK_DOC validation status expanded — added confirmations for per-preset GARCH, epsilon, post-audit dual Kalman, React Context, full cfg threading, math tunables persistence, and Grok external validation note.
- V1.5.0 ADDITIONS section → V1.5.3–V1.5.15 ADDITIONS — covers all changes through V1.5.15.
- PART 8 expanded — renamed from V1.5.0 NEW FEATURES to V1.5.x ADDITIONS. New sections: MATH TAB TUNABLES, INDUSTRY PRESETS (full breakdown), REWIND, RESEARCH NOTES.
- POST-AUDIT section updated to include CUSTOM threshold option.
- Subtitle line V1.5.8 → V1.5.15 fixed (was visible in running app).

---

## V1.5.14
- Q1: Model string updated — claude-sonnet-4-20250514 → claude-sonnet-4-6.

---

## V1.5.13
- P1: Math tunables now persist across reloads — mathTfidf/Jsd/Len/Struct/Persist/RepThresh, mathKalmanR/SigP, mathRagTopK, mathMaxTokens, SDE param overrides, and postAuditThresh were all missing from hpdl_config save/restore.
- P2: liveDamping dead code removed — was `1/(1+userKappa)` declared but never referenced.
- P3: Eight truncated `// V1.` comment stubs replaced with proper descriptions throughout the file.
- P4: cap_eff wrapped in useMemo([harnessMode, mathEpsilon]) — was recalculated every render.
- P5: contextPruned wrapped in useMemo([messages]) — messages.filter() no longer runs every render.

---

## V1.5.12
- N1: Rewind "prev" button now compares against turnSnapshots[0]?.turn (oldest in buffer) not hardcoded 1. After turn 20 buffer rolls — prev was staying enabled and silently doing nothing below buffer floor.
- N2: downloadResearch now accepts cfg and uses preset healthDriftWeight/BSigWeight/HSigWeight. CSV health column now matches live session health for MEDICAL/CREATIVE/RESEARCH presets.
- N3: beforeunload effect added — flushes researchNotesRef.current to hpdl_notes_flush storage key on tab close. Recovered on next mount. Prevents notes typed but never blurred from being lost.
- N4: ScoreBadge extracted above main component — was a function component defined inline causing React to see a new component type on every render.
- N5: liveSDEOverride wrapped in useMemo — was a plain object spread rebuilt every render, causing sendMessage to always receive a new reference.
- N6: harnessChangeLog wrapped in useMemo([coherenceData]) — .map().filter() chain no longer runs every render.

---

## V1.5.11
- Stale V1.5.8 version string fixed in ACTIVE preset display line in TuneModal.
- cfg memoized — was `PRESETS[activePreset] ?? PRESETS.DEFAULT` as a plain expression every render, producing a new reference and causing sendMessage to invalidate on every render regardless of whether the preset changed.

---

## V1.5.10
- H1: Rewind "next" button fixed — was comparing rewindTurn vs turnSnapshots.length (always 20 after rolling cap). Now compares against turnSnapshots[turnSnapshots.length-1]?.turn (actual max turn in buffer).
- H2: RESEARCH export reads researchNotesRef.current || researchNotes — unblurred notes no longer silently lost in export.
- M2: Live coherence weight sum display in MATH tab — shows Σ = X.XXX, green ✓ when ~1.0, amber ⚠ with explanation when off. Replaces static "should sum to 1.0" text. Weights are independent multipliers; sum of 1.0 is recommended not enforced.

---

## V1.5.9
- B: Typing bug — onChange replaced with onInput (fires after DOM commit, safer in iframe sandbox). onCompositionEnd added for IME/CJK/iOS handling. setHasInput now guarded — only fires when boolean actually changes (hasVal !== hasInput), preventing re-renders on mid-word keystrokes.
- A: DisclaimerModal duplicate onClick removed — dead first handler on accept button.
- C: researchNotes textarea converted to uncontrolled — onBlur updates state, onInput updates ref. Stops keystroke-triggered re-renders when NOTES panel is open.
- D: S styles object wrapped in useMemo([harnessMode]) — was 62-line object literal rebuilt on every render. Only currentMode.color changes, which depends solely on harnessMode.
- Grok-4: buildPipeInjection now accepts cfg param and reads cfg.varDecoherence/varCaution/varCalm. Pipe directives now respond to preset thresholds.

---

## V1.5.8
- React Context migration — TuneCtx (30+ tune params) and SessionCtx (session/modal state) replace 30+ prop-drilling chains. Modal call sites reduced to zero-prop <TuneModal /> etc.
- Context values memoized — TuneCtx and SessionCtx both wrapped in useMemo. Modals only re-render when their specific slice of state changes.
- Declaration order fix — context values placed after all useCallback declarations. Previously caused "cannot access toggleBookmark before initialization" on mount.
- 7 modal sub-components all verified stable with zero-prop call sites.

---


## V1.5.7
- Text contrast increased throughout light theme (all mid/dim/faint tokens darkened)
- resetSession now clears textarea DOM, inputValueRef, and hasInput state
- Feature toggle OFF row background fixed (#0A0A0A → #F4F4F8 in light theme)
- Misplaced MAIN COMPONENT comment banner removed
- Inline hardcoded hex colors consolidated toward THEME tokens
- JSX header stripped of verbose patch notes → moved here

---

## V1.5.6
- P37: Typing-in-textarea bug fixed — controlled `input` state replaced with `hasInput` boolean + uncontrolled textarea. Eliminates full-component re-render on every keystroke.
- P38: Light/daytime theme. THEME constant with 35 semantic tokens. S styles rewritten. ~50 inline hexes replaced. Chart, modals, scrollbar, keyframes all updated.
- P39: Monolith split Phase 1 — 7 modals extracted to React.memo sub-components (1175 lines out of main render). ExportContentModal, DisclaimerModal, TuneModal, RewindConfirmModal, LogModal, BookmarksModal, GuideModal.

---

## V1.5.5
- P33: applyZeroDriftLock (200-iter loop) — lockStatus and exportBlock both wrapped in useMemo.
- P34: URL.revokeObjectURL removed from removeAttachment — was no-op on data URIs.
- P35: processFiles catch now logs console.error for devtools visibility.
- P36: MATH tab ↺ reset buttons — was setter(val) (no-op). Now setter(def) with correct defaults.

---

## V1.5.4
- P28: `input` removed from sendMessage dep array — read via inputValueRef. Was recreating callback on every keystroke.
- P29: buildTfIdf + buildTermFreqDist merged into one canonical buildTermFreq().
- P30: 2-doc IDF design documented inline — intentional vocabulary-shift measurement.
- P31: Mute word limit corrected — was cap/8 (~15 words), now cap*0.75 (~90 words at 120 tokens).
- P32: corrections state documented — it is the FALSE+ false-positive tracking system in LOG modal.

---

## V1.5.3
- P18–P20: Removed USE_MUTE_MODE / USE_DRIFT_GATE / USE_PIPING internal guards from helper functions. Call sites (featMute, featGate, featPipe) are the live gates.
- P21: sendMessage muteTriggered/gateTriggered now use featMute/featGate state, not boot constants.
- P22: updateSmoothedVariance takes cfg param — preset GARCH values (omega/alpha/beta) now actually apply.
- P23: driftLawCapEff/driftLawFloor take epsilon param — mathEpsilon wired to cap_eff, chartData, MATH tab.
- P24: Snapshot lock888Achieved uses cfg.lock888Streak — CREATIVE/RESEARCH/MEDICAL now correct.
- P25: hpdl_data save — eventLog added to deps. Prevents mismatched state after rewind + navigate.
- P26: API key warn fires for ALL non-sandbox origins (was missing Vercel/Netlify).
- P27: deleteTurn dep array adds cfg (required for cfg GARCH pass).

---

## V1.5.2
- P1: Version strings unified.
- P2: Config save dep array — nPaths/postAuditMode/customMutePhrases/researchNotes were missing.
- P3: corrections persistence — loaded from hpdl_data but never saved back.
- P4: Rewind index bug — was turnSnapshots[clickedTurn-1], broke after turn 20. Fixed to .find(s=>s.turn===n).
- P5: Bookmarks save immediately on toggle.
- P6: rewindConfirm cleared in resumeLive — stale dialog could linger.
- P7: Post-audit scores against finalMessages (includes new reply). Was using same inputs as rawScore so delta was always ~0.
- P8: finalDriftCount moved before meta-harness block — single source of truth.
- P9: deleteTurn variance uses updateSmoothedVariance (GARCH blend) — prevents discontinuity after deletion.
- P10: corrections removed from sendMessage dep array.
- P11: HC_MASS_LOSS aliased to KAPPA.
- P12: pruneThreshold/pruneKeep state behavior documented — only active in CUSTOM mode.
- P13: chartData wrapped in useMemo.
- P14: PRECOMPUTED_PATHS note added.
- P15: API key warning sandboxed correctly.
- P16: statusMessage state added — rewind/delete status separated from file errors.
- Cleanup: Removed jaccardSimilarity(), VAR_SMOOTH_ALPHA, p50 in sdePercentilesAtStep, PRECOMPUTED_PATHS.

---

## V1.5.0
- SDE path count tunable (nPaths 10–1000, default 50)
- Post-audit mode (Off / Light / Full / Custom) — second coherence pass after generation
- Token estimate display, tightened thresholds (40k amber / 70k red)
- Mute phrase editor in TUNE panel
- Bookmark notes annotation field
- Health penalty weights exposed in CUSTOM preset config
- Feature toggle state included in EXPORT block
- window.storage two-key split (hpdl_config + hpdl_data)
- Research Export CSV with session UUID
- localStorage → window.storage migration

---

## V1.4.x
- V1.4.8: κ & ANCHOR user-adjustable, R&D disclaimer, legal notice
- V1.4.7: Industry presets, 11 feature toggles, TUNE modal
- V1.4.6: Adaptive sigma EWMA, rate slider
- V1.4.5: LOCK_888 avg C floor, B/H health penalties
- V1.4.4: Bookmarks
- V1.4.3: driftCount decay
- V1.4.2: Error logging, pipe self-awareness
- V1.4.1: Restored missing handleCopyExport
- V1.4.0: GARCH, JSD, H-sigs, B-sigs, session health, rewind

---

## V1.3
- TF-IDF coherence scoring
- Mute mode startsWith detection
- Snapshot cap (rolling 20)
