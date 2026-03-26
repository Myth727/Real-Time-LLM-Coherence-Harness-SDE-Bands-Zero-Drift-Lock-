/**
 * HPDL SDK — COHERENCE SCORING
 *
 * C = w_tfidf·TF-IDF + w_jsd·(1−JSD) + w_len·lenScore
 *   + w_struct·struct + w_persist·persist
 *   × repetitionPenalty
 *
 * JSD reference: Chuang et al. 2024 (DoLa) — symmetric, bounded [0,1],
 * proven to catch semantic drift better than KL or cosine on sparse vocabs.
 *
 * V1.5.4: buildTfIdf and buildTermFreqDist were identical functions.
 * Merged into single canonical buildTermFreq(). Both tfidfSimilarity
 * and jensenShannonDivergence now use the same implementation.
 */

export interface CoherenceWeights {
  tfidf:       number; // default 0.25
  jsd:         number; // default 0.25
  length:      number; // default 0.25
  structure:   number; // default 0.15
  persistence: number; // default 0.10
}

export const DEFAULT_WEIGHTS: CoherenceWeights = {
  tfidf: 0.25, jsd: 0.25, length: 0.25,
  structure: 0.15, persistence: 0.10,
};

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: string;
  text?: string;
}

// ── Text utilities ──────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','and','for','that','this','with','are','was','were','has',
  'have','had','not','but','from','they','their','what','which','when',
  'been','will','would','could','should','does','did','its','you','your',
  'our','can','all','one','also','more','than','then','just','into',
  'over','after','about','there','these',
]);

export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function getTextFromContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter(b => b.type === 'text').map(b => b.text || '').join(' ');
  }
  return '';
}

/**
 * Canonical term frequency builder.
 * Filters stop words, counts, normalizes by total.
 * Used by both tfidfSimilarity and jensenShannonDivergence.
 */
export function buildTermFreq(tokens: string[]): Record<string, number> {
  if (!tokens.length) return {};
  const freq: Record<string, number> = {};
  tokens.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const total = Object.values(freq).reduce((s, v) => s + v, 0) || 1;
  const dist: Record<string, number> = {};
  Object.keys(freq).forEach(w => { dist[w] = freq[w] / total; });
  return dist;
}

/**
 * 2-document TF-IDF cosine similarity.
 *
 * IDF design: with exactly 2 documents, df ∈ {1, 2}.
 *   df=1 (term in one doc only):  IDF = log(2) ≈ 0.693  → unique term, weighted
 *   df=2 (term in both docs):     IDF = log(1) = 0       → shared term, zeroed
 *
 * This is intentional: the component measures vocabulary SHIFT between
 * the new response and recent history — not overlap. Coherent repetition
 * of domain terminology will score near 0 on this component, which is
 * offset by the JSD and persistence components in computeCoherence.
 */
export function tfidfSimilarity(tokensA: string[], tokensB: string[]): number {
  const tfA = buildTermFreq(tokensA);
  const tfB = buildTermFreq(tokensB);
  const allTerms = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  if (!allTerms.size) return 1;

  let dot = 0, normA = 0, normB = 0;
  allTerms.forEach(term => {
    const inA = term in tfA ? 1 : 0;
    const inB = term in tfB ? 1 : 0;
    const idf = (inA + inB > 0) ? Math.log(2 / (inA + inB)) : 0;
    const a = (tfA[term] || 0) * idf;
    const b = (tfB[term] || 0) * idf;
    dot += a * b; normA += a * a; normB += b * b;
  });

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.min(dot / denom, 1);
}

/**
 * Jensen-Shannon Divergence — symmetric, bounded [0, 1].
 * JSD = 0: identical distributions. JSD = 1: maximally different.
 * Score used in coherence as (1 - JSD), so higher = more coherent.
 */
export function jensenShannonDivergence(tokensA: string[], tokensB: string[]): number {
  const pA = buildTermFreq(tokensA);
  const pB = buildTermFreq(tokensB);
  const allTerms = new Set([...Object.keys(pA), ...Object.keys(pB)]);
  if (!allTerms.size) return 0;

  const M: Record<string, number> = {};
  allTerms.forEach(t => { M[t] = ((pA[t] || 0) + (pB[t] || 0)) / 2; });

  const klPM = Array.from(allTerms).reduce((s, t) => {
    const p = pA[t] || 0, m = M[t] || 1e-10;
    return p > 0 ? s + p * Math.log(p / m) : s;
  }, 0);

  const klQM = Array.from(allTerms).reduce((s, t) => {
    const q = pB[t] || 0, m = M[t] || 1e-10;
    return q > 0 ? s + q * Math.log(q / m) : s;
  }, 0);

  return Math.min(1, Math.max(0, (klPM + klQM) / (2 * Math.log(2))));
}

// ── Main coherence function ─────────────────────────────────────
/**
 * Compute coherence score for a new response against conversation history.
 * @param newContent  Raw text of the new assistant response
 * @param history     Full message history
 * @param weights     Coherence formula weights (default: framework values)
 * @param repThreshold Repetition penalty threshold (default 0.65)
 * @returns Score in [0.30, 0.99]
 */
export function computeCoherence(
  newContent: string,
  history: Message[],
  weights: CoherenceWeights = DEFAULT_WEIGHTS,
  repThreshold = 0.65,
): number {
  const ah = history.filter(m => m.role === 'assistant');
  if (!ah.length) return 0.88;

  const newT = tokenize(newContent);
  const recT = tokenize(ah.slice(-4).map(m => getTextFromContent(m.content)).join(' '));

  const vocab    = tfidfSimilarity(newT, recT);
  const jsd      = jensenShannonDivergence(newT, recT);
  const jsdScore = 1 - jsd;

  const avgLen   = ah.reduce((s, m) => s + getTextFromContent(m.content).length, 0) / ah.length;
  const lenScore = Math.exp(-Math.abs(newContent.length - avgLen) / Math.max(avgLen, 1) * 2);

  const sents    = (n: string) => n.split(/[.!?]+/).filter(s => s.trim().length > 8).length;
  const newSC    = sents(newContent);
  const avgSC    = ah.reduce((s, m) => s + sents(getTextFromContent(m.content)), 0) / ah.length;
  const struct   = Math.exp(-Math.abs(newSC - avgSC) / Math.max(avgSC, 1) * 1.5);

  const tf: Record<string, number> = {};
  recT.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
  const top     = Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
  const persist = top.length === 0 ? 1 : top.filter(t => newT.includes(t)).length / top.length;

  const lastReply       = getTextFromContent(ah[ah.length - 1]?.content || '');
  const lastReplyTokens = tokenize(lastReply);
  const overlap         = lastReplyTokens.length > 0
    ? lastReplyTokens.filter(w => newT.includes(w)).length / lastReplyTokens.length
    : 0;
  const repPenalty = overlap > repThreshold ? repThreshold : 1.0;

  const w   = weights;
  const raw = (w.tfidf * vocab + w.jsd * jsdScore + w.length * lenScore
             + w.structure * struct + w.persistence * persist) * repPenalty;

  return Math.min(Math.max(raw, 0.30), 0.99);
}
