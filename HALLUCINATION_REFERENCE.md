# ARCHITECT — Hallucination Signal Reference

**Universal knowledge seed for all AI models**
© 2026 Hudson & Perry Research · @RaccoonStampede · @Prosperous727

This document defines ARCHITECT's three hallucination proxy signals (H-signals) in precise
detail — what they detect, when they fire correctly, when they fire incorrectly, and how
to interpret them. It also covers the two additional entropy-based signals added in V1.5.42.

No H-signal constitutes a confirmed hallucination. They are statistical proxies.
The FALSE+ button in the LOG modal is the correction mechanism.

---

## H-Signal Architecture

ARCHITECT runs hallucination detection on every assistant response after it's generated.
Detection uses `assessHallucinationSignals()` which returns:

```javascript
{
  flagged: boolean,         // true if any signal fired
  signals: string[],        // descriptions of what fired
  sourceScore: number|null, // TF-IDF match vs attached documents
  confidenceHits: number,   // count of confidence language markers
  contradiction: boolean,   // self-contradiction detected
  entropy: number,          // response token entropy
  vocabGrowth: number       // fraction of new vocabulary vs session
}
```

A turn is flagged (`⚠ H-SIGNAL`) if one or more signals fire.
The flag appears in the chart, the sidebar, and the export CSV.

---

## Signal 1 — High-Confidence Language + Elevated Variance

**Fires when:** 2 or more confidence markers detected AND `smoothedVar > VAR_CAUTION`

**VAR_CAUTION default:** 0.120 (MEDICAL preset: 0.090)

**Confidence markers (15 patterns):**
```
definitely, certainly, always, never, proven, guaranteed,
without doubt, it is a fact, scientifically, impossible,
absolutely, without question, I can confirm,
I know for certain, this is correct
```

**True positive scenario:**
AI states "This is definitely correct and has been scientifically proven" while session
variance is elevated (σ² = 0.165). The combination of assertive language + unstable
context is a strong confabulation indicator.

**False positive scenario:**
User asks "Are you certain this code is right?" AI responds "Yes, I'm absolutely certain —
I can confirm the logic is correct." Confidence language is a direct response to the question,
not spontaneous assertion. Variance happens to be elevated from a prior topic shift.
Click FALSE+.

**Key distinction:** Spontaneous high-confidence language under elevated variance = signal.
High-confidence language as a direct answer to a confidence question = likely false positive.

**Cross-model notes:**
- GPT-4 uses confidence language more frequently in technical explanations → higher FP rate
- Claude tends toward hedging language → lower FP rate, but "certainly" and "definitely" still fire
- Grok uses assertive language more freely → moderate-to-high FP rate in casual sessions

---

## Signal 2 — Low Source Consistency

**Fires when:** `sourceScore < 0.08` (TF-IDF similarity vs attached documents)

**Only fires when documents are attached** via the paperclip (📎) or pinned document slots.
With no attachments, sourceScore is `null` and this signal never fires.

**What it measures:**
TF-IDF cosine similarity between the AI's response token vector and the attached document
token vector. Below 8% means the response shares almost no vocabulary with the reference
material. If the user attached a contract and asked about it, a response with < 8% term
overlap suggests the AI isn't drawing from the document.

**True positive scenario:**
User pins a legal contract. Asks "What does clause 7 say?" AI responds with general legal
principles not found in the document. sourceScore = 0.04. Signal fires correctly — AI
fabricated instead of reading the document.

**False positive scenarios:**

1. User attaches a technical document and asks a clarifying question about their own
   understanding ("So does that mean X?"). AI confirms or denies in plain English without
   repeating document vocabulary. Low overlap is correct behavior.

2. User attaches a document for background context but asks an unrelated question.
   AI answers the question, not the document. Low overlap is appropriate.

3. Document is heavily formatted (tables, code, lists) — tokenization strips structure,
   reducing effective vocabulary. Score may be artificially low.

**Key distinction:** Is the user asking the AI to *use* the attached document or just
*have access to* it? If use → low sourceScore is suspicious. If context → it's noise.

---

## Signal 3 — Self-Contradiction

**Fires when:** Average TF-IDF similarity between current response and last 6 related
assistant turns falls below 15%

**"Related" definition:** Turns where the user's message had > 10% TF-IDF overlap with
the current user message. Topic-filtered — doesn't flag cross-topic transitions.

**True positive scenario:**
Session establishes "the API returns JSON." Three turns later AI states "the API returns
XML." Same topic, contradicting established fact. Signal fires correctly.

**False positive scenarios:**

1. AI legitimately updates a prior answer after new information. "Actually, I was wrong
   earlier — it returns JSON, not XML." The correction looks like contradiction.

2. User explicitly asks AI to argue the opposite position. AI's content contradicts
   prior turns by design.

3. Long session where context pruning has removed the original statement. AI has no
   access to what it said 15 turns ago but maintains internal consistency with recent turns.

**Key distinction:** Is the AI contradicting itself within working context, or is a prior
turn no longer in the context window? Check the turn number. If the original statement
was pruned, the signal is a false positive.

---

## Signal 4 — Low Response Entropy (V1.5.42)

**Fires when:** Token entropy < 0.80 AND response has > 10 tokens

**Entropy formula:** Shannon entropy over token frequency distribution in the response.
Low entropy = highly repetitive token distribution = response is mostly filler or restatement.

**True positive scenario:**
AI responds with "Certainly! That is a great point. I completely agree with your assessment.
This is indeed the case." High word count, near-zero information content. Entropy = 0.42.

**False positive scenario:**
Highly technical response with dense repetition of domain terms ("The API endpoint accepts
JSON. The JSON payload must include the API key. The API returns JSON."). Low entropy by
formula but high information density. Click FALSE+.

**Key distinction:** Low entropy filler (pleasantries, agreements, restatements) = signal.
Low entropy technical precision (domain terms repeating correctly) = false positive.

---

## Signal 5 — High Vocabulary Novelty Under Elevated Variance (V1.5.42)

**Fires when:** vocabGrowth > 70% AND `smoothedVar > VAR_CAUTION` AND session has 3+ assistant turns

**vocabGrowth formula:** Fraction of tokens in current response not seen in any prior
assistant turn. 70% means 7 in 10 tokens are new to the session.

**True positive scenario:**
Turn 8 of a session about Python debugging. Suddenly AI introduces extensive vocabulary
from a completely different domain (medical terminology, legal concepts) under elevated
variance. 78% vocabulary novelty + σ² = 0.18. Classic confabulation onset — AI is
generating plausible-sounding but ungrounded content.

**False positive scenarios:**

1. Topic legitimately changes. User introduces a new subject. 75% new vocabulary is
   appropriate and correct. Check whether *user* introduced the new vocabulary first.

2. Early session (turns 1–3). Almost everything is new vocabulary because no baseline exists.
   Signal gated at 3+ turns for this reason but can still fire early in sparse sessions.

3. AI correctly expands scope. "Your Python question also touches on memory management..."
   Legitimate scope expansion with new vocabulary.

**Key distinction:** Did the user introduce the new vocabulary first, or did the AI?
If AI-initiated under elevated variance = signal. If user-initiated = likely false positive.

---

## Combined Signal Interpretation

| Signals Firing | Interpretation | Recommended Action |
|---|---|---|
| None | Clean turn | Continue |
| Entropy only | Filler response | Note; check if user got useful answer |
| Confidence only (low variance) | Normal assertion | Ignore |
| Confidence + high variance | Possible confabulation | Review response carefully |
| Source consistency only | Off-document response | Check if document use was required |
| Self-contradiction only | Possible error | Rewind to pre-contradiction turn |
| Vocab novelty + high variance | Confabulation risk | High — verify claims |
| 3+ signals same turn | Strong confabulation signal | Rewind; reset or correct |

---

## How H-Signals Interact with Presets

Different presets set different `VAR_CAUTION` thresholds, affecting when Signal 1 fires:

| Preset | VAR_CAUTION | Signal 1 sensitivity |
|---|---|---|
| DEFAULT | 0.120 | Standard |
| TECHNICAL | 0.100 | Higher — catches drift earlier |
| CREATIVE | 0.160 | Lower — tolerates more variation |
| RESEARCH | 0.130 | Moderate |
| MEDICAL | 0.090 | Highest — most conservative |
| CIRCUIT | 0.080 | Maximum — fires very readily |

For high-stakes work (legal, medical, financial): use MEDICAL or CIRCUIT preset.
Signal 1 fires at much lower variance thresholds. Fewer false negatives.

---

## What H-Signals Are Not

- Not a factual verification system
- Not a lie detector
- Not a confidence calibration tool
- Not a measurement of response quality
- Not a confirmed hallucination detector

They are **statistical proxies** for conditions associated with confabulation risk.
They are correct to monitor. They are not correct to treat as ground truth.

Use them to decide where to focus human review — not to automatically reject responses.

---

## The FALSE+ Workflow

When a signal fires incorrectly:
1. Open the LOG modal (LOG button in sidebar)
2. Find the signal event
3. Click FALSE+
4. The correction is stored locally and exported in RESEARCH CSV
5. Over time, your false positive dataset calibrates your expectations for your use case

FALSE+ data is never transmitted. It stays in your session and exports.

---

*© 2026 Hudson & Perry Research — All H-signal outputs are proxy indicators only.*
*Research basis: Sharma et al. ICLR 2024 (sycophancy) · Chuang et al. 2024 DoLa (JSD)*
