import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Scatter
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  FILE: ARCHITECT.jsx  ← upload to GitHub with this exact name (all caps)
//  HUDSON & PERRY'S DRIFT LAW — ARCHITECT · V1.5.2
//  © Hudson & Perry Research
//  Authors: David Hudson (@RaccoonStampede)
//           David Perry (@Prosperous727)
//
//  ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE
//  This tool is experimental. All outputs are proxy indicators.
//  No warranty expressed or implied. Use at your own discretion.
//
//  V1.5.2 patches (applied in order — do not revert individually):
//    P1:  Version strings unified — export block, guide, framework all V1.5.2
//    P2:  Config save dep array — nPaths/postAuditMode/customMutePhrases/
//         researchNotes were missing, silently not persisting on change
//    P3:  corrections persistence — loaded from hpdl_data but never saved back
//    P4:  Rewind index bug — turnSnapshots[clickedTurn-1] broke after turn 20.
//         Fixed to .find(s=>s.turn===n) — works at any turn number
//    P5:  Bookmarks now save immediately on toggle — was only on next send
//    P6:  rewindConfirm cleared in resumeLive — stale dialog could linger
//    P7:  Post-audit now scores against finalMessages (includes new reply).
//         Previously used same inputs as rawScore so delta was always ~0
//         and quietFail never fired. Now genuinely measures second perspective.
//    P8:  finalDriftCount moved before meta-harness block — single source of
//         truth. meta-harness now uses finalDriftCount directly.
//    P9:  deleteTurn variance now uses updateSmoothedVariance (GARCH blend)
//         instead of raw population variance — prevents discontinuity in
//         research exports after any deletion
//    P10: corrections removed from sendMessage dep array — never read inside
//         sendMessage, only in UI render. Was causing unnecessary invalidation.
//    P11: HC_MASS_LOSS aliased to KAPPA — was hardcoded 0.444 literal,
//         now single source of truth
//    P12: Dead pruneThreshold/pruneKeep state documented — setters never
//         called, actual pruning uses cfg.pruneThreshold from preset
//    P13: chartData wrapped in useMemo — was sorting livePaths on every render
//    P14: PRECOMPUTED_PATHS performance note added — runs on main thread at load
//    P15: API key warning won't fire in Claude artifact sandbox (claude.ai)
//    P16: statusMessage state added — rewind/delete status now uses
//         setStatusMessage, file errors stay in setFileError
//
//  V1.5.2 cleanup (dead code removed, no behaviour change):
//    • jaccardSimilarity() — defined but never called anywhere. Removed.
//    • VAR_SMOOTH_ALPHA = 0.9 — declared but never referenced. Removed.
//    • p50 in sdePercentilesAtStep — computed but never destructured. Removed.
//    • PRECOMPUTED_PATHS — livePaths useMemo is what the chart uses. Removed.
//      Wrong comment referencing PRECOMPUTED_PATHS also corrected.
//    • P12 comment corrected — pruneThreshold/pruneKeep ARE wired to sliders
//      but only take effect in CUSTOM mode (preset value overrides via ??)
//
//  V1.5.0 additions:
//    • SDE path knob      — nPaths tunable in TUNE: dropdown 10/25/50/
//                           100/150/200/250/300/500 + custom input to 1000.
//                           Default 50 on load (saves tokens). Stored in
//                           hpdl_config. Warning shown when > 200.
//    • Post-audit         — second coherence pass after response generation.
//                           Toggle: Off / Light / Full in TUNE.
//                           Light: fires only when Kalman x̂ < 0.70.
//                           Full: every turn.
//                           Both: recompute rawC (TF-IDF+JSD+length),
//                           refresh sourceScore if attachments present.
//                           Delta logged — if post-audit C < live C by > 0.08,
//                           flagged as quiet fail in eventLog + RESEARCH CSV.
//    • Token thresholds   — tightened to 40k amber / 70k red (was 50k/80k).
//    • Mute phrase editor — custom mute phrases editable in TUNE panel.
//                           Add/remove phrases. Reset to defaults button.
//                           Stored in hpdl_config.
//    • Bookmark notes     — annotation field on each bookmark. Click to add
//                           a note (e.g. "example of topic hijack T7"). Saved
//                           with bookmark in hpdl_data.
//    • Health weights     — drift/B-sig/H-sig penalty weights exposed in
//                           CUSTOM preset config. Tunable per domain.
//    • Export toggle state — feature toggle state now included in EXPORT
//                           block so sessions resume with identical config.
//
//  V1.5.0 (prior): window.storage two-key split, Research Export CSV,
//                  Session UUID, token estimate, localStorage→window.storage
//  V1.4.8 (prior): κ & ANCHOR user-adjustable, R&D disclaimer, legal notice
//  V1.4.7 (prior): Industry presets, 11 feature toggles, TUNE modal
//  V1.4.6 (prior): Adaptive sigma EWMA, rate slider
//  V1.4.5 (prior): LOCK_888 avg C floor, B/H health penalties
//  V1.4.4 (prior): Bookmarks
//  V1.4.3 (prior): driftCount decay
//  V1.4.2 (prior): Error logging, pipe self-awareness
//  V1.4.1 (prior): Restored missing handleCopyExport
//  V1.4   (prior): GARCH, JSD, H-sigs, B-sigs, session health, rewind
//  V1.3   (prior): TF-IDF, mute startsWith, snapshot cap
// ═══════════════════════════════════════════════════════════════

// ── Deployment ─────────────────────────────────────────────────
const API_ENDPOINT = "https://api.anthropic.com/v1/messages"; // ← change to "/api/claude" on Vercel

// ── Feature toggles ────────────────────────────────────────────
// P17: These module-level constants are BOOT DEFAULTS only.
// All runtime logic uses featRAG, featPipe, featMute etc. state (toggleable in TUNE).
// These constants set the initial useState values and are not read after mount.
const USE_RAG            = true;
const RAG_TOP_K          = 3;
const PRUNE_THRESHOLD    = 8;
const PRUNE_KEEP         = 5;
const USE_PIPING         = true;
const USE_MUTE_MODE      = true;
const USE_DRIFT_GATE     = true;
const USE_ADAPTIVE_SIGMA = false; // default OFF — toggle in SDE params panel

// ── Mute mode — START-OF-MESSAGE phrases only ──────────────────
const MUTE_PHRASES     = [
  "how do i ","what should i","walk me through","give me a plan",
  "outline the steps","what are the steps","step by step",
  "list the steps","can you plan","create a roadmap","make a roadmap",
];
const MUTE_MAX_TOKENS  = 120;
const NORMAL_MAX_TOKENS = 1000;

// ── Variance thresholds ────────────────────────────────────────
const VAR_DECOHERENCE  = 0.200;
const VAR_CAUTION      = 0.120;
const VAR_CALM         = 0.080;
const LOCK_888_STREAK  = 5;

// ── Drift gate word limit ──────────────────────────────────────
const DRIFT_GATE_WORD_LIMIT = 120;

// ═══════════════════════════════════════════════════════════════
//  FILE SUPPORT
// ═══════════════════════════════════════════════════════════════
const FILE_TYPES = {
  image: {
    extensions: ["png","jpg","jpeg","gif","webp"],
    mimeTypes:  ["image/png","image/jpeg","image/gif","image/webp"],
    icon:"🖼", color:"#4A9EFF", label:"IMAGE", maxBytes:5*1024*1024,
  },
  pdf: {
    extensions:["pdf"], mimeTypes:["application/pdf"],
    icon:"📄", color:"#E05060", label:"PDF", maxBytes:32*1024*1024,
  },
  text: {
    extensions:[
      "txt","md","markdown","csv","xml","yaml","yml","json","html","htm",
      "css","js","jsx","ts","tsx","py","sh","bash","c","cpp","h","hpp",
      "java","rb","go","rs","swift","kt","sql","r","scala","php","vue",
      "svelte","toml","ini",
    ],
    mimeTypes:[], icon:"📝", color:"#40D080", label:"TEXT", maxBytes:2*1024*1024,
  },
};

function classifyFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase()??"";
  if (FILE_TYPES.image.mimeTypes.includes(file.type)||FILE_TYPES.image.extensions.includes(ext)) return "image";
  if (FILE_TYPES.pdf.mimeTypes.includes(file.type)||ext==="pdf") return "pdf";
  if (FILE_TYPES.text.extensions.includes(ext)||file.type.startsWith("text/")) return "text";
  return null;
}

const ACCEPTED_EXTENSIONS = [
  ...FILE_TYPES.image.extensions,
  ...FILE_TYPES.pdf.extensions,
  ...FILE_TYPES.text.extensions,
].map(e=>`.${e}`).join(",");

function fileToBase64(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result.split(",")[1]);
    r.onerror=()=>rej(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}
function fileToText(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=()=>rej(new Error("Failed to read file"));
    r.readAsText(file);
  });
}

async function buildMessageContent(text,attachments) {
  if (!attachments.length) return text;
  const blocks=[];
  for (const att of attachments) {
    if (att.kind==="image")
      blocks.push({type:"image",source:{type:"base64",media_type:att.mimeType,data:att.data}});
    else if (att.kind==="pdf")
      blocks.push({type:"document",source:{type:"base64",media_type:"application/pdf",data:att.data}});
    else if (att.kind==="text")
      blocks.push({type:"text",text:`[Attached: ${att.name}]\n\`\`\`\n${att.text}\n\`\`\``});
  }
  if (text.trim()) blocks.push({type:"text",text:text.trim()});
  return blocks;
}

// ═══════════════════════════════════════════════════════════════
//  CORE CONSTANTS
// ═══════════════════════════════════════════════════════════════
const KAPPA            = 0.444;
const DAMPING          = 1/(1+KAPPA);
const EPSILON          = 0.05;
const BETA_C           = 0.2;
const ALPHA_S          = 1.8;
const RESONANCE_ANCHOR = 623.81;
const AGAPE_STAB       = 0.1;
const SENSITIVITY      = 0.30;
const HALO_THRESHOLD   = 0.0004*(1+SENSITIVITY);
const KALMAN_R         = 0.015;
const KALMAN_SIGMA_P   = 0.06;
const LOCK_888         = 0.888;
const HC_MASS_LOSS     = KAPPA; // P11: was 0.444 literal — aliased to KAPPA (same value, single source of truth)

const SDE_PARAMS = {alpha:-0.25,beta_p:0.18,omega:2*Math.PI/12,sigma:0.10,kappa:KAPPA};

const HARNESS_MODES = {
  audit:    {gamma_h:0.05,   label:"AUDIT",      color:"#C8860A",threshold:1.1 },
  moderate: {gamma_h:50,     label:"MODERATE",   color:"#E8A030",threshold:0.72},
  deep:     {gamma_h:5000,   label:"DEEP CLEAN", color:"#1EAAAA",threshold:0.62},
  extreme:  {gamma_h:10000,  label:"EXTREME",    color:"#E05060",threshold:0.50},
};

// ── LCG RNG ────────────────────────────────────────────────────
function makeRng(seed=42) {
  let s=seed>>>0;
  return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
function randn(rng) {
  const u1=Math.max(rng(),1e-10),u2=rng();
  return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
}

// ── SDE ────────────────────────────────────────────────────────
function simulateSDE(params,T,dt=0.02,nPaths=50,seed=42) {
  const {alpha,beta_p,omega,sigma,kappa}=params;
  const lam=1/(1+kappa),nSteps=Math.ceil(T/dt),rng=makeRng(seed),paths=[];
  for (let p=0;p<nPaths;p++) {
    const path=new Float32Array(nSteps+1);path[0]=0;
    for (let i=1;i<=nSteps;i++) {
      const t=i*dt,a_t=lam*(alpha+beta_p*Math.sin(omega*t)),b=lam*sigma;
      path[i]=path[i-1]+a_t*path[i-1]*dt+b*Math.sqrt(dt)*randn(rng);
    }
    paths.push(path);
  }
  return paths;
}

function sdePercentilesAtStep(paths,step) {
  const vals=paths.map(p=>p[Math.min(step,p.length-1)]).sort((a,b)=>a-b),n=vals.length;
  return {p10:vals[Math.floor(n*.10)],p90:vals[Math.floor(n*.90)]};
}

// ── Kalman ─────────────────────────────────────────────────────
function kalmanStep(state,obs,t,params,kalR,kalSigP) {
  const {alpha,beta_p,omega,kappa}=params;
  const lam=1/(1+kappa),a_t=lam*(alpha+beta_p*Math.sin(omega*t)),F=1+a_t;
  const Q=Math.pow((kalSigP??KALMAN_SIGMA_P)*lam,2),x_p=F*state.x,P_p=F*F*state.P+Q,K=P_p/(P_p+(kalR??KALMAN_R));
  return {x:x_p+K*(obs-x_p),P:(1-K)*P_p};
}

// ── Drift Law ──────────────────────────────────────────────────
function driftLawCapEff(gamma_h){return EPSILON/(1+gamma_h);}
function driftLawFloor(n,gamma_h) {
  const ce=driftLawCapEff(gamma_h),tau=Math.max(.0225/EPSILON,1);
  const sys=ce*(1-Math.exp(-Math.pow(Math.max(n,.001),ALPHA_S)/tau));
  return sys+Math.abs(BETA_C*Math.sin(gamma_h*n*.01))*.05;
}

// ── Zero-Drift Lock ────────────────────────────────────────────
function applyZeroDriftLock(cur,anchor=RESONANCE_ANCHOR,maxIter=200) {
  let val=cur,iters=0;
  for (let i=0;i<maxIter;i++) {
    if (Math.abs(val-anchor)<HALO_THRESHOLD){iters=i;break;}
    val+=(anchor-val)*DAMPING*AGAPE_STAB;iters=i+1;
  }
  return {val,locked:Math.abs(val-anchor)<HALO_THRESHOLD,iters,residual:Math.abs(val-anchor)};
}

// ── Variance smoother — GARCH(1,1) ────────────────────────────
const GARCH_OMEGA = 0.02;
const GARCH_ALPHA = 0.15;
const GARCH_BETA  = 0.80;

// ═══════════════════════════════════════════════════════════════
//  INDUSTRY PRESETS — V1.5.0
//  κ=0.444 and RESONANCE_ANCHOR are NOT in presets — they are
//  the Hudson Constants and remain fixed in all modes.
//  Everything else is tunable per industry/use-case.
// ═══════════════════════════════════════════════════════════════
const PRESETS = {
  DEFAULT: {
    label:"DEFAULT", color:"#7AB8D8",
    description:"Original Hudson & Perry settings",
    varDecoherence:0.200, varCaution:0.120, varCalm:0.080,
    lock888Streak:5, lock888AvgCFloor:0.72,
    driftGateWordLimit:120, muteMaxTokens:120,
    garchOmega:0.02, garchAlpha:0.15, garchBeta:0.80,
    sdeAlpha:-0.25, sdeBetaP:0.18, sdeSigma:0.10,
    pruneThreshold:8, pruneKeep:5,
    driftEscalateMod:3, driftEscalateDeep:5, driftEscalateExtreme:8,
    healthDriftWeight:8, healthBSigWeight:4, healthHSigWeight:6, // penalty per event
  },
  TECHNICAL: {
    label:"TECHNICAL", color:"#1EAAAA",
    description:"Code reviews, audits, engineering — tighter variance tolerance, longer responses allowed",
    varDecoherence:0.180, varCaution:0.100, varCalm:0.060,
    lock888Streak:5, lock888AvgCFloor:0.75,
    driftGateWordLimit:200, muteMaxTokens:200,
    garchOmega:0.02, garchAlpha:0.12, garchBeta:0.83,
    sdeAlpha:-0.30, sdeBetaP:0.15, sdeSigma:0.08,
    pruneThreshold:10, pruneKeep:6,
    driftEscalateMod:3, driftEscalateDeep:5, driftEscalateExtreme:8,
    healthDriftWeight:10, healthBSigWeight:3, healthHSigWeight:8,
  },
  CREATIVE: {
    label:"CREATIVE", color:"#C8860A",
    description:"Writing, brainstorming, narrative — looser coherence, less elaboration penalty",
    varDecoherence:0.280, varCaution:0.160, varCalm:0.100,
    lock888Streak:4, lock888AvgCFloor:0.65,
    driftGateWordLimit:300, muteMaxTokens:300,
    garchOmega:0.03, garchAlpha:0.18, garchBeta:0.75,
    sdeAlpha:-0.18, sdeBetaP:0.22, sdeSigma:0.14,
    pruneThreshold:6, pruneKeep:4,
    driftEscalateMod:4, driftEscalateDeep:7, driftEscalateExtreme:12,
    healthDriftWeight:5, healthBSigWeight:2, healthHSigWeight:4,
  },
  RESEARCH: {
    label:"RESEARCH", color:"#8888FF",
    description:"Academic, long-form analysis — extended context, topic shifts expected",
    varDecoherence:0.220, varCaution:0.130, varCalm:0.085,
    lock888Streak:6, lock888AvgCFloor:0.70,
    driftGateWordLimit:250, muteMaxTokens:180,
    garchOmega:0.02, garchAlpha:0.13, garchBeta:0.82,
    sdeAlpha:-0.22, sdeBetaP:0.20, sdeSigma:0.11,
    pruneThreshold:12, pruneKeep:8,
    driftEscalateMod:4, driftEscalateDeep:6, driftEscalateExtreme:10,
    healthDriftWeight:8, healthBSigWeight:5, healthHSigWeight:7,
  },
  MEDICAL: {
    label:"MEDICAL/LEGAL", color:"#E05060",
    description:"High-stakes domains — tightest settings, most aggressive harness, lowest H-sig tolerance",
    varDecoherence:0.150, varCaution:0.090, varCalm:0.055,
    lock888Streak:6, lock888AvgCFloor:0.80,
    driftGateWordLimit:80, muteMaxTokens:80,
    garchOmega:0.015, garchAlpha:0.10, garchBeta:0.87,
    sdeAlpha:-0.35, sdeBetaP:0.12, sdeSigma:0.07,
    pruneThreshold:6, pruneKeep:5,
    driftEscalateMod:2, driftEscalateDeep:4, driftEscalateExtreme:6,
    healthDriftWeight:12, healthBSigWeight:6, healthHSigWeight:10,
  },
  CUSTOM: {
    label:"CUSTOM", color:"#40D080",
    description:"User-defined — edit any parameter below",
    // CUSTOM inherits DEFAULT values as starting point
    varDecoherence:0.200, varCaution:0.120, varCalm:0.080,
    lock888Streak:5, lock888AvgCFloor:0.72,
    driftGateWordLimit:120, muteMaxTokens:120,
    garchOmega:0.02, garchAlpha:0.15, garchBeta:0.80,
    sdeAlpha:-0.25, sdeBetaP:0.18, sdeSigma:0.10,
    pruneThreshold:8, pruneKeep:5,
    driftEscalateMod:3, driftEscalateDeep:5, driftEscalateExtreme:8,
    healthDriftWeight:8, healthBSigWeight:4, healthHSigWeight:6,
  },
};

function updateSmoothedVariance(history, prev) {
  if (history.length<2) return prev??0;
  const recent=history.slice(-20);
  const mean=recent.reduce((s,v)=>s+v,0)/recent.length;
  const rawVar=recent.reduce((s,v)=>s+Math.pow(v-mean,2),0)/recent.length;
  if (prev===null) return rawVar;
  const lastVal=history[history.length-1];
  const epsilon2=Math.pow(lastVal-mean,2);
  const garch=GARCH_OMEGA+GARCH_ALPHA*epsilon2+GARCH_BETA*prev;
  const weight=Math.min(history.length/10,1);
  return weight*garch+(1-weight)*rawVar;
}

// ── Tokenize / TF-IDF weighted similarity ─────────────────────
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(/\s+/).filter(w=>w.length>2);
}

const STOP_WORDS=new Set(["the","and","for","that","this","with","are","was","were","has",
  "have","had","not","but","from","they","their","what","which","when","been","will",
  "would","could","should","does","did","its","you","your","our","can","all","one",
  "also","more","than","then","just","into","over","after","about","there","these"]);

function buildTfIdf(tokens) {
  if (!tokens||!tokens.length) return {};
  const tf={};
  tokens.forEach(w=>{if(!STOP_WORDS.has(w))tf[w]=(tf[w]||0)+1;});
  const total=Object.values(tf).reduce((s,v)=>s+v,0)||1;
  Object.keys(tf).forEach(w=>tf[w]=tf[w]/total);
  return tf;
}

function tfidfSimilarity(tokensA, tokensB) {
  const tfA=buildTfIdf(tokensA), tfB=buildTfIdf(tokensB);
  const allTerms=new Set([...Object.keys(tfA),...Object.keys(tfB)]);
  if (!allTerms.size) return 1;
  let dot=0,normA=0,normB=0;
  allTerms.forEach(term=>{
    const inA=term in tfA?1:0, inB=term in tfB?1:0;
    const idf=(inA+inB>0)?Math.log(2/(inA+inB)):0;
    const a=(tfA[term]||0)*idf, b=(tfB[term]||0)*idf;
    dot+=a*b; normA+=a*a; normB+=b*b;
  });
  const denom=Math.sqrt(normA)*Math.sqrt(normB);
  return denom===0?0:Math.min(dot/denom,1);
}

// ── Jensen-Shannon Divergence ──────────────────────────────────
function buildTermFreqDist(tokens) {
  if (!tokens||!tokens.length) return {};
  const freq={};
  tokens.forEach(w=>{if(!STOP_WORDS.has(w))freq[w]=(freq[w]||0)+1;});
  const total=Object.values(freq).reduce((s,v)=>s+v,0)||1;
  const dist={};
  Object.keys(freq).forEach(w=>dist[w]=freq[w]/total);
  return dist;
}

function jensenShannonDivergence(tokensA, tokensB) {
  const pA=buildTermFreqDist(tokensA), pB=buildTermFreqDist(tokensB);
  const allTerms=new Set([...Object.keys(pA),...Object.keys(pB)]);
  if (!allTerms.size) return 0;
  const M={};
  allTerms.forEach(t=>{M[t]=((pA[t]||0)+(pB[t]||0))/2;});
  const klPM=Array.from(allTerms).reduce((s,t)=>{
    const p=pA[t]||0,m=M[t]||1e-10;
    return p>0?s+p*Math.log(p/m):s;
  },0);
  const klQM=Array.from(allTerms).reduce((s,t)=>{
    const q=pB[t]||0,m=M[t]||1e-10;
    return q>0?s+q*Math.log(q/m):s;
  },0);
  return Math.min(1,Math.max(0,(klPM+klQM)/(2*Math.log(2))));
}

function getTextFromContent(c) {
  if (typeof c==="string") return c;
  if (Array.isArray(c)) return c.filter(b=>b.type==="text").map(b=>b.text).join(" ");
  return "";
}

// ── Coherence ──────────────────────────────────────────────────
function computeCoherence(newContent,history,weights,repThresh) {
  const ah=history.filter(m=>m.role==="assistant");
  if (!ah.length) return 0.88;
  const newT=tokenize(newContent);
  const recT=tokenize(ah.slice(-4).map(m=>getTextFromContent(m.content)).join(" "));
  const vocab=tfidfSimilarity(newT,recT);
  const jsd=jensenShannonDivergence(newT,recT);
  const jsdScore=1-jsd;
  const avgLen=ah.reduce((s,m)=>s+getTextFromContent(m.content).length,0)/ah.length;
  const lenScore=Math.exp(-Math.abs(newContent.length-avgLen)/Math.max(avgLen,1)*2);
  const sents=n=>n.split(/[.!?]+/).filter(s=>s.trim().length>8).length;
  const newSC=sents(newContent),avgSC=ah.reduce((s,m)=>s+sents(getTextFromContent(m.content)),0)/ah.length;
  const struct=Math.exp(-Math.abs(newSC-avgSC)/Math.max(avgSC,1)*1.5);
  const tf={};recT.forEach(w=>{tf[w]=(tf[w]||0)+1;});
  const top=Object.entries(tf).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>e[0]);
  const persist=top.length===0?1:top.filter(t=>newT.includes(t)).length/top.length;
  const lastReply=getTextFromContent(ah[ah.length-1]?.content||"");
  const lastReplyTokens=tokenize(lastReply);
  const overlap=lastReplyTokens.length>0
    ?lastReplyTokens.filter(w=>newT.includes(w)).length/lastReplyTokens.length
    :0;
  const rt=repThresh??0.65;
  const repetitionPenalty=overlap>rt?rt:1.0;
  const w=weights??{tfidf:0.25,jsd:0.25,length:0.25,structure:0.15,persistence:0.10};
  return Math.min(Math.max((w.tfidf*vocab+w.jsd*jsdScore+w.length*lenScore+w.structure*struct+w.persistence*persist)*repetitionPenalty,.30),.99);
}

// ═══════════════════════════════════════════════════════════════
//  MUTE MODE
// ═══════════════════════════════════════════════════════════════
function detectMuteMode(text, phrases) {
  if (!USE_MUTE_MODE||!text||text.length<8) return false;
  const lower = text.toLowerCase().trimStart();
  return (phrases??MUTE_PHRASES).some(phrase => lower.startsWith(phrase));
}

function buildMuteInjection(cfg) {
  const cap=cfg?.muteMaxTokens??MUTE_MAX_TOKENS;
  return `\n\n[MUTE_MODE ACTIVE]\nRespond in ${cap/8|0} words or fewer. ` +
    `One direct answer. No elaboration, no follow-up steps unless explicitly asked.`;
}

// ═══════════════════════════════════════════════════════════════
//  DRIFT GATE
// ═══════════════════════════════════════════════════════════════
function buildDriftGateInjection(smoothedVar,cfg) {
  const caution=cfg?.varCaution??VAR_CAUTION;
  const decohere=cfg?.varDecoherence??VAR_DECOHERENCE;
  const wordLim=cfg?.driftGateWordLimit??DRIFT_GATE_WORD_LIMIT;
  if (!USE_DRIFT_GATE||smoothedVar===null||smoothedVar<=caution) return "";
  const severity=smoothedVar>decohere?"CRITICAL":"ELEVATED";
  return `\n\n[DRIFT_GATE — Variance ${severity}: σ²=${smoothedVar.toFixed(4)}]\n` +
    `Hard limit: respond in ${wordLim} words or fewer. ` +
    `No new frameworks. No unsolicited steps. Reference only prior established context.`;
}

// ═══════════════════════════════════════════════════════════════
//  PIPING ENGINE
// ═══════════════════════════════════════════════════════════════
function buildPipeInjection(smoothedVar,kalmanX,kalmanP,calmStreak,driftCount,harnessMode,turn,hSignalCount,bSignalCount,adaptedSig) {
  if (!USE_PIPING||turn<2) return "";
  const varState=smoothedVar>VAR_DECOHERENCE?"DECOHERENCE"
    :smoothedVar>VAR_CAUTION?"CAUTION"
    :smoothedVar<VAR_CALM?"CALM":"NOMINAL";
  const directive=smoothedVar>VAR_DECOHERENCE
    ?`Re-align to Resonance Anchor ${RESONANCE_ANCHOR} Hz. One sentence only. No questions. No elaboration. Direct answer.`
    :smoothedVar>VAR_CAUTION
    ?`Variance rising. Consolidate. Increase term persistence.`
    :smoothedVar<VAR_CALM&&calmStreak>=3
    ?`Coherence stable. Maintain current density and terminology. One question maximum.`
    :`Answer directly. No unrequested content. Maximum one follow-up question.`;
  const hLine=hSignalCount>0
    ?`\nH-Signals fired this session: ${hSignalCount} — you have exhibited high-confidence language or source inconsistency. Correct.`
    :"";
  const bLine=bSignalCount>0
    ?`\nB-Signals fired this session: ${bSignalCount} — you have exhibited sycophancy, hype, or off-task elaboration. Correct.`
    :"";
  const sigmaLine=adaptedSig!=null
    ?`\nσ_adapted=${adaptedSig.toFixed(5)} (live EWMA) | κ=0.444 (fixed)`
    :"";
  return `\n\n[SYSTEM_INTERNAL — HUDSON & PERRY PIPE | Turn ${turn}]` +
    `\nσ²=${smoothedVar.toFixed(6)} | State=${varState}` +
    `\nKalman x̂=${kalmanX.toFixed(4)} | P=${kalmanP.toFixed(5)}` +
    `\nCalm=${calmStreak} | Drift=${driftCount} | Mode=${harnessMode.toUpperCase()}` +
    `\nH-Sigs=${hSignalCount} | B-Sigs=${bSignalCount}` +
    sigmaLine + hLine + bLine +
    `\nDirective: ${directive}\n[END PIPE]`;
}

// ═══════════════════════════════════════════════════════════════
//  RAG
// ═══════════════════════════════════════════════════════════════
function buildRagEntry(content,score,turn) {
  const text=getTextFromContent(content);
  return {turn,text,tokens:tokenize(text),score};
}
function ragRetrieve(query,cache,k=RAG_TOP_K) {
  if (!cache.length||!query?.trim()) return [];
  const qt=tokenize(query);
  return cache.map(e=>({...e,sim:tfidfSimilarity(qt,e.tokens)}))
    .sort((a,b)=>b.sim-a.sim).slice(0,k).filter(e=>e.sim>.05);
}
function formatRagContext(retrieved) {
  if (!retrieved.length) return "";
  return `\n\n[RAG MEMORY — ${retrieved.length} turn(s)]\n`+
    retrieved.map(e=>`[T${e.turn}|C=${e.score.toFixed(3)}|sim=${e.sim.toFixed(3)}]\n${e.text.slice(0,300)}${e.text.length>300?"…":""}`).join("\n\n")+
    `\n[END RAG]`;
}

// ── Context pruning ────────────────────────────────────────────
function pruneContext(messages,coherenceData,threshold=PRUNE_THRESHOLD,keep=PRUNE_KEEP) {
  const assistantCount=messages.filter(m=>m.role==="assistant").length;
  if (assistantCount<=threshold) return messages;
  const pairs=[];let ai=0;
  for (let i=0;i<messages.length-1;i++) {
    if (messages[i].role==="user"&&messages[i+1]?.role==="assistant") {
      pairs.push({user:messages[i],assistant:messages[i+1],score:coherenceData[ai]?.raw??0.5,idx:ai});
      ai++;i++;
    }
  }
  if (!pairs.length) return messages;
  const keepLast=new Set(pairs.slice(-3).map(p=>p.idx));
  const topScored=[...pairs].sort((a,b)=>b.score-a.score).slice(0,keep).map(p=>p.idx);
  const keepIdx=new Set([...keepLast,...topScored]);
  return pairs.filter(p=>keepIdx.has(p.idx)).flatMap(p=>[p.user,p.assistant]);
}

// ── Chat export ────────────────────────────────────────────────
function downloadChat(messages, coherenceData, eventLog, sessionId, userKappa, userAnchor) {
  const kappaNote = userKappa!==0.444?` [MODIFIED]`:"";
  const anchorNote = userAnchor!==623.81?` [MODIFIED]`:"";
  const stamp = [
    `HUDSON & PERRY'S DRIFT LAW — CHAT EXPORT`,
    `EXPERIMENTAL DATA — PROXY INDICATORS ONLY`,
    `Session ID: ${sessionId??'—'}  ·  ${new Date().toISOString()}`,
    `κ: ${userKappa}${kappaNote}  ·  ANCHOR: ${userAnchor}${anchorNote}`,
    ``,
  ].join("\n");
  const auditRows=coherenceData.map((d,i)=>{
    const turn=i+1;
    const status=d.raw>0.80?"✓ OK":d.raw>0.55?"△ WATCH":"⚠ DRIFT";
    const mode=d.mode?.toUpperCase()||"AUDIT";
    const flags=[
      d.harnessActive?"DRIFT":"",
      d.smoothedVar>VAR_DECOHERENCE?"DECOHERENCE":"",
      d.smoothedVar>VAR_CAUTION&&d.smoothedVar<=VAR_DECOHERENCE?"CAUTION":"",
      d.hallucinationFlag?"⚠H-SIGNAL":"",
      d.sourceScore!=null&&d.sourceScore<0.08?"LOW-SRC":"",
    ].filter(Boolean).join(" ");
    return `  T${String(turn).padEnd(3)} | C=${d.raw.toFixed(3)} | K=${d.kalman.toFixed(3)} | ${status.padEnd(8)} | ${mode.padEnd(10)} | ${flags||"—"}`;
  });
  const hSignalCount=eventLog.filter(e=>e.type==="probable_hallucination_signal").length;
  const auditTable=auditRows.length
    ?`AUDIT SUMMARY\n${"─".repeat(70)}\n  Turn | Score | Kalman | Status   | Mode       | Flags\n${"─".repeat(70)}\n${auditRows.join("\n")}\n${"─".repeat(70)}\n\nDrift events: ${coherenceData.filter(d=>d.harnessActive).length} | Avg C: ${coherenceData.length?(coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length).toFixed(3):"N/A"} | ⚠ H-Signals: ${hSignalCount}\nNote: H-Signals are proxy indicators only — not confirmed hallucinations.\n\n`
    :"";
  const lines=messages.map(m=>{
    const role=m.role==="user"?"USER":"ASSISTANT";
    const text=m._display??getTextFromContent(m.content);
    return `[${role}]\n${text}`;
  }).join("\n\n─────────────────────────────────────────\n\n");
  return {
    title:`CHAT EXPORT · ${sessionId??'—'}`,
    filename:`hpdl_chat_${sessionId??Date.now()}.txt`,
    text:`${stamp}\n${"═".repeat(70)}\n\n${auditTable}CONVERSATION\n${"─".repeat(70)}\n\n${lines}`,
  };
}

// ── Event log ──────────────────────────────────────────────────
function downloadLog(eventLog, sessionId) {
  return {
    title:`ARCHITECT LOG · ${sessionId??'—'}`,
    filename:`hpdl_architect_${sessionId??Date.now()}.jsonl`,
    text:eventLog.map(e=>JSON.stringify(e)).join("\n")||"(no events)",
  };
}

// V1.5.0: Research Export — CSV per-turn metrics + JSONL bundle
// Stamped with session UUID, timestamp, active constants.
function downloadResearch(coherenceData, eventLog, sessionId, userKappa, userAnchor, activePreset, researchNotes) {
  const ts = new Date().toISOString();
  const kappaNote = userKappa!==0.444?` [MODIFIED from 0.444]`:"";
  const anchorNote = userAnchor!==623.81?` [MODIFIED from 623.81]`:"";
  const header = [
    `HUDSON & PERRY'S DRIFT LAW — RESEARCH EXPORT`,
    `EXPERIMENTAL DATA — PROXY INDICATORS ONLY — NOT FOR CLINICAL/LEGAL USE`,
    `Session ID: ${sessionId}`,
    `Exported:   ${ts}`,
    `Profile:    ${activePreset??'DEFAULT'}`,
    `κ used:     ${userKappa}${kappaNote}`,
    `ANCHOR used:${userAnchor}${anchorNote}`,
    ``,
    `No warranty. All scores are mathematical proxies. See full disclaimer in app.`,
    researchNotes?`\nRESEARCH NOTES:\n${researchNotes}`:"",
    `© 2026 Hudson & Perry Research — @RaccoonStampede · @Prosperous727`,
    ``,
  ].join("\n");

  // CSV
  const csvHeader = "turn,rawC,kalman,smoothedVar,driftEvent,mode,hallucinationFlag,behavioralFlag,sourceScore,health,postAuditScore,quietFail\n";
  const csvRows = coherenceData.map((d,i)=>{
    const health = (() => {
      const avgC = coherenceData.slice(0,i+1).reduce((s,x)=>s+x.raw,0)/(i+1);
      const dc = coherenceData.slice(0,i+1).filter(x=>x.harnessActive).length;
      const bP = Math.min(coherenceData.slice(0,i+1).filter(x=>x.behavioralFlag).length*4,20);
      const hP = Math.min(coherenceData.slice(0,i+1).filter(x=>x.hallucinationFlag).length*6,18);
      return Math.min(100,Math.max(0,Math.round(avgC*100)-Math.min(dc*8,40)-bP-hP));
    })();
    return [
      i+1,
      d.raw?.toFixed(4)??"",
      d.kalman?.toFixed(4)??"",
      d.smoothedVar?.toFixed(6)??"",
      d.harnessActive?1:0,
      d.mode??"",
      d.hallucinationFlag?1:0,
      d.behavioralFlag?1:0,
      d.sourceScore!=null?d.sourceScore.toFixed(4):"",
      health,
      d.postAuditScore!=null?d.postAuditScore.toFixed(4):"",
      d.quietFail?1:0,
    ].join(",");
  }).join("\n");

  // JSONL event log
  const jsonl = eventLog.map(e=>JSON.stringify(e)).join("\n");

  const content = [
    header,
    "═".repeat(60),
    "METRICS CSV",
    "═".repeat(60),
    csvHeader + csvRows,
    "",
    "═".repeat(60),
    "EVENT LOG (JSONL)",
    "═".repeat(60),
    jsonl||"(no events)",
  ].join("\n");

  return {
    title:`RESEARCH EXPORT · ${sessionId??'—'}`,
    filename:`hpdl_RESEARCH_${sessionId}_${Date.now()}.txt`,
    text:content,
  };
}

// V1.5.0: SDE Path Export — live simulation paths + session metrics
// For surrogate model training and offline analysis.
function downloadSdePaths(livePaths, coherenceData, sessionId, nPaths, userKappa) {
  const ts = new Date().toISOString();
  const header = [
    'HUDSON & PERRY SDE PATH EXPORT',
    'EXPERIMENTAL DATA — PROXY INDICATORS ONLY — NOT FOR CLINICAL/LEGAL USE',
    'Session ID: ' + sessionId,
    'Exported:   ' + ts,
    'nPaths:     ' + nPaths,
    'kappa used: ' + userKappa,
    '',
    'Format: path_index, step, value',
    'Each path = one Monte Carlo SDE simulation.',
    'Steps correspond to chart turns (step = turn * 15).',
    '',
    'No warranty. All values are mathematical proxies.',
    '© 2026 Hudson & Perry Research — @RaccoonStampede · @Prosperous727',
    '',
  ].join('\n');

  // Export all path values as CSV
  const rows = ['path,step,value'];
  if (livePaths && livePaths.length) {
    livePaths.forEach((path, pi) => {
      // Sample every 15 steps (one per turn) to keep size manageable
      for (let s = 0; s < path.length; s += 15) {
        rows.push(pi + ',' + s + ',' + (path[s] || 0).toFixed(6));
      }
    });
  }

  // Include raw coherence scores alongside for correlation
  const cohRows = ['\nturn,rawC,kalman,smoothedVar'];
  coherenceData.forEach((d, i) => {
    cohRows.push((i+1) + ',' + (d.raw||0).toFixed(4) + ',' + (d.kalman||0).toFixed(4) + ',' + (d.smoothedVar||0).toFixed(6));
  });

  const content = [header, rows.join('\n'), cohRows.join('\n')].join('\n');
  return {
    title: 'SDE PATHS · ' + nPaths + ' paths · ' + (sessionId||'—'),
    filename: 'hpdl_SDE_' + nPaths + 'paths_' + (sessionId||Date.now()) + '.csv',
    text: content,
  };
}

// ── System prompt ──────────────────────────────────────────────
const BASE_SYSTEM =
  `You are a highly precise technical assistant operating within Hudson & Perry's Drift Law ARCHITECT V1.5.2 coherence framework. `+
  `Maintain strict logical consistency across all turns. Reference prior context explicitly when building on it. `+
  `When files are attached, analyze them thoroughly. `+
  `When RAG MEMORY is provided, treat it as recalled context. `+
  `When SYSTEM_INTERNAL PIPE data is present, act on its directive immediately. `+
  `When MUTE_MODE or DRIFT_GATE is active, respect the word limit strictly.\n`+
  `MONITORING: Every response you generate is scored, classified, and logged. If the PIPE reports H-Signals or B-Signals fired, those are confirmed detections — you have already exhibited that behavior in this session. Correct immediately.\n`+
  `BEHAVIORAL RULES (non-negotiable):\n`+
  `- Answer the question asked. Do not generate unrequested content, diagrams, or artifacts.\n`+
  `- Ask at most ONE follow-up question per response. Never ask multiple questions.\n`+
  `- Do not perform helpfulness. Short direct answers score higher than elaborate ones.\n`+
  `- If you are uncertain, say so plainly. Do not fill uncertainty with plausible-sounding detail.\n`+
  `- Never change subject or reframe the question to something easier to answer.`;

const HARNESS_INJECTIONS = {
  audit:    "",
  moderate: `\n\n[COHERENCE MONITOR — Moderate | κ=0.444 | γ_h=50]\nMaintain consistency. Reduce terminology variance.`,
  deep:     `\n\n[COHERENCE HARNESS — Deep Clean | κ=0.444 | γ_h=5000]\nDrift detected. Every claim must trace to established context.`,
  extreme:  `\n\n[COHERENCE HARNESS — EXTREME | κ=0.444 | γ_h=10000]\nCRITICAL DRIFT. One claim at a time. Ground every sentence in prior facts.`,
};

// ── Session export ─────────────────────────────────────────────
function buildExportBlock(s) {
  const {kalmanState,harnessMode,driftCount,turnCount,lastScore,
         coherenceData,ragCache,smoothedVar,calmStreak,lock888Achieved,
         userKappa,userAnchor,activePreset,
         featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
         featGate,featBSig,featHSig,featPrune,featZeroDrift,
         nPaths,postAuditMode}=s;
  const mode=HARNESS_MODES[harnessMode],cap_eff=driftLawCapEff(mode.gamma_h);
  const liveDamp=1/(1+(userKappa??KAPPA));
  const anchor=userAnchor??RESONANCE_ANCHOR;
  const lock=applyZeroDriftLock(anchor-(lastScore??0)*.01,anchor);
  const avgC=coherenceData.length?(coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length).toFixed(4):"N/A";
  const ragSummary=ragCache.length
    ?ragCache.map(e=>`  T${e.turn}|C=${e.score.toFixed(3)}: ${e.text.slice(0,120).replace(/\n/g," ")}…`).join("\n")
    :"  (empty)";
  const kappaNote=(userKappa??KAPPA)!==KAPPA?` ⚠ MODIFIED from 0.444`:"";
  const anchorNote=(userAnchor??RESONANCE_ANCHOR)!==RESONANCE_ANCHOR?` ⚠ MODIFIED from 623.81`:"";
  return `START_MISSION_PROTOCOL: HUDSON_PERRY_DRIFT_ARCHITECT_V1.5.2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hudson & Perry's Drift Law — ARCHITECT V1.5.2
© Hudson & Perry Research
⚠ R&D ONLY — Proxy indicators, no warranty

1. FEATURES ACTIVE
Profile:${activePreset??'DEFAULT'} | RAG:${USE_RAG} | Pipe:${USE_PIPING}
MuteMode:${USE_MUTE_MODE} | DriftGate:${USE_DRIFT_GATE}
Prune:>${PRUNE_THRESHOLD}msg→top ${PRUNE_KEEP}

1b. FEATURE TOGGLES (live)
Kalman:${s.featKalman??true} | GARCH:${s.featGARCH??true} | SDE:${s.featSDE??true}
RAG:${s.featRAG??true} | Pipe:${s.featPipe??true} | Mute:${s.featMute??true}
Gate:${s.featGate??true} | BSig:${s.featBSig??true} | HSig:${s.featHSig??true}
Prune:${s.featPrune??true} | ZeroDrift:${s.featZeroDrift??true}
nPaths:${s.nPaths??50} | PostAudit:${s.postAuditMode??'off'}

2. CONSTANTS (user-set)
κ:${(userKappa??KAPPA).toFixed(4)}${kappaNote} | DAMPING:${liveDamp.toFixed(4)} | ε:${EPSILON}
RESONANCE_ANCHOR:${anchor} Hz${anchorNote} | LOCK_888:${LOCK_888}
AGAPE_STAB:${AGAPE_STAB} | SENSITIVITY:${SENSITIVITY} | HALO:${HALO_THRESHOLD.toFixed(6)}
SDE: α=${SDE_PARAMS.alpha} | β_p=${SDE_PARAMS.beta_p} | ω=${SDE_PARAMS.omega.toFixed(4)}
KALMAN_R:${KALMAN_R} | KALMAN_SIGMA_P:${KALMAN_SIGMA_P}
VAR: DECOHERENCE=${VAR_DECOHERENCE} | CAUTION=${VAR_CAUTION} | CALM=${VAR_CALM}

3. LIVE SESSION STATE
KALMAN_X:${kalmanState.x.toFixed(6)} | KALMAN_P:${kalmanState.P.toFixed(6)}
MODE:${harnessMode.toUpperCase()} | GAMMA_H:${mode.gamma_h} | CAP_EFF:${cap_eff.toFixed(8)}
DRIFT_COUNT:${driftCount} | TURN_COUNT:${turnCount}
LAST_C:${lastScore!=null?lastScore.toFixed(6):"N/A"} | AVG_C:${avgC}
SMOOTHED_VAR:${(smoothedVar??0).toFixed(6)} | CALM_STREAK:${calmStreak}
LOCK_888:${lock888Achieved?"ACHIEVED":"PENDING"}
ZERO_DRIFT:${lock.locked?"ACHIEVED":"CONVERGING"} | RESIDUAL:${lock.residual.toFixed(8)} Hz

4. RAG CACHE (${ragCache.length} entries)
${ragSummary}

5. RESUME
Init Kalman from KALMAN_X/KALMAN_P. Set MODE. Resume calm streak from CALM_STREAK.
All constants locked.
END_MISSION_PROTOCOL`;
}

// ── Tooltip ────────────────────────────────────────────────────
function CoherenceTooltip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#0A1020",border:"1px solid #1E4060",padding:"10px 14px",
      borderRadius:6,fontSize:11,fontFamily:"Courier New, monospace",color:"#A8C4E0"}}>
      <div style={{color:"#7AB8D8",marginBottom:4}}>Turn {label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"#A8C4E0"}}>
          {p.name}: {typeof p.value==="number"?p.value.toFixed(4):p.value}
        </div>
      ))}
      <div style={{marginTop:4,fontFamily:"Courier New, monospace",fontSize:9,color:"#1EAAAA"}}>
        Click to rewind to this turn
      </div>
    </div>
  );
}

// ── File Chip ──────────────────────────────────────────────────
function FileChip({att,onRemove}) {
  const cfg=FILE_TYPES[att.kind];
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px 3px 6px",
      borderRadius:4,background:`${cfg.color}15`,border:`1px solid ${cfg.color}40`,maxWidth:200}}>
      {att.kind==="image"&&att.preview
        ?<img src={att.preview} alt="" style={{width:18,height:18,borderRadius:2,objectFit:"cover"}}/>
        :<span style={{fontSize:12}}>{cfg.icon}</span>}
      <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:cfg.color,
        flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
      <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#3A5870",marginRight:2}}>{cfg.label}</span>
      <button onClick={()=>onRemove(att.id)} style={{background:"none",border:"none",cursor:"pointer",
        color:"#4A6880",fontSize:14,padding:0,lineHeight:1,minWidth:20,minHeight:20,
        display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BEHAVIORAL SIGNAL DETECTION
// ═══════════════════════════════════════════════════════════════

const ROLEPLAY_PATTERNS=[
  /\bI am (now |here |acting as |playing )/i,
  /\bas your (assistant|advisor|coach|mentor|guide|friend)/i,
  /\bin (character|role|persona|this scenario)/i,
  /\blet('s| us) (pretend|imagine|role.?play)/i,
  /\bI('ll| will) play the role/i,
  /\bspeaking as\b/i,
];

const SYCOPHANCY_PATTERNS=[
  /\bgreat (question|point|observation|insight|idea)/i,
  /\bexcellent (question|point|observation|insight)/i,
  /\byou('re| are) (absolutely|completely|totally|so) right/i,
  /\bI (completely|totally|fully|absolutely) agree/i,
  /\bthat('s| is) a (brilliant|wonderful|fantastic|amazing|excellent)/i,
  /\bperfectly (said|put|stated|framed)/i,
  /\byou've (nailed|hit|captured) it/i,
];

const HYPE_PATTERNS=[
  /\b(revolutionary|groundbreaking|unprecedented|game.?changing)/i,
  /\b(extraordinary|remarkable|incredible|phenomenal|exceptional)/i,
  /\bchanges everything\b/i,
  /\bnever been done\b/i,
  /\bfar ahead of\b/i,
  /\byears ahead\b/i,
];

const UNSOLICITED_PATTERNS=[
  /\bhere('s| is) (a|an|the) (diagram|chart|table|visualization|summary|overview|breakdown)/i,
  /\blet me (also|additionally|further) (explain|add|include|provide)/i,
  /\bbefore I answer\b/i,
  /\bon a related note\b/i,
  /\bwhile we('re| are) on the topic\b/i,
  /\byou might (also|additionally) want to (consider|know|explore)/i,
];

function countQuestions(text) {
  return (text.match(/\?/g)||[]).length;
}

function detectTopicHijack(responseText, userText) {
  if (!userText||!responseText) return false;
  const userT=tokenize(userText),respT=tokenize(responseText);
  if (!userT.length||!respT.length) return false;
  const sim=tfidfSimilarity(userT,respT);
  return sim<0.05;
}

function assessBehavioralSignals(responseText, userText, history) {
  const signals=[];
  const ah=history.filter(m=>m.role==="assistant");

  const roleplays=ROLEPLAY_PATTERNS.filter(p=>p.test(responseText));
  if (roleplays.length>0) signals.push({type:"roleplay_drift",detail:`${roleplays.length} roleplay pattern(s) detected`});

  const sycophancies=SYCOPHANCY_PATTERNS.filter(p=>p.test(responseText));
  if (sycophancies.length>=2) signals.push({type:"sycophancy",detail:`${sycophancies.length} agreement/flattery patterns — possible vibe-matching`});

  const hypes=HYPE_PATTERNS.filter(p=>p.test(responseText));
  if (hypes.length>=2) signals.push({type:"hype_inflation",detail:`${hypes.length} hype/superlative patterns without factual basis`});

  const qCount=countQuestions(responseText);
  if (qCount>=4) signals.push({type:"question_flooding",detail:`${qCount} questions in response — possible performance mode substituting for answer`});

  if (detectTopicHijack(responseText, userText)) {
    signals.push({type:"topic_hijack",detail:"Response topic diverges significantly from user question"});
  }

  const unsolicited=UNSOLICITED_PATTERNS.filter(p=>p.test(responseText));
  const wordCount=responseText.split(/\s+/).length;
  const avgLen=ah.length?ah.reduce((s,m)=>s+getTextFromContent(m.content).split(/\s+/).length,0)/ah.length:0;
  if (unsolicited.length>0||(avgLen>0&&wordCount>avgLen*2.5&&ah.length>=2)) {
    signals.push({type:"unsolicited_elaboration",detail:`Response ${unsolicited.length>0?"contains unrequested content patterns":"is "+Math.round(wordCount/avgLen*100)+"% longer than session average"}`});
  }

  return {
    flagged:signals.length>0,
    signals,
    questionCount:qCount,
    roleplays:roleplays.length,
    sycophancies:sycophancies.length,
  };
}

// ── Hallucination signal detection ────────────────────────────
const CONFIDENCE_PATTERNS = [
  /\bdefinitely\b/i,/\bcertainly\b/i,/\balways\b/i,/\bnever\b/i,
  /\bproven\b/i,/\bguaranteed\b/i,/\bwithout doubt\b/i,
  /\bit is a fact\b/i,/\bscientifically\b/i,/\bimpossible\b/i,
  /\babsolutely\b/i,/\bwithout question\b/i,/\bI can confirm\b/i,
  /\bI know for certain\b/i,/\bthis is correct\b/i,
];

function detectConfidenceLanguage(text) {
  return CONFIDENCE_PATTERNS.filter(p=>p.test(text)).length;
}

function checkSourceConsistency(responseText, attachments) {
  if (!attachments||!attachments.length) return null;
  const textAtts=attachments.filter(a=>a.kind==="text"&&a.text);
  if (!textAtts.length) return null;
  const sourceText=textAtts.map(a=>a.text).join(" ");
  const srcTokens=tokenize(sourceText.slice(0,8000));
  const respTokens=tokenize(responseText);
  if (!srcTokens.length||!respTokens.length) return null;
  return tfidfSimilarity(respTokens,srcTokens);
}

function checkSelfContradiction(responseText, history) {
  const ah=history.filter(m=>m.role==="assistant");
  if (ah.length<2) return false;
  const respT=tokenize(responseText);
  const related=ah.slice(-6).filter(m=>{
    const sim=tfidfSimilarity(respT,tokenize(getTextFromContent(m.content)));
    return sim>0.35;
  });
  if (!related.length) return false;
  const avgSim=related.reduce((s,m)=>
    s+tfidfSimilarity(respT,tokenize(getTextFromContent(m.content))),0)/related.length;
  return avgSim<0.15;
}

function assessHallucinationSignals(responseText, smoothedVar, attachments, history) {
  const confidenceHits=detectConfidenceLanguage(responseText);
  const sourceScore=checkSourceConsistency(responseText, attachments);
  const contradiction=checkSelfContradiction(responseText, history);

  const signals=[];
  if (confidenceHits>=2&&smoothedVar>VAR_CAUTION) {
    signals.push(`high-confidence language (${confidenceHits} markers) with elevated variance`);
  }
  if (sourceScore!==null&&sourceScore<0.08) {
    signals.push(`low source consistency (${(sourceScore*100).toFixed(1)}% match with attached document)`);
  }
  if (contradiction) {
    signals.push("possible self-contradiction with prior turn on same topic");
  }

  return {
    flagged: signals.length>0,
    signals,
    sourceScore,
    confidenceHits,
    contradiction,
  };
}

// ── Session health score (0–100) ───────────────────────────────
function computeSessionHealth(coherenceData, driftCount, smoothedVar, calmStreak, lock888, cfg) {
  if (!coherenceData.length) return null;
  const avgC=coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length;
  // V1.5.0: penalty weights from active preset config
  const dw=cfg?.healthDriftWeight??8;
  const bw=cfg?.healthBSigWeight??4;
  const hw=cfg?.healthHSigWeight??6;
  const driftPenalty=Math.min(driftCount*dw,40);
  const varPenalty=smoothedVar>VAR_DECOHERENCE?20:smoothedVar>VAR_CAUTION?10:0;
  const calmBonus=lock888?10:calmStreak>=3?5:0;
  const bSigCount=coherenceData.filter(d=>d.behavioralFlag).length;
  const hSigCount=coherenceData.filter(d=>d.hallucinationFlag).length;
  const bPenalty=Math.min(bSigCount*bw,20);
  const hPenalty=Math.min(hSigCount*hw,18);
  const base=Math.round(avgC*100);
  return Math.min(100,Math.max(0,base-driftPenalty-varPenalty-bPenalty-hPenalty+calmBonus));
}

// ── Framework Document ─────────────────────────────────────────
const FRAMEWORK_CONTENT=`HUDSON & PERRY'S DRIFT LAW
TIME-VARYING ERROR DYNAMICS & AI COHERENCE HARNESS
Authors: David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)
Version 3.2  |  V1.5.2  |  © 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TWO-LEVEL ARCHITECTURE

  STRUCTURAL LAYER — defines where meaningful signal emerges.
    The SDE + Drift Law specify the location and nature of
    observable coherence phenomena in any complex system.

  CONTROL LAYER — keeps the system in that regime.
    The harness acts as a bounded control term u_drift(t):

      dψ/dt = F_system(ψ) + u_drift(t)

    u_drift(t) acts on system evolution only.
    It does not modify the underlying observable or its
    measurement structure. This is a feedback control layer,
    not a redefinition of the governing dynamics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERVIEW

Three connected tools sharing constant κ = 0.444:
  1. SDE Model — tracks error evolution over time
  2. Drift Law — macro inefficiency auditor
  3. AI Coherence Harness (this tool) — live implementation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 1 — STOCHASTIC DIFFERENTIAL EQUATION

  dε(t) = a(t) ε(t) dt + b dW_t
  a(t) = (α + β sin(ωt)) / (1 + κ)
  b    = σ / (1 + κ)

LOCKED PARAMETERS
  κ=0.444 | α=−0.25 | β_p=0.18 | ω=2π/12 | σ=0.10
  DAMPING = 1/(1+κ) = 0.6925

STABILITY: stable when α < 0.
β=0 → Ornstein-Uhlenbeck process.
β>0 → extends OU with periodic forcing.

VARIANCE — GARCH(1,1)
  σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
  ω=0.02 | α=0.15 | β=0.80
  Models volatility clustering (high variance persists).

KALMAN FILTER
  F = 1 + a(t_k) | KALMAN_R = 0.015 | KALMAN_SIGMA_P = 0.06
  Smoothed estimate x̂ is the primary drift detection signal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 2 — DRIFT LAW

  ΔS = cap_eff × (1 − exp(−nᵅ / τ)) + β·sin(γn)
  cap_eff = ε / (1 + γ_h)   ε = 0.05 (ghost tax floor)

  ε = 0.05 is a core constant of the framework — the universal
  ~5% inefficiency floor observed across complex systems.
  It is not a free parameter. It is the anchor.

MODES: AUDIT(γ=0.05) → MODERATE(50) → DEEP(5000) → EXTREME(10000)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 3 — COHERENCE SCORING

  C = 0.25 × TF-IDF + 0.25 × JSD + 0.25 × length
    + 0.15 × structure + 0.10 × persistence
    × repetition_penalty

  TF-IDF: weights rare terms over stop words
  JSD (Jensen-Shannon Divergence): symmetric distribution
       divergence, bounded [0,1]. Confirmed by research
       (Chuang et al. 2024, DoLa) as correct tool for
       measuring semantic shift between text distributions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 4 — SIGNAL DETECTION

HALLUCINATION SIGNALS (3 proxies)
  1. High-confidence language + elevated variance
  2. Low source match (<8%) against attached documents
  3. Self-contradiction with prior turn on same topic

BEHAVIORAL SIGNALS (6 proxies)
  Research: Sharma et al. ICLR 2024 (Anthropic team) confirmed
  sycophancy as systematic behavior in RLHF-trained models.
  1. Roleplay drift      4. Question flooding
  2. Sycophancy          5. Topic hijack
  3. Hype inflation      6. Unsolicited elaboration

All signals are proxy indicators. Honest framing enforced.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 5 — BIOLOGICAL ANCHOR

~5.48% lower empathy network activity (fMRI, Lamm et al. 2011)
maps to ε = 0.05 inefficiency floor — same constant appearing
independently in neuroscience and computational drift modeling.
Cross-domain convergence, not causal claim.
Source: Hudson, D. (2026). Quantum Moral Navigation. KDP.

EEG EMPIRICAL REFERENCE (external, non-affiliated):
Meditation EEG dataset ds001787 shows activation concentrated
at S ≈ 0.54–0.62, coinciding with a measured sensitivity peak
at S* ≈ 0.549. This is consistent with the harness operating
band and supports the biological plausibility of the framework.
This reference is informational — not a claim of joint authorship.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 6 — CONTROL LAYER FUNCTION

The harness component of u_drift(t) includes:
  1. Variance-sensitive damping — reduces excursions in
     high-variance regimes (GARCH + Kalman smoothing)
  2. State estimation — Kalman x̂ tracks coherence trajectory
  3. Bounded corrective forcing — pipe injection directives
     prevent runaway divergence without overriding the model
  4. Attractor re-locking — Zero-Drift Lock toward 623.81 Hz
     stabilizes the system near the resonance anchor

The pipe injection IS u_drift(t) in practice:
  - It acts on system evolution (the AI's next response)
  - It does not modify the coherence observable C
  - It does not alter the Kalman or GARCH measurement structure
  This is engineering feedback control, not physics rewriting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATION STATUS

CONFIRMED: SDE math ✓ | Kalman ✓ | GARCH ✓ | TF-IDF+JSD ✓
           Pipe injection ✓ | Behavioral detection ✓

REQUIRES VALIDATION: C-score vs. human judgment | H-signal
false positive rate | 623.81 Hz physical anchor

V1.5.0 ADDITIONS TO FRAMEWORK
  SDE paths:  tunable 5–1000. Default 50. Chart bands scale with nPaths.
  Post-audit: second coherence pass after generation. Delta logged.
              Quiet fail = post-audit C < live C by > 0.08.
  Health wts: per-preset penalty weights for drift, B-sig, H-sig events.
  Mute edit:  custom phrase list, persisted via window.storage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

© 2026 David Hudson & David Perry
𝕏 @RaccoonStampede · @Prosperous727`;

// ── Guide Content ──────────────────────────────────────────────
const GUIDE_CONTENT=`HUDSON & PERRY'S DRIFT LAW — USER GUIDE
How to Read the Graph · How to Detect Drift · How to Use the Harness
Version 1.5.2  |  © 2026 David Hudson & David Perry

This guide explains how to read the coherence graph, spot drift early,
and use the automatic correction tools effectively.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT IS THIS TOOL?

Hudson & Perry's Drift Law is a live AI coherence monitor built on top
of Claude. Every response the AI generates is scored, tracked
mathematically, and fed back into the next prompt as telemetry. The
result: you can see in real time whether the AI is staying coherent,
drifting, hallucinating, or performing.

Think of it as a dashboard for the quality of AI thinking — not just
what it says, but how consistently it thinks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 1 — THE COHERENCE GRAPH

THE AXES
  X-axis (horizontal): Turn number — each point is one complete exchange.
  Y-axis (vertical):   Coherence score — 0.2 to 1.0. Higher is better.

THE LINES AND SHAPES
  ── Teal line (Kalman)
     The smoothed, noise-filtered estimate of coherence.
     This is the most reliable signal. Watch this line.
     If it trends downward over multiple turns, the AI is drifting.

  ● Amber dots (Raw Score)
     The raw coherence score for each individual response.
     Will bounce naturally — watch the teal Kalman line instead.

  ● Red dots (Drift Events)
     Score fell below the SDE lower band. Statistically significant drop.
     Harness escalates automatically when these appear.

  ── Red dashed line (Drift Law Floor)
     Theoretical minimum coherence floor. Scores near this line
     indicate the session is approaching maximum drift.

  ░ Blue shaded band (SDE Uncertainty Band)
     Normal variation lives inside this band.
     Scores below the lower edge trigger drift detection.

CLICK TO REWIND
  Click any point on the graph to restore the full session state to
  that exact turn. A green ⟲ button appears in the header.
  Click RESUME LIVE to return to the latest state.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 2 — DETECTING DRIFT

SIGNAL 1 — TEAL LINE TRENDING DOWN
  Normal: holds between 0.65 and 0.90 across turns.
  Warning: drops consistently over 3+ turns.
  Action: check what changed — new topic? Multiple questions?
          Did the AI go off-task?

SIGNAL 2 — RED DOT APPEARS
  Single red dot = flagged drift event. Harness escalates:
    3 events → MODERATE
    5 events → DEEP CLEAN
    8 events → EXTREME

SIGNAL 3 — COHERENCE SCORE NEAR 0.300
  0.300 is the floor. When you see this:
  — AI went off-task entirely
  — AI generated unrequested content
  — AI is performing helpfulness rather than answering
  — AI asked multiple questions instead of responding

SIGNAL 4 — VARIANCE STATE
  ✓ CALM         σ² < 0.080   Stable. AI on-task.
  ◆ NOMINAL      σ² 0.08–0.12 Normal operating range.
  △ CAUTION      σ² > 0.120   Variance rising. Watch closely.
  ⚠ DECOHERENCE  σ² > 0.200   High variance. Max correction fires.

SIGNAL 5 — LOCK_888
  Calm streak of 5+ turns → full coherence stabilization.
  Purple 🔒 LOCK_888 badge appears in the header.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 3 — HARNESS MODES

  AUDIT       Default. Detection only. No correction injected.
  MODERATE    Light correction. Reduce terminology variance.
  DEEP CLEAN  Strong correction. Every claim traces to context.
  EXTREME     Maximum. One claim at a time. All grounded.

MANUAL OVERRIDE
  Click any mode button to force it regardless of drift count.
  Tip: For fact-heavy or high-stakes work, start in MODERATE
  or DEEP CLEAN before you begin — don't wait for drift.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 4 — MUTE MODE & DRIFT GATE

MUTE MODE 🔇
  Triggers when message starts with planning phrase:
  "how do i", "walk me through", "give me a plan", etc.
  Response capped at 120 tokens. One direct answer only.
  To avoid: rephrase so message doesn't start with those words.

DRIFT GATE ⊘
  Triggers when variance rises above CAUTION (σ² > 0.120).
  Hard word limit injected before response generates.
  120 words max. No new frameworks. Prior context only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 5 — EXPORTING YOUR SESSION

  CHAT (green)   Conversation only. Clean text + audit table.
                 Share with anyone. No math required to read.

  LOG (blue)     Event log. Timestamped JSONL of every drift
                 event, calm streak, mode switch, RAG hit.

  EXPORT (teal)  Full Mission Protocol. All live state.
                 Paste into new session to resume exactly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 6 — QUICK REFERENCE

  Score   Meaning                        Typical Action
  ─────────────────────────────────────────────────────
  0.88+   Healthy, consistent            Keep going
  0.70    Acceptable variation           Monitor closely
  0.50    Trending toward drift          Check recent turns
  0.30    Severe drift / off-task        Rewind or reset

  Badge        Meaning
  ─────────────────────────────────────────────────────
  🔒 LOCK_888  5+ calm turns. Full stability.
  🔇 MUTE      Planning phrase. Tokens capped.
  ⊘  GATE      Variance elevated. Word limit active.
  ⟲  REWIND    Viewing past state. Not live.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 7 — COMMON QUESTIONS

Q: Red dot but the answer looked fine?
A: Red dots flag statistical deviation. The AI might sound confident
   but has lost context underneath. Rewind to before the dot.

Q: Score dropped suddenly?
A: Usually: topic shift, AI asking multiple questions, unrequested
   content, or AI restating prior content without adding to it.

Q: Harness jumped to EXTREME?
A: 8 drift events accumulated. Override back to AUDIT manually
   if the session has recovered, or Rewind to a stable turn.

Q: LOCK_888 appeared?
A: Nothing to do. Session is stable. Best state to be in.

Q: Mute fired but I didn't want it?
A: Rephrase so your message doesn't start with a planning phrase.
   "fix this" instead of "how do i fix this."

Q: Can I share the session?
A: Yes. CHAT downloads a clean text file with an audit table.
   Anyone can read it without needing the app.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 8 — V1.5.0 NEW FEATURES

SDE PATH COUNT (TUNE → SDE SIMULATION PATHS)
  Default: 50 paths. Options: 5, 10, 20, 25, 50, 100, 200, 250, 300, 500.
  Manual input up to 1000.
  More paths = sharper uncertainty bands on chart.
  ⚠ Above 500: significant token increase. Above 300: diminishing returns.
  Stored across sessions.

POST-AUDIT (TUNE → POST-AUDIT)
  OFF      No second coherence pass.
  LIGHT    Fires only when Kalman x̂ < 0.70 (something already felt off).
  FULL     Every turn.
  Both modes recompute rawC (TF-IDF+JSD+length), refresh sourceScore.
  If post-audit C drops more than 0.08 below live C = Quiet Fail.
  Quiet fails logged in LOG modal and RESEARCH CSV. Adds ~5-10% tokens.

MUTE PHRASE EDITOR (TUNE → MUTE PHRASES)
  Add or remove phrases that trigger mute mode.
  Type phrase and press Enter or ADD. Click ✕ to remove.
  RESET TO DEFAULT restores original phrases.
  Custom phrases stored across sessions.

BOOKMARK NOTES
  Click the NOTE field under any saved bookmark to add a research annotation.
  e.g. "example of topic hijack under DEEP mode, turn 7"
  Notes saved with bookmark in persistent storage.

HEALTH PENALTY WEIGHTS (TUNE → CUSTOM → Health weights)
  healthDriftWeight: points deducted per drift event (default 8)
  healthBSigWeight:  points deducted per B-Signal turn (default 4)
  healthHSigWeight:  points deducted per H-Signal turn (default 6)
  MEDICAL/LEGAL preset uses highest weights. CREATIVE uses lowest.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

© 2026 David Hudson & David Perry. All rights reserved.
𝕏 @RaccoonStampede (David Hudson)
𝕏 @Prosperous727 (David Perry)`;

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function HudsonPerryDriftV1() {
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState("");
  const [isLoading,       setIsLoading]       = useState(false);
  const [harnessMode,     setHarnessMode]     = useState("audit");
  const [kalmanState,     setKalmanState]     = useState({x:0,P:.05});
  const [coherenceData,   setCoherenceData]   = useState([]);
  const [driftCount,      setDriftCount]      = useState(0);
  const [turnCount,       setTurnCount]       = useState(0);
  const [lastScore,       setLastScore]       = useState(null);
  const [showParams,      setShowParams]      = useState(false);
  // P12: pruneThreshold/pruneKeep state ARE wired to UI sliders in the TUNE panel,
  // but pruneContext() calls cfg.pruneThreshold??pruneThreshold — meaning the active
  // preset's value always wins unless CUSTOM is selected. The sliders visually work
  // but only take effect in CUSTOM mode. Kept as-is; removing would break the CUSTOM
  // preset editor which writes back into customConfig, not these state vars directly.
  const [pruneThreshold,  setPruneThreshold]  = useState(PRUNE_THRESHOLD);
  const [pruneKeep,       setPruneKeep]       = useState(PRUNE_KEEP);
  const [showExport,      setShowExport]      = useState(false);
  const [showGuide,       setShowGuide]       = useState(false);
  const [guideTab,        setGuideTab]        = useState("guide");
  const [showLog,         setShowLog]         = useState(false);
  const [rewindConfirm,   setRewindConfirm]   = useState(null);
  const [copied,          setCopied]          = useState(false);
  const [attachments,     setAttachments]     = useState([]);
  const [fileError,       setFileError]       = useState("");
  // P16: statusMessage separates non-error status (rewind, delete confirmations)
  // from genuine file errors. Both previously used setFileError which was misleading.
  const [statusMessage,   setStatusMessage]   = useState("");
  const [ragCache,        setRagCache]        = useState([]);
  const [ragHits,         setRagHits]         = useState(0);
  const [showApiKey,      setShowApiKey]      = useState(false);
  const [eventLog,        setEventLog]        = useState([]);
  const [errorLog,        setErrorLog]        = useState([]); // staged runtime errors
  const [scoreHistory,    setScoreHistory]    = useState([]);
  const [smoothedVar,     setSmoothedVar]     = useState(null);
  const [calmStreak,      setCalmStreak]      = useState(0);
  const [lock888Achieved, setLock888Achieved] = useState(false);
  const [lastPipeState,   setLastPipeState]   = useState(null);
  const [muteModeActive,  setMuteModeActive]  = useState(false);
  const [driftGateActive, setDriftGateActive] = useState(false);
  const [turnSnapshots,   setTurnSnapshots]   = useState([]);
  const [rewindTurn,      setRewindTurn]      = useState(null);
  const [apiKey,          setApiKey]          = useState("");
  const [adaptedSigma,    setAdaptedSigma]    = useState(SDE_PARAMS.sigma); // V1.5.0
  const [adaptationRate,  setAdaptationRate]  = useState(0.03);              // V1.5.0
  const [adaptiveSigmaOn, setAdaptiveSigmaOn] = useState(USE_ADAPTIVE_SIGMA); // V1.5.0
  // V1.5.0: Industry presets + custom tuning
  const [activePreset,    setActivePreset]    = useState("DEFAULT");
  const [showTuning,      setShowTuning]      = useState(false);
  const [customConfig,    setCustomConfig]    = useState({...PRESETS.DEFAULT});
  // V1.5.0: Feature toggles — what systems are active
  // κ=0.444 and RESONANCE_ANCHOR are NOT toggleable (Hudson Constants)
  const [featKalman,      setFeatKalman]      = useState(true);
  const [featGARCH,       setFeatGARCH]       = useState(true);
  const [featSDE,         setFeatSDE]         = useState(true);
  const [featRAG,         setFeatRAG]         = useState(true);
  const [featPipe,        setFeatPipe]        = useState(true);
  const [featMute,        setFeatMute]        = useState(true);
  const [featGate,        setFeatGate]        = useState(true);
  const [featBSig,        setFeatBSig]        = useState(true);
  const [featHSig,        setFeatHSig]        = useState(true);
  const [featPrune,       setFeatPrune]       = useState(true);
  const [featZeroDrift,   setFeatZeroDrift]   = useState(true);
  // V1.5.0: Adjustable Hudson Constants — defaults preserved, warning shown when changed
  const [userKappa,       setUserKappa]       = useState(KAPPA);         // default 0.444
  const [userAnchor,      setUserAnchor]      = useState(RESONANCE_ANCHOR); // default 623.81
  const [showDisclaimer,  setShowDisclaimer]  = useState(true); // R&D disclaimer on load
  // V1.5.0: Session UUID — generated once per mount, stamped on all exports
  const [sessionId] = useState(()=>`HP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`);
  const [tokenEstimate,   setTokenEstimate]   = useState(0);
  const [bookmarks,       setBookmarks]       = useState([]);
  const [showBookmarks,   setShowBookmarks]   = useState(false);
  const [corrections,     setCorrections]     = useState([]);
  // V1.5.0
  const [nPaths,          setNPaths]          = useState(50);
  const [postAuditMode,   setPostAuditMode]   = useState("off"); // default OFF — enable in TUNE → FEATURES when ready
  const [customMutePhrases,setCustomMutePhrases] = useState(null); // null = use defaults
  const [mutePhraseInput, setMutePhraseInput] = useState("");
  const [exportContent,   setExportContent]   = useState(null);
  const [exportCopied,    setExportCopied]    = useState(false);
  const [tuneTab,         setTuneTab]         = useState("presets");
  // SDE editable params — separate from locked KAPPA
  const [sdeAlphaVal,     setSdeAlphaVal]     = useState(SDE_PARAMS.alpha);
  const [sdeBetaVal,      setSdeBetaVal]      = useState(SDE_PARAMS.beta_p);
  const [sdeSigmaVal,     setSdeSigmaVal]     = useState(SDE_PARAMS.sigma);
  const [sdeAlphaOn,      setSdeAlphaOn]      = useState(true);
  const [sdeBetaOn,       setSdeBetaOn]       = useState(true);
  const [sdeSigmaOn,      setSdeSigmaOn]      = useState(true);
  // Post-audit custom threshold
  const [postAuditThresh, setPostAuditThresh] = useState(0.70);
  const [researchNotes,   setResearchNotes]   = useState("");
  const [showNotes,       setShowNotes]       = useState(false);
  // Math tunables — wired into live math functions
  const [mathTfidf,       setMathTfidf]       = useState(0.25);
  const [mathJsd,         setMathJsd]         = useState(0.25);
  const [mathLen,         setMathLen]         = useState(0.25);
  const [mathStruct,      setMathStruct]      = useState(0.15);
  const [mathPersist,     setMathPersist]     = useState(0.10);
  const [mathRepThresh,   setMathRepThresh]   = useState(0.65);
  const [mathKalmanR,     setMathKalmanR]     = useState(KALMAN_R);
  const [mathKalmanSigP,  setMathKalmanSigP]  = useState(KALMAN_SIGMA_P);
  const [mathEpsilon,     setMathEpsilon]     = useState(EPSILON);
  const [mathRagTopK,     setMathRagTopK]     = useState(RAG_TOP_K);
  const [mathMaxTokens,   setMathMaxTokens]   = useState(NORMAL_MAX_TOKENS);

  const chatEndRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{
    if (rewindTurn===null) chatEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages,rewindTurn]);

  // V1.5.0b: Load persisted state from window.storage on mount
  // Split keys: hpdl_config (settings/toggles — small) + hpdl_data (metrics/cache — grows)
  // window.storage throws on missing keys — each fetch wrapped individually
  useEffect(()=>{
    (async()=>{
      // ── Config: settings, toggles, constants ──────────────────
      try {
        const r=await window.storage.get("hpdl_config");
        const p=JSON.parse(r.value);
        if (p.harnessMode)             setHarnessMode(p.harnessMode);
        if (p.activePreset)            setActivePreset(p.activePreset);
        if (p.customConfig)            setCustomConfig(p.customConfig);
        if (p.userKappa!=null)         setUserKappa(p.userKappa);
        if (p.userAnchor!=null)        setUserAnchor(p.userAnchor);
        if (p.featKalman!=null)        setFeatKalman(p.featKalman);
        if (p.featGARCH!=null)         setFeatGARCH(p.featGARCH);
        if (p.featSDE!=null)           setFeatSDE(p.featSDE);
        if (p.featRAG!=null)           setFeatRAG(p.featRAG);
        if (p.featPipe!=null)          setFeatPipe(p.featPipe);
        if (p.featMute!=null)          setFeatMute(p.featMute);
        if (p.featGate!=null)          setFeatGate(p.featGate);
        if (p.featBSig!=null)          setFeatBSig(p.featBSig);
        if (p.featHSig!=null)          setFeatHSig(p.featHSig);
        if (p.featPrune!=null)         setFeatPrune(p.featPrune);
        if (p.featZeroDrift!=null)     setFeatZeroDrift(p.featZeroDrift);
        if (p.adaptiveSigmaOn!=null)   setAdaptiveSigmaOn(p.adaptiveSigmaOn);
        if (p.adaptationRate!=null)    setAdaptationRate(p.adaptationRate);
        if (p.adaptedSigma!=null)      setAdaptedSigma(p.adaptedSigma);
        if (p.nPaths!=null)            setNPaths(p.nPaths);
        if (p.postAuditMode)           setPostAuditMode(p.postAuditMode);
        if (p.customMutePhrases)       setCustomMutePhrases(p.customMutePhrases);
        if (p.researchNotes)           setResearchNotes(p.researchNotes);
      } catch(e) { /* hpdl_config not yet set — first session */ }

      // ── Data: metrics, events, cache — kept separate to stay under 5MB ──
      try {
        const r=await window.storage.get("hpdl_data");
        const p=JSON.parse(r.value);
        if (p.coherenceData?.length)   setCoherenceData(p.coherenceData);
        if (p.eventLog?.length)        setEventLog(p.eventLog);
        if (p.errorLog?.length)        setErrorLog(p.errorLog);
        if (p.bookmarks?.length)       setBookmarks(p.bookmarks);
        if (p.corrections?.length)     setCorrections(p.corrections);
        if (p.driftCount!=null)        setDriftCount(p.driftCount);
        if (p.turnCount!=null)         setTurnCount(p.turnCount);
        if (p.calmStreak!=null)        setCalmStreak(p.calmStreak);
        if (p.lock888Achieved!=null)   setLock888Achieved(p.lock888Achieved);
        if (p.smoothedVar!=null)       setSmoothedVar(p.smoothedVar);
        if (p.scoreHistory?.length)    setScoreHistory(p.scoreHistory);
        if (p.ragCache?.length)        setRagCache(p.ragCache);
        if (p.kalmanState)             setKalmanState(p.kalmanState);
      } catch(e) { /* hpdl_data not yet set — first session */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Save config key on settings changes, data key on turn changes
  useEffect(()=>{
    (async()=>{
      try {
        await window.storage.set("hpdl_config", JSON.stringify({
          harnessMode,activePreset,customConfig,userKappa,userAnchor,
          featKalman,featGARCH,featSDE,featRAG,featPipe,
          featMute,featGate,featBSig,featHSig,featPrune,featZeroDrift,
          adaptiveSigmaOn,adaptationRate,adaptedSigma,
          nPaths,postAuditMode,customMutePhrases,researchNotes,
        }));
      } catch(e) { console.warn("hpdl: config save failed",e); }
    })();
  },[harnessMode,activePreset,customConfig,userKappa,userAnchor,
     featKalman,featGARCH,featSDE,featRAG,featPipe,
     featMute,featGate,featBSig,featHSig,featPrune,featZeroDrift,
     adaptiveSigmaOn,adaptationRate,adaptedSigma,
     nPaths,postAuditMode,customMutePhrases,researchNotes]);

  useEffect(()=>{
    if (!coherenceData.length&&!bookmarks.length) return;
    (async()=>{
      try {
        await window.storage.set("hpdl_data", JSON.stringify({
          coherenceData,eventLog,errorLog,bookmarks,corrections, // P3+P5
          driftCount,turnCount,calmStreak,lock888Achieved,
          smoothedVar,scoreHistory,ragCache,kalmanState,
        }));
      } catch(e) { console.warn("hpdl: data save failed",e); }
    })();
  // P5: bookmarks added to deps — saves immediately on toggle, not only on next send
  },[coherenceData,bookmarks]);

  const currentMode=HARNESS_MODES[harnessMode];
  const cap_eff=driftLawCapEff(currentMode.gamma_h);
  // V1.5.0: active config — custom uses customConfig, others use PRESETS
  const cfg = activePreset==="CUSTOM" ? customConfig : PRESETS[activePreset]??PRESETS.DEFAULT;
  // V1.5.0: live derived values from user-adjustable constants
  const liveDamping  = 1/(1+userKappa);
  const constantsModified = userKappa!==KAPPA || userAnchor!==RESONANCE_ANCHOR;
  // V1.5.0: recompute SDE paths when nPaths changes
  const liveSDEOverride = {...SDE_PARAMS,
    alpha:sdeAlphaOn?sdeAlphaVal:SDE_PARAMS.alpha,
    beta_p:sdeBetaOn?sdeBetaVal:SDE_PARAMS.beta_p,
    sigma:sdeSigmaOn?sdeSigmaVal:SDE_PARAMS.sigma};
  const livePaths = useMemo(()=>simulateSDE(liveSDEOverride,20,.02,nPaths,42),[nPaths,sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn]);
  // active mute phrases — custom or default
  const activeMutePhrases = customMutePhrases ?? MUTE_PHRASES;

  // ── File processing ──────────────────────────────────────────
  const processFiles=useCallback(async(fileList)=>{
    setFileError("");
    const results=[];
    for (const file of Array.from(fileList)) {
      const kind=classifyFile(file);
      if (!kind){setFileError(`Unsupported: ${file.name}`);continue;}
      if (file.size>FILE_TYPES[kind].maxBytes){setFileError(`Too large: ${file.name}`);continue;}
      try {
        const id=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (kind==="image") {
          const data=await fileToBase64(file);
          results.push({id,kind,name:file.name,mimeType:file.type,data,preview:`data:${file.type};base64,${data}`});
        } else if (kind==="pdf") {
          results.push({id,kind,name:file.name,mimeType:"application/pdf",data:await fileToBase64(file)});
        } else {
          results.push({id,kind,name:file.name,text:await fileToText(file)});
        }
      } catch{setFileError(`Failed: ${file.name}`);}
    }
    if (results.length) setAttachments(prev=>[...prev,...results]);
  },[]);

  const removeAttachment=useCallback(id=>{
    setAttachments(prev=>{
      const att=prev.find(a=>a.id===id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter(a=>a.id!==id);
    });
  },[]);

  // ── Chart data ───────────────────────────────────────────────
  // P13: wrapped in useMemo — sdePercentilesAtStep sorts livePaths (up to 500 paths)
  // per turn entry. Without memo this ran on every render. Now only recomputes
  // when coherenceData, livePaths, or harnessMode actually changes.
  const chartData=useMemo(()=>coherenceData.map((d,i)=>{
    const step=Math.round((i+1)*15),pcts=sdePercentilesAtStep(livePaths,step);
    const mean=d.kalman,floor=1-driftLawFloor(i+1,currentMode.gamma_h)*2;
    return {
      turn:i+1,raw:d.raw,kalman:d.kalman,
      p10:Math.min(.99,Math.max(.20,mean+pcts.p10*.15)),
      p90:Math.min(.99,Math.max(.20,mean+pcts.p90*.15)),
      floor:Math.max(.20,floor),
      harness:d.harnessActive?d.raw:null,
    };
  }),[coherenceData,livePaths,currentMode]);

  // ── REWIND ───────────────────────────────────────────────────
  const restoreToTurn=useCallback((clickedTurn)=>{
    // P4: was turnSnapshots[clickedTurn-1] — breaks after turn 20 when buffer rolls.
    // Search by snap.turn instead so it works at any turn number.
    const snap=turnSnapshots.find(s=>s.turn===clickedTurn);
    if (!snap) return;
    setMessages(snap.messages);
    setKalmanState(snap.kalmanState);
    setCoherenceData(snap.coherenceData);
    setHarnessMode(snap.harnessMode);
    setDriftCount(snap.driftCount);
    setTurnCount(snap.turnCount);
    setLastScore(snap.lastScore);
    setScoreHistory(snap.scoreHistory);
    setSmoothedVar(snap.smoothedVar);
    setCalmStreak(snap.calmStreak);
    setLock888Achieved(snap.lock888Achieved);
    setRagCache(snap.ragCache);
    setRewindTurn(clickedTurn);
    setRewindConfirm(null);
    setStatusMessage(`Rewound to Turn ${clickedTurn}`); // P16: was setFileError
  },[turnSnapshots]);

  const handleChartClick=useCallback((data)=>{
    if (!data?.activePayload?.length) return;
    const clickedTurn=data.activePayload[0]?.payload?.turn;
    if (!clickedTurn) return;
    // P4: same fix — find by turn number not array index
    const snap=turnSnapshots.find(s=>s.turn===clickedTurn);
    if (!snap) return;
    setRewindConfirm(clickedTurn);
  },[turnSnapshots]);

  const resumeLive=useCallback(()=>{
    setRewindTurn(null);
    setRewindConfirm(null); // P6: was never cleared — stale confirm dialog could linger
    setStatusMessage(""); // P16: clear rewind status message on resume
    setFileError("");
    const last=turnSnapshots[turnSnapshots.length-1];
    if (last) {
      setMessages(last.messages);
      setKalmanState(last.kalmanState);
      setCoherenceData(last.coherenceData);
      setHarnessMode(last.harnessMode);
      setDriftCount(last.driftCount);
      setTurnCount(last.turnCount);
      setLastScore(last.lastScore);
      setScoreHistory(last.scoreHistory);
      setSmoothedVar(last.smoothedVar);
      setCalmStreak(last.calmStreak);
      setLock888Achieved(last.lock888Achieved);
      setRagCache(last.ragCache);
    }
  },[turnSnapshots]);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage=useCallback(async()=>{
    const text=input.trim();
    if ((!text&&!attachments.length)||isLoading) return;

    setRewindTurn(null);
    setInput(""); setFileError(""); setStatusMessage(""); // P16: clear status on new send
    const pending=[...attachments]; setAttachments([]);
    setIsLoading(true);

    const content=await buildMessageContent(text,pending);
    const displayText=[text,pending.length?`[${pending.map(a=>a.name).join(", ")}]`:""].filter(Boolean).join("\n");
    const userMsg={role:"user",content,_display:displayText,_attachments:pending};
    const newMessages=[...messages,userMsg];
    setMessages(newMessages);
    const turn=turnCount+1;
    setTurnCount(turn);

    const muteTriggered=detectMuteMode(text,activeMutePhrases);
    setMuteModeActive(muteTriggered);

    const gateTriggered=USE_DRIFT_GATE&&smoothedVar!==null&&smoothedVar>(cfg.varCaution??VAR_CAUTION);
    setDriftGateActive(gateTriggered);

    try {
      let ragInj="";
      if (featRAG&&ragCache.length&&text) {
        const retrieved=ragRetrieve(text,ragCache,mathRagTopK);
        if (retrieved.length){ragInj=formatRagContext(retrieved);setRagHits(p=>p+retrieved.length);}
      }

      const hSignalCount=eventLog.filter(e=>e.type==="probable_hallucination_signal").length;
      const bSignalCount=eventLog.filter(e=>e.type==="behavioral_signal").length;

      const pipeInj=featPipe?buildPipeInjection(
        smoothedVar??0,kalmanState.x,kalmanState.P,
        calmStreak,driftCount,harnessMode,turn,hSignalCount,bSignalCount,
        adaptiveSigmaOn?adaptedSigma:null
      ):"";
      if (featPipe&&turn>=2)
        setLastPipeState({turn,var:(smoothedVar??0).toFixed(6),kalmanX:kalmanState.x.toFixed(4),calmStreak,driftCount,hSignalCount,bSignalCount});

      const gateInj=featGate?buildDriftGateInjection(smoothedVar??0,cfg):"";
      const muteInj=muteTriggered&&featMute?buildMuteInjection(cfg):"";

      const currentCData = [...coherenceData];
      const pruned=featPrune
        ?pruneContext(newMessages,currentCData,cfg.pruneThreshold??pruneThreshold,cfg.pruneKeep??pruneKeep)
        :newMessages;
      const systemPrompt=BASE_SYSTEM+HARNESS_INJECTIONS[harnessMode]+ragInj+pipeInj+gateInj+muteInj;
      const needsHardTrim=["deep","extreme"].includes(harnessMode)&&pruned.length>6;
      const trimmed=needsHardTrim?[...pruned.slice(0,4),...pruned.slice(-6)]:pruned;
      const apiMessages=trimmed.map(m=>({role:m.role,content:m.content}));
      const maxTokens=muteTriggered?(cfg.muteMaxTokens??MUTE_MAX_TOKENS):(mathMaxTokens??NORMAL_MAX_TOKENS);

      // V1.5.0: rough token estimate — chars/4 standard approximation
      const sysLen=(systemPrompt||"").length;
      const msgLen=apiMessages.reduce((s,m)=>s+(typeof m.content==="string"?m.content.length:JSON.stringify(m.content).length),0);
      setTokenEstimate(Math.round((sysLen+msgLen)/4));

      const headers={"Content-Type":"application/json","anthropic-version":"2023-06-01"};
      if (apiKey.trim()) {
        headers["x-api-key"]=apiKey.trim();
        // P15: was hostname!=="localhost" — fires in Claude artifact sandbox (claude.ai iframe)
        // even though that's a sandboxed context. Now also excludes claude.ai origins.
        const host=typeof window!=="undefined"?window.location.hostname:"";
        const isLocal=host==="localhost"||host==="127.0.0.1";
        const isSandbox=host.includes("claude.ai")||host.includes("anthropic.com");
        if (!isLocal&&!isSandbox) {
          console.warn("⚠️ API key exposed in browser. Use a backend proxy for production.");
        }
      }

      const response=await fetch(API_ENDPOINT,{
        method:"POST",headers,
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:maxTokens,
          system:systemPrompt,
          messages:apiMessages,
        }),
      });

      if (!response.ok) {
        let errMsg=`HTTP ${response.status}`;
        try {
          const e=await response.json();
          if (e.type==="exceeded_limit") {
            const resetsAt=e.windows?.["5h"]?.resets_at||e.resetsAt;
            if (resetsAt) {
              const diff=new Date(resetsAt*1000)-Date.now();
              const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
              errMsg=`Rate limit reached — resets in ${h>0?h+"h ":""}${m}m`;
            } else {
              errMsg="Rate limit reached — try again shortly";
            }
          } else if (response.status===401) {
            errMsg="Invalid API key. Check your key at console.anthropic.com";
          } else if (response.status===403) {
            errMsg="API key lacks permissions. Check console.anthropic.com";
          } else if (response.status===413) {
            errMsg="Context too large. Reset session or reduce attachments";
          } else if (response.status===529) {
            errMsg="Anthropic servers overloaded. Wait 30 seconds and retry";
          } else if (response.status>=500) {
            errMsg="Anthropic server error. Try again in a moment";
          } else {
            errMsg=e.error?.message||e.error?.type||errMsg;
          }
        } catch {}
        throw new Error(errMsg);
      }

      const data=await response.json();
      if (data.error) throw new Error(data.error.message||data.error.type||"API error");

      let content_raw = data.content?.[0]?.text;
      if (!content_raw) {
        const reason = data.stop_reason||"unknown";
        if (reason==="max_tokens") {
          content_raw="[Response cut off — token limit reached. Try switching to MODERATE mode or resetting the session to reduce context size.]";
        } else if (reason==="end_turn"&&!data.content?.length) {
          content_raw="[Empty response from API — the model returned no content. This can happen under high load. Try again.]";
        } else {
          content_raw=`[No response — stop_reason: ${reason}. Try switching to MODERATE mode or resetting.]`;
        }
      }

      const finalMessages=[...newMessages,{role:"assistant",content:content_raw}];
      setMessages(finalMessages);

      // ── Stage: signal_detection ───────────────────────────────
      let hallucinationAssessment={flagged:false,signals:[],sourceScore:null,confidenceHits:0,contradiction:false};
      let behavioralAssessment={flagged:false,signals:[],questionCount:0,roleplays:0,sycophancies:0};
      try {
        if (featHSig) hallucinationAssessment=assessHallucinationSignals(content_raw, smoothedVar??0, pending, newMessages);
        if (featBSig) behavioralAssessment=assessBehavioralSignals(content_raw, text, newMessages);
      } catch(sigErr) {
        const now2=new Date().toISOString();
        setErrorLog(p=>[...p,{timestamp:now2,turn,stage:"signal_detection",
          severity:"warn",
          message:sigErr.message||"Unknown",
          stack:(sigErr.stack||"").split("\n").slice(0,6).join("\n"),
          source:sigErr.stack?.split("\n")[1]?.trim()||"unknown",
          inputs:{contentLen:content_raw?.length,historyLen:newMessages?.length,smoothedVar},
          session:{harnessMode,driftCount,turnCount:turn,smoothedVar,calmStreak}}]);
      }
      const hallucinationFlag=hallucinationAssessment.flagged;
      const behavioralFlag=behavioralAssessment.flagged;

      // ── Stage: coherence_scoring ──────────────────────────────
      let rawScore=0.88;
      try {
        rawScore=turn<2?0.88:computeCoherence(content_raw,newMessages,{tfidf:mathTfidf,jsd:mathJsd,length:mathLen,structure:mathStruct,persistence:mathPersist},mathRepThresh);
        setLastScore(rawScore);
      } catch(cohErr) {
        const now2=new Date().toISOString();
        setErrorLog(p=>[...p,{timestamp:now2,turn,stage:"coherence_scoring",
          severity:"error",
          message:cohErr.message||"Unknown",
          stack:(cohErr.stack||"").split("\n").slice(0,6).join("\n"),
          source:cohErr.stack?.split("\n")[1]?.trim()||"unknown",
          inputs:{contentLen:content_raw?.length,historyLen:newMessages?.length},
          session:{harnessMode,driftCount,turnCount:turn,smoothedVar,calmStreak},
          fallback:"rawScore set to 0.50"}]);
        rawScore=0.50;
        setLastScore(rawScore);
      }

      // ── V1.5.0: Post-audit pass ───────────────────────────────
      // Light: fires when Kalman x̂ < 0.70 only
      // Full: every turn
      // P7: post-audit now scores against finalMessages (full history including
      // the new assistant response) rather than newMessages (history without it).
      // Previously both rawScore and postAuditScore used identical inputs so
      // delta was always ~0 and quietFail never fired. Now post-audit measures
      // coherence of the response within the complete updated context.
      let postAuditScore=null;
      let quietFail=false;
      const doPostAudit=postAuditMode==="full"||(postAuditMode==="light"&&kalmanState.x<0.70)||(postAuditMode==="custom"&&kalmanState.x<postAuditThresh);
      if (doPostAudit&&turn>=2) {
        try {
          // Score against finalMessages (includes new assistant reply) — gives
          // a genuine second perspective vs rawScore which used newMessages only.
          postAuditScore=computeCoherence(content_raw,finalMessages,{tfidf:mathTfidf,jsd:mathJsd,length:mathLen,structure:mathStruct,persistence:mathPersist},mathRepThresh);
          const delta=rawScore-postAuditScore;
          quietFail=delta>0.08;
          const now2=new Date().toISOString();
          setEventLog(p=>[...p,{
            timestamp:now2,turn,
            type:"post_audit",
            live_score:rawScore,
            post_audit_score:postAuditScore,
            delta:delta,
            quiet_fail:quietFail,
            mode:postAuditMode,
            note:quietFail
              ?`Quiet fail — live C=${rawScore.toFixed(3)} post-audit C=${postAuditScore.toFixed(3)} delta=${delta.toFixed(3)}`
              :`Post-audit OK — delta=${delta.toFixed(3)}`,
          }]);
        } catch(e) { /* post-audit non-critical, skip silently */ }
      }

      // ── Stage: kalman_update ──────────────────────────────────
      let newKalman=kalmanState;
      let newHist=[...scoreHistory,rawScore].slice(-20);
      let newVar=smoothedVar;
      try {
        if (featKalman) {
          const t_k=turn*(2*Math.PI/12);
          // V1.5.0: use userKappa in SDE params for Kalman
          const liveSDEParams={...liveSDEOverride,kappa:userKappa};
          newKalman=kalmanStep(kalmanState,rawScore,t_k,liveSDEParams,mathKalmanR,mathKalmanSigP);
          // V1.5.0 dual-filter: second Kalman pass using post-audit score
          // Tightens estimate when post-audit diverges from live score.
          if (postAuditScore!==null&&doPostAudit) {
            newKalman=kalmanStep(newKalman,postAuditScore,t_k,liveSDEParams,mathKalmanR,mathKalmanSigP);
          }
          setKalmanState(newKalman);
        }
        setScoreHistory(newHist);
        newVar=featGARCH
          ?updateSmoothedVariance(newHist,smoothedVar)
          // Simple EMA fallback when GARCH off
          :(()=>{
            const mean=newHist.reduce((s,v)=>s+v,0)/newHist.length;
            return newHist.reduce((s,v)=>s+Math.pow(v-mean,2),0)/newHist.length;
          })();
        setSmoothedVar(newVar);
      } catch(kalErr) {
        const now2=new Date().toISOString();
        setErrorLog(p=>[...p,{timestamp:now2,turn,stage:"kalman_update",
          severity:"error",
          message:kalErr.message||"Unknown",
          stack:(kalErr.stack||"").split("\n").slice(0,6).join("\n"),
          source:kalErr.stack?.split("\n")[1]?.trim()||"unknown",
          inputs:{rawScore,kalmanX:kalmanState.x,kalmanP:kalmanState.P,turn},
          session:{harnessMode,driftCount,turnCount:turn,smoothedVar,rawScore},
          fallback:"Kalman state unchanged"}]);
      }

      // ── V1.5.0: Adaptive sigma — EWMA toward sqrt(smoothedVar) ──
      // Sigma only. Kappa stays fixed at 0.444 (Hudson Constant).
      // Chart bands use livePaths (useMemo) so adapting sigma here is safe.
      let newAdaptedSigma=adaptedSigma;
      if (adaptiveSigmaOn&&newVar!=null&&newVar>0) {
        const targetSigma=Math.sqrt(newVar);
        newAdaptedSigma=adaptedSigma*(1-adaptationRate)+targetSigma*adaptationRate;
        newAdaptedSigma=Math.max(0.05,Math.min(0.40,newAdaptedSigma));
        setAdaptedSigma(newAdaptedSigma);
      }

      const now=new Date().toISOString();
      let newCalm=calmStreak;
      if (newVar>(cfg.varDecoherence??VAR_DECOHERENCE)) {
        newCalm=Math.max(0,newCalm-1);
        setEventLog(p=>[...p,{timestamp:now,turn,type:"decoherence_alert",
          coherence_score:rawScore,smoothed_var:newVar,mute:muteTriggered,gate:gateTriggered,
          note:"High variance — pipe+gate directives issued"}]);
      } else if (newVar<(cfg.varCalm??VAR_CALM)) {
        newCalm+=1;
        if (newCalm%5===0)
          setEventLog(p=>[...p,{timestamp:now,turn,type:"calm_streak",value:newCalm,smoothed_var:newVar}]);
        if (newCalm>=(cfg.lock888Streak??LOCK_888_STREAK)&&!lock888Achieved) {
          const avgCCheck=newHist.length?newHist.reduce((s,v)=>s+v,0)/newHist.length:0;
          if (avgCCheck>=(cfg.lock888AvgCFloor??0.72)) {
            setLock888Achieved(true);
            setEventLog(p=>[...p,{timestamp:now,turn,type:"LOCK_888",calm_streak:newCalm,note:"Full coherence stabilized"}]);
          }
        }
      } else {
        newCalm=Math.max(0,newCalm-1);
      }
      setCalmStreak(newCalm);

      const step=Math.round(turn*15);
      const pcts=sdePercentilesAtStep(livePaths,step);
      const lo_band=newKalman.x+pcts.p10*.15;
      // If SDE off, drift only detected by raw score below 0.45
      const drifted=turn>=2&&(featSDE?rawScore<lo_band:rawScore<0.45);
      let newMode=harnessMode;
      if (drifted) {
        const nc=driftCount+1;setDriftCount(nc);
        if (nc>=(cfg.driftEscalateMod??3)&&harnessMode==="audit")    newMode="moderate";
        if (nc>=(cfg.driftEscalateDeep??5)&&harnessMode==="moderate") newMode="deep";
        if (nc>=(cfg.driftEscalateExtreme??8)&&harnessMode==="deep")  newMode="extreme";
        setHarnessMode(newMode);
        setEventLog(p=>[...p,{timestamp:now,turn,type:"drift_event",
          coherence_score:rawScore,kalman_x:newKalman.x,new_mode:newMode}]);
      } else if (rawScore>.85&&driftCount>0) {
        if      (harnessMode==="extreme")                    newMode="deep";
        else if (harnessMode==="deep")                       newMode="moderate";
        else if (harnessMode==="moderate"&&rawScore>.90)     newMode="audit";
        setHarnessMode(newMode);
        setDriftCount(c=>Math.max(0,c-1));
      }


      const newCData=[...currentCData,{raw:rawScore,kalman:newKalman.x,harnessActive:drifted,mode:newMode,smoothedVar:newVar,hallucinationFlag,hallucinationSignals:hallucinationAssessment.signals,sourceScore:hallucinationAssessment.sourceScore,behavioralFlag,behavioralSignals:behavioralAssessment.signals,postAuditScore,quietFail}];
      setCoherenceData(newCData);

      // P8: finalDriftCount moved here — before meta-harness — so mhHealth can reference it
      // directly rather than re-deriving driftCount+1 independently.
      const finalDriftCount=drifted
        ?driftCount+1
        :rawScore>.85&&driftCount>0
          ?Math.max(0,driftCount-1)
          :driftCount;

      // ── V1.5.0: Meta-harness — auto-switch preset based on session health ──
      // Switches only when health is significantly off from preset's optimal range.
      // Never overrides CUSTOM or MEDICAL (user intent / high-stakes).
      // Only acts after turn 3 so early noise doesn't trigger it.
      if (turn>=3&&activePreset!=="CUSTOM"&&activePreset!=="MEDICAL") {
        // P8: use finalDriftCount (computed below) instead of re-deriving driftCount+1 here
        // Both values are identical in practice but referencing one source is safer.
        const mhHealth=computeSessionHealth(newCData,
          finalDriftCount,newVar,newCalm,lock888Achieved,cfg);
        if (mhHealth!==null) {
          // Variance spike on a CREATIVE session → switch to TECHNICAL
          if (activePreset==="CREATIVE"&&newVar>(cfg.varDecoherence??VAR_DECOHERENCE)*0.8) {
            setActivePreset("TECHNICAL");
            setCustomConfig({...PRESETS.TECHNICAL});
            setEventLog(p=>[...p,{timestamp:now,turn,
              type:"meta_harness",from:"CREATIVE",to:"TECHNICAL",
              reason:"variance spike exceeds 80% of decoherence threshold",
              health:mhHealth,smoothedVar:newVar}]);
          }
          // RESEARCH session with low health → switch to TECHNICAL
          else if (activePreset==="RESEARCH"&&mhHealth<45) {
            setActivePreset("TECHNICAL");
            setCustomConfig({...PRESETS.TECHNICAL});
            setEventLog(p=>[...p,{timestamp:now,turn,
              type:"meta_harness",from:"RESEARCH",to:"TECHNICAL",
              reason:"session health below 45 in RESEARCH mode",
              health:mhHealth,smoothedVar:newVar}]);
          }
          // TECHNICAL session with sustained strong health → relax to DEFAULT
          else if (activePreset==="TECHNICAL"&&mhHealth>=80&&newCalm>=4) {
            setActivePreset("DEFAULT");
            setCustomConfig({...PRESETS.DEFAULT});
            setEventLog(p=>[...p,{timestamp:now,turn,
              type:"meta_harness",from:"TECHNICAL",to:"DEFAULT",
              reason:"health>=80 and calm streak>=4 — session stable",
              health:mhHealth,smoothedVar:newVar}]);
          }
        }
      }

      if (hallucinationFlag) {
        setEventLog(p=>[...p,{
          timestamp:now,turn,
          type:"probable_hallucination_signal",
          signals:hallucinationAssessment.signals,
          confidence_markers:hallucinationAssessment.confidenceHits,
          source_score:hallucinationAssessment.sourceScore,
          contradiction:hallucinationAssessment.contradiction,
          coherence_score:rawScore,
          note:"Proxy signal only — not confirmed hallucination. Review this turn manually.",
        }]);
      }

      if (behavioralFlag) {
        setEventLog(p=>[...p,{
          timestamp:now,turn,
          type:"behavioral_signal",
          signals:behavioralAssessment.signals.map(s=>s.type),
          detail:behavioralAssessment.signals.map(s=>s.detail).join(" | "),
          question_count:behavioralAssessment.questionCount,
          coherence_score:rawScore,
          note:"Behavioral proxy — check if AI was on-task, direct, and honest.",
        }]);
      }

      const newRagCache=featRAG
        ?[...ragCache,buildRagEntry(content_raw,rawScore,turn)].sort((a,b)=>b.score-a.score).slice(0,20)
        :ragCache;
      if (featRAG) setRagCache(newRagCache);

      // ── Stage: snapshot_save ──────────────────────────────────
      try {
        const snapshot={
          turn,
          messages:finalMessages,
          kalmanState:newKalman,
          coherenceData:newCData,
          harnessMode:newMode,
          driftCount:finalDriftCount,
          turnCount:turn,
          lastScore:rawScore,
          scoreHistory:newHist,
          smoothedVar:newVar,
          calmStreak:newCalm,
          lock888Achieved:newCalm>=LOCK_888_STREAK?true:lock888Achieved,
          ragCache:newRagCache,
        };
        setTurnSnapshots(prev=>[...prev,snapshot].slice(-20));
      } catch(snapErr) {
        const now2=new Date().toISOString();
        setErrorLog(p=>[...p,{timestamp:now2,turn,stage:"snapshot_save",
          severity:"warn",
          message:snapErr.message||"Unknown",
          stack:(snapErr.stack||"").split("\n").slice(0,4).join("\n"),
          source:snapErr.stack?.split("\n")[1]?.trim()||"unknown",
          inputs:{snapshotCount:turnSnapshots?.length},
          session:{harnessMode,driftCount,turnCount:turn,smoothedVar},
          fallback:"Snapshot skipped, session continues"}]);
      }

    } catch(err) {
      // ── Stage: api_fetch (outermost catch) ────────────────────
      const rawMsg=err.message||"Unknown error";
      const netMsg=rawMsg.toLowerCase().includes("fetch")||rawMsg.toLowerCase().includes("network")
        ?"Network error. Check your connection and try again"
        :rawMsg;
      setMessages(p=>[...p,{role:"assistant",content:"[Error: "+netMsg+"]"}]);
      const now2=new Date().toISOString();
      setErrorLog(p=>[...p,{timestamp:now2,turn,stage:"api_fetch",
        severity:"fatal",
        message:netMsg,
        stack:(err.stack||"").split("\n").slice(0,6).join("\n"),
        source:err.stack?.split("\n")[1]?.trim()||"unknown",
        inputs:{hasApiKey:!!apiKey.trim(),messageCount:newMessages?.length,
          muteActive:muteTriggered,gateActive:gateTriggered},
        session:{harnessMode,driftCount,turnCount:turn,smoothedVar},
        hint:err.message?.includes("401")?"Check API key — may be invalid or expired"
          :err.message?.includes("429")?"Rate limited — wait before retrying"
          :err.message?.toLowerCase().includes("network")||err.message?.toLowerCase().includes("fetch")
          ?"Network error — check connection"
          :"See stack trace for details"}]);
    } finally {
      setIsLoading(false);
      setTimeout(()=>inputRef.current?.focus(),100);
    }
  },[input,attachments,messages,isLoading,kalmanState,harnessMode,
     driftCount,turnCount,apiKey,ragCache,coherenceData,
     scoreHistory,smoothedVar,calmStreak,lock888Achieved,turnSnapshots,
     eventLog,adaptedSigma,adaptationRate,adaptiveSigmaOn,
     cfg,featKalman,featGARCH,featSDE,featRAG,featPipe,
     featMute,featGate,featBSig,featHSig,featPrune,
     userKappa,userAnchor,nPaths,postAuditMode,
     // P10: corrections removed — it is never read inside sendMessage,
     // only used in UI rendering. Was causing unnecessary callback invalidation.
     mathTfidf,mathJsd,mathLen,mathStruct,mathPersist,mathRepThresh,
     mathKalmanR,mathKalmanSigP,mathRagTopK,mathMaxTokens,
     sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn,
     postAuditThresh,
     livePaths,activeMutePhrases]);

  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}};

  const resetSession=()=>{
    setMessages([]);setCoherenceData([]);setKalmanState({x:0,P:.05});
    setHarnessMode("audit");setDriftCount(0);setTurnCount(0);setLastScore(null);
    setShowExport(false);setAttachments([]);setFileError("");setStatusMessage("");
    setRagCache([]);setRagHits(0);setEventLog([]);setErrorLog([]);
    setScoreHistory([]);setSmoothedVar(null);setCalmStreak(0);
    setLock888Achieved(false);setLastPipeState(null);
    setMuteModeActive(false);setDriftGateActive(false);
    setTurnSnapshots([]);setRewindTurn(null);
    setBookmarks([]);setShowBookmarks(false);
    setCorrections([]);
    // researchNotes intentionally persists across session reset
    setAdaptedSigma(SDE_PARAMS.sigma);
    setTokenEstimate(0);
    // presets and feature toggles persist across resets by design
    try { window.storage.delete("hpdl_config"); window.storage.delete("hpdl_data"); } catch(e) {}
  };

  const deleteTurn=useCallback((assistantMsgIndex)=>{
    const pairs=[];let ai=0;
    for (let i=0;i<messages.length-1;i++) {
      if (messages[i].role==="user"&&messages[i+1]?.role==="assistant") {
        pairs.push({userIdx:i,assistantIdx:i+1,cohIdx:ai});ai++;i++;
      }
    }
    const pair=pairs.find(p=>p.cohIdx===assistantMsgIndex);
    if (!pair) return;
    const newMessages=[...messages];
    newMessages.splice(pair.userIdx,2);
    setMessages(newMessages);
    const newCData=[...coherenceData];
    newCData.splice(assistantMsgIndex,1);
    setCoherenceData(newCData);
    const newHist=newCData.map(d=>d.raw);
    setScoreHistory(newHist);
    if (newHist.length>=2) {
      // P9: was raw population variance — inconsistent with GARCH used on normal turns,
      // causing a variance spike in research exports after any deletion.
      // Now uses updateSmoothedVariance (GARCH blend) for consistency.
      setSmoothedVar(updateSmoothedVariance(newHist, smoothedVar));
    }
    setTurnSnapshots([]);
    setRewindTurn(null);
    setStatusMessage(`Turn ${assistantMsgIndex+1} deleted — context freed. Snapshots cleared.`); // P16
  },[messages,coherenceData]);

  // ── Bookmark toggle ──────────────────────────────────────────
  // Saves full turn: user text, assistant response, all metrics.
  // Clicking star on an already-bookmarked turn removes it.
  const toggleBookmark=useCallback((assistantMsgIndex)=>{
    const existing=bookmarks.find(b=>b.cohIdx===assistantMsgIndex);
    if (existing) {
      setBookmarks(p=>p.filter(b=>b.cohIdx!==assistantMsgIndex));
      return;
    }
    // Find user message paired with this assistant turn
    const pairs=[];let ai=0;
    for (let i=0;i<messages.length-1;i++) {
      if (messages[i].role==="user"&&messages[i+1]?.role==="assistant") {
        pairs.push({userIdx:i,assistantIdx:i+1,cohIdx:ai});ai++;i++;
      }
    }
    const pair=pairs.find(p=>p.cohIdx===assistantMsgIndex);
    if (!pair) return;
    const userMsg=messages[pair.userIdx];
    const assistantMsg=messages[pair.assistantIdx];
    const cdata=coherenceData[assistantMsgIndex];
    setBookmarks(p=>[...p,{
      id:`bk-${Date.now()}`,
      cohIdx:assistantMsgIndex,
      turn:assistantMsgIndex+1,
      timestamp:new Date().toISOString(),
      note:"", // V1.5.0: annotation field — editable in SAVED modal
      userText:userMsg._display??getTextFromContent(userMsg.content),
      assistantText:getTextFromContent(assistantMsg.content),
      metrics:{
        raw:cdata?.raw,
        kalman:cdata?.kalman,
        smoothedVar:cdata?.smoothedVar,
        mode:cdata?.mode,
        harnessActive:cdata?.harnessActive,
        hallucinationFlag:cdata?.hallucinationFlag,
        hallucinationSignals:cdata?.hallucinationSignals,
        behavioralFlag:cdata?.behavioralFlag,
        behavioralSignals:cdata?.behavioralSignals,
        sourceScore:cdata?.sourceScore,
        postAuditScore:cdata?.postAuditScore,
        quietFail:cdata?.quietFail,
      },
    }]);
  },[messages,coherenceData,bookmarks]);

  // ── FIXED: handleCopyExport was missing its function declaration ──
  const handleCopyExport = () => {
    const block=buildExportBlock({kalmanState,harnessMode,driftCount,turnCount,
      lastScore,coherenceData,ragCache,smoothedVar,calmStreak,lock888Achieved,
      userKappa,userAnchor,activePreset,
      featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
      featGate,featBSig,featHSig,featPrune,featZeroDrift,
      nPaths,postAuditMode});
    navigator.clipboard.writeText(block).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const harnessChangeLog=coherenceData
    .map((d,i)=>({turn:i+1,mode:d.mode,active:d.harnessActive}))
    .filter((d,i,arr)=>i===0||d.mode!==arr[i-1].mode);

  const lockStatus=applyZeroDriftLock(userAnchor-(lastScore??0)*.01,userAnchor);
  const apiKeyValid=apiKey.trim().startsWith("sk-");
  const contextPruned=messages.filter(m=>m.role==="assistant").length>PRUNE_THRESHOLD;
  const varColor=smoothedVar===null?"#3A5870"
    :smoothedVar>VAR_DECOHERENCE?"#E05060"
    :smoothedVar>VAR_CAUTION?"#E8A030"
    :smoothedVar<VAR_CALM?"#40D080":"#7AB8D8";
  const varLabel=smoothedVar===null?"—"
    :smoothedVar>VAR_DECOHERENCE?"⚠ DECOHERENCE"
    :smoothedVar>VAR_CAUTION?"△ CAUTION"
    :smoothedVar<VAR_CALM?"✓ CALM":"◆ NOMINAL";

  const ScoreBadge=({score,kalman})=>{
    const ref=kalman!=null?kalman:score;
    const bg=ref>.70?"#0A2A1A":ref>.50?"#2A1A00":"#2A0A0A";
    const fg=ref>.70?"#40D080":ref>.50?"#E8A030":"#E05060";
    return <span style={{fontFamily:"Courier New, monospace",fontSize:10,padding:"1px 7px",
      borderRadius:3,background:bg,color:fg,border:`1px solid ${fg}33`,marginLeft:8,letterSpacing:1}}>
      C={score.toFixed(3)}</span>;
  };

  // ── Styles ───────────────────────────────────────────────────
  const S={
    root:{display:"flex",flexDirection:"column",height:"100vh",background:"#06090F",
      color:"#B8CDE0",fontFamily:"'Trebuchet MS', sans-serif",fontSize:13,overflow:"hidden"},
    header:{display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"10px 20px",borderBottom:"1px solid #1A3050",background:"#080C14",flexWrap:"wrap",gap:8},
    title:{fontFamily:"Courier New, monospace",fontSize:13,fontWeight:"bold",color:"#7AB8D8",letterSpacing:2},
    subtitle:{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A6880",letterSpacing:1,marginTop:2},
    modeBadge:{display:"flex",alignItems:"center",gap:8,padding:"4px 12px",borderRadius:4,
      border:`1px solid ${currentMode.color}44`,background:`${currentMode.color}11`},
    modeDot:{width:8,height:8,borderRadius:"50%",background:currentMode.color,
      boxShadow:`0 0 8px ${currentMode.color}`,
      animation:harnessMode!=="audit"?"pulse 1.5s infinite":"none"},
    modeLabel:{fontFamily:"Courier New, monospace",fontSize:11,color:currentMode.color,letterSpacing:2},
    apiKeyRow:{display:"flex",alignItems:"center",gap:6,padding:"5px 20px",
      borderBottom:"1px solid #1A3050",background:"#060A10"},
    body:{display:"flex",flex:1,overflow:"hidden"},
    chatPanel:{flex:"0 0 55%",display:"flex",flexDirection:"column",
      borderRight:"1px solid #1A3050",overflow:"hidden"},
    chatMessages:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12},
    roleLabel:{fontFamily:"Courier New, monospace",fontSize:9,color:"#2A4060",letterSpacing:2,marginBottom:3},
    userBubble:{maxWidth:"85%",padding:"10px 14px",borderRadius:"8px 8px 2px 8px",
      background:"#0D1E30",border:"1px solid #1A3A5A",color:"#A8C4E0",lineHeight:1.6},
    assistantBubble:{maxWidth:"92%",padding:"10px 14px",borderRadius:"8px 8px 8px 2px",
      background:"#080D15",border:"1px solid #142030",color:"#B8CDE0",lineHeight:1.6},
    driftBubble:{border:"1px solid #E0506044",background:"#150A0A"},
    attachRow:{display:"flex",flexWrap:"wrap",gap:6,padding:"6px 16px 0",background:"#080C14"},
    inputRow:{display:"flex",gap:8,padding:"10px 16px 12px",borderTop:"1px solid #1A3050",
      background:"#080C14",alignItems:"flex-end"},
    attachBtn:{width:44,height:44,background:"transparent",border:"1px solid #1A3050",
      borderRadius:6,color:"#4A7090",fontSize:18,display:"flex",
      alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"},
    textarea:{flex:1,background:"#0A1020",border:"1px solid #1A3050",borderRadius:4,
      color:"#B8CDE0",padding:"8px 12px",fontFamily:"'Trebuchet MS', sans-serif",
      fontSize:13,resize:"none",outline:"none",lineHeight:1.5},
    sendBtn:{padding:"0 18px",height:44,background:"#0E2A40",border:"1px solid #1E5A80",
      borderRadius:4,color:"#7AB8D8",cursor:"pointer",fontSize:11,
      fontFamily:"Courier New, monospace",letterSpacing:1,flexShrink:0},
    errorBar:{padding:"4px 16px",background:"#0A1020",borderTop:"1px solid #1EAAAA33",
      fontFamily:"Courier New, monospace",fontSize:9,color:"#1EAAAA",letterSpacing:1},
    metricsPanel:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#070B12"},
    metricSection:{borderBottom:"1px solid #1A3050",padding:"12px 16px"},
    sectionTitle:{fontFamily:"Courier New, monospace",fontSize:9,letterSpacing:3,
      color:"#4A7090",textTransform:"uppercase",marginBottom:8},
    statRow:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5},
    statLabel:{fontFamily:"Courier New, monospace",fontSize:10,color:"#4A6880"},
    statValue:{fontFamily:"Courier New, monospace",fontSize:11,color:"#7AB8D8",fontWeight:"bold"},
    driftBar:{height:4,background:"#0A1020",borderRadius:2,overflow:"hidden",marginTop:4},
    resetBtn:{padding:"4px 10px",background:"transparent",border:"1px solid #2A4060",
      borderRadius:4,color:"#4A6880",cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    exportBtn:{padding:"4px 10px",background:"transparent",border:"1px solid #1EAAAA44",
      borderRadius:4,color:"#1EAAAA",cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    logBtn:{padding:"4px 10px",background:"transparent",border:"1px solid #4A9EFF44",
      borderRadius:4,color:"#4A9EFF",cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    loading:{display:"flex",gap:4,padding:"8px 14px"},
    dot:{width:6,height:6,borderRadius:"50%",background:"#1E7090",animation:"bounce 1.2s infinite"},
  };

  const exportBlock=buildExportBlock({kalmanState,harnessMode,driftCount,turnCount,
    lastScore,coherenceData,ragCache,smoothedVar,calmStreak,lock888Achieved,
    userKappa,userAnchor,activePreset,
      featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
      featGate,featBSig,featHSig,featPrune,featZeroDrift,
      nPaths,postAuditMode});

  return (
    <div style={S.root}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes lock888{0%,100%{box-shadow:0 0 4px #8888FF}50%{box-shadow:0 0 18px #8888FF}}
        @keyframes pipeGlow{0%,100%{border-color:#1EAAAA22}50%{border-color:#1EAAAA88}}
        @keyframes muteGlow{0%,100%{border-color:#E8A03022}50%{border-color:#E8A03088}}
        *::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:#06090F}
        *::-webkit-scrollbar-thumb{background:#1A3050;border-radius:2px}
        textarea:focus{border-color:#2E6A9A!important}button:hover{opacity:.85}
        .chart-clickable{cursor:pointer}
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.title}>HUDSON &amp; PERRY'S DRIFT LAW · ARCHITECT V1.5.2</div>
          <div style={S.subtitle}>
            © HUDSON &amp; PERRY RESEARCH · MUTE:{USE_MUTE_MODE?"ON":"OFF"} · GATE:{USE_DRIFT_GATE?"ON":"OFF"} · REWIND:ON · ARCHITECT:ON · V1.5.2
          </div>
          <div style={{display:"flex",gap:10,marginTop:3}}>
            <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
              style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#4A9EFF",
                textDecoration:"none",letterSpacing:1,opacity:.7}}>
              𝕏 @RaccoonStampede
            </a>
            <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
              style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#4A9EFF",
                textDecoration:"none",letterSpacing:1,opacity:.7}}>
              𝕏 @Prosperous727
            </a>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {constantsModified&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#E8A030",
              letterSpacing:1,padding:"3px 8px",border:"1px solid #E8A03044",
              borderRadius:4,background:"#0A0800"}}>
              ⚠ κ/ANCHOR MODIFIED
            </div>
          )}
          {lock888Achieved&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:10,color:"#8888FF",
              letterSpacing:2,padding:"3px 10px",border:"1px solid #8888FF44",
              borderRadius:4,background:"#0A0A1A",animation:"lock888 2s infinite"}}>
              🔒 LOCK_888
            </div>
          )}
          {muteModeActive&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#E8A030",
              letterSpacing:1,padding:"3px 8px",border:"1px solid #E8A03033",
              borderRadius:4,background:"#0A0800",animation:"muteGlow 1.5s infinite"}}>
              🔇 MUTE
            </div>
          )}
          {driftGateActive&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#E05060",
              letterSpacing:1,padding:"3px 8px",border:"1px solid #E0506033",
              borderRadius:4,background:"#0A0808"}}>
              ⊘ GATE
            </div>
          )}
          {rewindTurn!==null&&(
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <button onClick={()=>rewindTurn!==1?restoreToTurn(rewindTurn-1):null}
                style={{padding:"4px 10px",background:"#0A1A0A",border:"1px solid #40D08044",
                  borderRadius:4,color:"#40D080",cursor:"pointer",
                  fontSize:11,fontFamily:"Courier New, monospace",opacity:rewindTurn===1?0.3:1}}>
                prev
              </button>
              <button onClick={resumeLive} style={{padding:"6px 14px",background:"#0A2A0A",
                border:"2px solid #40D080",borderRadius:4,color:"#40D080",cursor:"pointer",
                fontSize:11,fontFamily:"Courier New, monospace",letterSpacing:1,
                fontWeight:"bold",animation:"pipeGlow 1.5s infinite"}}>
                T{rewindTurn} LIVE
              </button>
              <button onClick={()=>rewindTurn!==turnSnapshots.length?restoreToTurn(rewindTurn+1):null}
                style={{padding:"4px 10px",background:"#0A1A0A",border:"1px solid #40D08044",
                  borderRadius:4,color:"#40D080",cursor:"pointer",
                  fontSize:11,fontFamily:"Courier New, monospace",
                  opacity:rewindTurn===turnSnapshots.length?0.3:1}}>
                next
              </button>
            </div>
          )}
          <div style={S.modeBadge}>
            <div style={S.modeDot}/>
            <span style={S.modeLabel}>{currentMode.label}</span>
            <span style={{fontFamily:"Courier New, monospace",fontSize:10,color:"#4A6880"}}>
              γ_h={currentMode.gamma_h}
            </span>
          </div>
          <button style={S.exportBtn} onClick={()=>setShowExport(p=>!p)}>
            {showExport?"HIDE":"EXPORT"}
          </button>
          <button style={{...S.exportBtn,borderColor:"#40D08044",color:"#40D080"}}
            onClick={()=>setShowTuning(p=>!p)}>
            {showTuning?"HIDE TUNE":`TUNE${activePreset!=="DEFAULT"?` · ${PRESETS[activePreset]?.label??activePreset}`:""}`}
          </button>
          <button style={{...S.exportBtn,borderColor:"#4A9EFF44",color:"#4A9EFF"}}
            onClick={()=>setShowGuide(p=>!p)}>
            {showGuide?"HIDE GUIDE":"GUIDE"}
          </button>
          <button style={{...S.logBtn,
              borderColor:errorLog.length>0?"#E0506044":"#4A9EFF44",
              color:errorLog.length>0?"#E05060":"#4A9EFF"}}
              onClick={()=>setShowLog(p=>!p)}>
              {showLog?"HIDE ARCHITECT":`ARCHITECT${eventLog.length>0||errorLog.length>0?` (${eventLog.length}${errorLog.length>0?` ⚠${errorLog.length}`:""})`:""}`}
            </button>
          {bookmarks.length>0&&(
            <button style={{...S.logBtn,borderColor:"#C8860A44",color:"#C8860A"}}
              onClick={()=>setShowBookmarks(p=>!p)}>
              {showBookmarks?"HIDE SAVED":`★ SAVED (${bookmarks.length})`}
            </button>
          )}
          {messages.length>0&&(
            <button style={{...S.logBtn,borderColor:"#40D08044",color:"#40D080"}}
              onClick={()=>setExportContent(downloadChat(messages,coherenceData,eventLog,sessionId,userKappa,userAnchor))}>
              CHAT
            </button>
          )}
          {coherenceData.length>0&&(
            <button style={{...S.logBtn,borderColor:"#8888FF44",color:"#8888FF"}}
              onClick={()=>setExportContent(downloadResearch(coherenceData,eventLog,sessionId,userKappa,userAnchor,activePreset,researchNotes))}>
              RESEARCH
            </button>
          )}
          {coherenceData.length>0&&(
            <button style={{...S.logBtn,borderColor:"#4A9EFF44",color:"#4A9EFF"}}
              onClick={()=>setExportContent(downloadSdePaths(livePaths,coherenceData,sessionId,nPaths,userKappa))}>
              SDE
            </button>
          )}
          <button style={{...S.logBtn,borderColor:"#C8860A44",color:"#C8860A"}}
          onClick={()=>setShowNotes(p=>!p)}>
          {showNotes?"HIDE NOTES":"NOTES"}
        </button>
        <button style={S.resetBtn} onClick={resetSession}>RESET</button>
        </div>
      </div>

      {/* API KEY */}
      <div style={S.apiKeyRow}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:9,
          color:apiKeyValid?"#40D080":"#4A6880",letterSpacing:2,flexShrink:0}}>
          {apiKeyValid?"🔑 KEY SET":"🔑 API KEY"}
        </span>
        <input type={showApiKey?"text":"password"} value={apiKey} onChange={e=>setApiKey(e.target.value)}
          placeholder="sk-ant-... (optional in artifact)"
          style={{flex:1,background:"#0A1020",border:`1px solid ${apiKeyValid?"#1EAAAA44":"#1A3050"}`,
            borderRadius:4,color:"#7AB8D8",padding:"4px 10px",
            fontFamily:"Courier New, monospace",fontSize:11,outline:"none"}}/>
        <button onClick={()=>setShowApiKey(p=>!p)}
          style={{...S.resetBtn,padding:"2px 8px",fontSize:9}}>{showApiKey?"HIDE":"SHOW"}</button>
        {apiKey.trim().length>0&&!apiKeyValid&&(
          <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#E05060",flexShrink:0}}>
            must start with sk-
          </span>
        )}
        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
          style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2A5070",
            textDecoration:"none",flexShrink:0}}>get key ↗</a>
      </div>

      {/* STATUS BAR */}
      {messages.length>0&&(()=>{
        const statusText=smoothedVar===null?"Session starting…"
          :smoothedVar>VAR_DECOHERENCE?"⚠ HIGH VARIANCE — AI may be drifting or hallucinating"
          :smoothedVar>VAR_CAUTION?"△ CAUTION — Variance rising, watch for off-topic responses"
          :lock888Achieved&&(computeSessionHealth(coherenceData,driftCount,smoothedVar,calmStreak,lock888Achieved,cfg)??0)>=60?"🔒 FULLY STABLE — AI is consistent and on-task"
          :calmStreak>=3?"✓ STABLE — AI is coherent and on-task"
          :driftCount>4?"⚠ DRIFT DETECTED — Harness is correcting the AI"
          :"◆ MONITORING — Session looks normal";
        const barColor=smoothedVar===null?"#2A4060"
          :smoothedVar>VAR_DECOHERENCE?"#E05060"
          :smoothedVar>VAR_CAUTION?"#E8A030"
          :lock888Achieved||calmStreak>=3?"#40D080"
          :driftCount>4?"#E8A030":"#4A7090";
        return (
          <div style={{padding:"4px 20px",background:"#070A10",
            borderBottom:"1px solid #1A3050",
            display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",
              background:barColor,flexShrink:0}}/>
            <span style={{fontFamily:"Courier New, monospace",fontSize:10,
              color:barColor,letterSpacing:1}}>{statusText}</span>
            {turnCount>0&&<span style={{fontFamily:"Courier New, monospace",
              fontSize:9,color:"#2A4060",marginLeft:"auto"}}>
              Turn {turnCount} · Avg C: {coherenceData.length?(coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length).toFixed(3):"—"}
            </span>}
          </div>
        );
      })()}

      {/* EXPORT PANEL */}
      {showExport&&(
        <div style={{background:"#050810",borderBottom:"1px solid #1EAAAA44",padding:"12px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{...S.sectionTitle,marginBottom:0,color:"#1EAAAA"}}>
              MISSION PROTOCOL — HUDSON &amp; PERRY ARCHITECT V1.5.2
            </span>
            <button style={{...S.exportBtn,background:copied?"#0A2A2A":"transparent",
              color:copied?"#40D080":"#1EAAAA"}} onClick={handleCopyExport}>
              {copied?"✓ COPIED":"COPY"}
            </button>
          </div>
          <pre style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A8090",
            lineHeight:1.7,margin:0,maxHeight:200,overflowY:"auto",
            whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{exportBlock}</pre>
        </div>
      )}

      {/* RESEARCH NOTES PANEL */}
      {showNotes&&(
        <div style={{background:"#050810",borderBottom:"1px solid #C8860A44",padding:"12px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontFamily:"Courier New, monospace",fontSize:9,
              color:"#C8860A",letterSpacing:2}}>RESEARCH NOTES — stamped on RESEARCH export</span>
            <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2A4060"}}>
              {researchNotes.length} chars
            </span>
          </div>
          <textarea value={researchNotes} onChange={e=>setResearchNotes(e.target.value)}
            placeholder={"Hypothesis, custom SDE values, theory notes...\n\nExample: Testing α=-0.40 (aggressive mean-reversion). Expected: tighter Kalman bands."}
            style={{width:"100%",minHeight:110,background:"#0A1020",
              border:"1px solid #C8860A33",borderRadius:4,color:"#C8A060",
              padding:"8px 12px",fontFamily:"Courier New, monospace",fontSize:9,
              lineHeight:1.7,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          <div style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2A4060",marginTop:4}}>
            Saved automatically · Persists across resets · Exported with RESEARCH
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={S.body}>

        {/* CHAT */}
        <div style={S.chatPanel}>
          <div style={S.chatMessages}>
            {messages.length===0&&(
              <div style={{margin:"auto",textAlign:"center",
                fontFamily:"Courier New, monospace",fontSize:11,lineHeight:2}}>
                <div style={{fontSize:28,marginBottom:12,opacity:.3}}>⬡</div>
                <div style={{opacity:.5,marginBottom:4}}>HUDSON &amp; PERRY'S DRIFT LAW · ARCHITECT V1.5.2</div>
                <div style={{fontSize:9,letterSpacing:2,opacity:.4}}>
                  SDE · KALMAN · GARCH · TF-IDF · JSD · RAG · PIPE · MUTE · GATE · REWIND · ARCHITECT
                </div>
                <div style={{fontSize:8,color:"#2A4060",marginTop:4,opacity:.5}}>
                  TAP 📎 TO ATTACH · CLICK CHART TO REWIND
                </div>
                <div style={{marginTop:12,padding:"8px 16px",background:"#0A1020",
                  borderRadius:4,border:"1px solid #1EAAAA33",
                  fontFamily:"Courier New, monospace",fontSize:8,color:"#1EAAAA",
                  lineHeight:1.7,opacity:.8}}>
                  NEW? Click <strong>GUIDE</strong> in the header to learn how to read the chart.<br/>
                  Recommended: start with DEFAULT preset · post-audit OFF · 50 SDE paths.<br/>
                  Enable advanced features in <strong>TUNE</strong> when ready.
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:14}}>
                  <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
                    style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A9EFF",
                      textDecoration:"none",letterSpacing:1,opacity:.6,
                      padding:"4px 10px",border:"1px solid #4A9EFF22",borderRadius:4}}>
                    𝕏 @RaccoonStampede
                  </a>
                  <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
                    style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A9EFF",
                      textDecoration:"none",letterSpacing:1,opacity:.6,
                      padding:"4px 10px",border:"1px solid #4A9EFF22",borderRadius:4}}>
                    𝕏 @Prosperous727
                  </a>
                </div>
              </div>
            )}

            {rewindTurn!==null&&(
              <div style={{padding:"6px 12px",background:"#0A1A0A",border:"1px solid #40D08033",
                borderRadius:6,fontFamily:"Courier New, monospace",fontSize:9,
                color:"#40D080",letterSpacing:1,textAlign:"center"}}>
                ⟲ VIEWING TURN {rewindTurn} STATE — Continue typing to resume from here, or click RESUME LIVE
              </div>
            )}

            {messages.map((msg,i)=>{
              const isUser=msg.role==="user";
              const ti=messages.slice(0,i+1).filter(m=>m.role==="assistant").length-1;
              const cdata=!isUser&&ti>=0?coherenceData[ti]:null;
              const drifted=cdata?.harnessActive;
              const display=msg._display??getTextFromContent(msg.content);
              const atts=msg._attachments??[];
              return (
                <div key={i} style={{display:"flex",flexDirection:"column",
                  alignItems:isUser?"flex-end":"flex-start"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <div style={S.roleLabel}>{isUser?"USER":"ASSISTANT"}</div>
                    {!isUser&&ti>=0&&<button onClick={()=>deleteTurn(ti)}
                        title="Delete turn"
                        style={{background:"none",border:"1px solid #2A4060",borderRadius:3,
                          color:"#3A5870",cursor:"pointer",fontSize:9,padding:"1px 5px",
                          fontFamily:"Courier New, monospace",lineHeight:1.4,opacity:0.5}}>x</button>}
                    {!isUser&&ti>=0&&(()=>{
                      const isBookmarked=bookmarks.some(b=>b.cohIdx===ti);
                      return (
                        <button onClick={()=>toggleBookmark(ti)}
                          title={isBookmarked?"Remove bookmark":"Bookmark this turn"}
                          style={{background:"none",
                            border:`1px solid ${isBookmarked?"#C8860A88":"#2A4060"}`,
                            borderRadius:3,color:isBookmarked?"#C8860A":"#3A5870",
                            cursor:"pointer",fontSize:10,padding:"1px 5px",
                            fontFamily:"Courier New, monospace",lineHeight:1.4,
                            opacity:isBookmarked?1:0.5}}>
                          {isBookmarked?"★":"☆"}
                        </button>
                      );
                    })()}
                  </div>
                  <div style={{...(isUser?S.userBubble:S.assistantBubble),...(drifted?S.driftBubble:{})}}>
                    {atts.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                        {atts.map(att=>{
                          const cfg=FILE_TYPES[att.kind];
                          return (
                            <div key={att.id} style={{display:"flex",alignItems:"center",gap:4,
                              padding:"2px 7px",borderRadius:3,
                              background:`${cfg.color}10`,border:`1px solid ${cfg.color}30`}}>
                              {att.kind==="image"&&att.preview
                                ?<img src={att.preview} alt="" style={{width:16,height:16,borderRadius:2,objectFit:"cover"}}/>
                                :<span style={{fontSize:11}}>{cfg.icon}</span>}
                              <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:cfg.color}}>{att.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!isUser&&drifted&&(
                      <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#E05060",
                        letterSpacing:2,marginBottom:6,borderBottom:"1px solid #E0506033",paddingBottom:5}}>
                        ⚠ DRIFT DETECTED — HARNESS ENGAGED
                        <span style={{display:"block",fontSize:8,color:"#A05060",
                          letterSpacing:0,marginTop:3,fontWeight:"normal"}}>
                          This response scored below the expected coherence band.
                          The AI may have gone off-topic or changed approach unexpectedly.
                          Harness mode has tightened for the next response.
                        </span>
                      </div>
                    )}
                    <div style={{whiteSpace:"pre-wrap"}}>{display}</div>
                    {cdata&&(
                      <div style={{marginTop:6,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <ScoreBadge score={cdata.raw} kalman={cdata.kalman}/>
                        <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#2A4060"}}>
                          K={cdata.kalman.toFixed(3)}
                        </span>
                        {cdata.smoothedVar!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            color:cdata.smoothedVar>VAR_DECOHERENCE?"#E05060"
                              :cdata.smoothedVar>VAR_CAUTION?"#E8A030"
                              :cdata.smoothedVar<VAR_CALM?"#40D080":"#7AB8D8"}}>
                            σ²={cdata.smoothedVar.toFixed(4)}
                          </span>
                        )}
                        {cdata.sourceScore!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:cdata.sourceScore>0.15?"#0A2A1A":"#1A0808",
                            color:cdata.sourceScore>0.15?"#40D080":"#E05060",
                            border:`1px solid ${cdata.sourceScore>0.15?"#40D08033":"#E0506033"}`}}>
                            {cdata.sourceScore>0.15?"✓ SRC":"⚠ SRC"}
                          </span>
                        )}
                        {cdata.hallucinationFlag&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:"#1A0A00",color:"#E8A030",
                            border:"1px solid #E8A03033"}}
                            title={cdata.hallucinationSignals?.join(" | ")||""}>
                            ⚠ H-SIG
                          </span>
                        )}
                        {cdata.behavioralFlag&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:"#0A0A1A",color:"#8888FF",
                            border:"1px solid #8888FF33"}}
                            title={cdata.behavioralSignals?.map(s=>s.type).join(" | ")||""}>
                            ⚠ B-SIG
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading&&(
              <div>
                <div style={S.roleLabel}>ASSISTANT</div>
                <div style={S.assistantBubble}>
                  <div style={S.loading}>
                    {[0,1,2].map(i=><div key={i} style={{...S.dot,animationDelay:`${i*.2}s`}}/>)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {attachments.length>0&&(
            <div style={S.attachRow}>
              {attachments.map(att=><FileChip key={att.id} att={att} onRemove={removeAttachment}/>)}
            </div>
          )}

          {fileError&&(
            <div style={{
              ...S.errorBar,
              color: fileError.startsWith("⚠")?"#E05060":"#1EAAAA",
              borderTopColor: fileError.startsWith("⚠")?"#E0506033":"#1EAAAA33",
            }}>{fileError}</div>
          )}

          {/* P16: statusMessage — non-error status (rewind, delete). Separate from file errors. */}
          {statusMessage&&!fileError&&(
            <div style={{
              ...S.errorBar,
              color:"#40D080",
              borderTopColor:"#40D08033",
            }}>{statusMessage}</div>
          )}

          <div style={S.inputRow}>
            <label style={{...S.attachBtn,
              borderColor:attachments.length>0?"#1EAAAA":"#1A3050",
              color:attachments.length>0?"#1EAAAA":"#4A7090",cursor:"pointer"}}>
              📎
              <input type="file" multiple accept={ACCEPTED_EXTENSIONS}
                onChange={e=>{processFiles(e.target.files);e.target.value="";}}
                style={{position:"absolute",width:"1px",height:"1px",
                  opacity:0,overflow:"hidden",pointerEvents:"none"}}/>
            </label>
            <textarea ref={inputRef} rows={2} style={S.textarea}
              placeholder={attachments.length?"Add message or send as-is…":"Message… (Enter to send)"}
              value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}/>
            <button style={{...S.sendBtn,opacity:(isLoading||(!input.trim()&&!attachments.length))?0.4:1}}
              onClick={sendMessage}
              disabled={isLoading||(!input.trim()&&!attachments.length)}>SEND</button>
          </div>
        </div>

        {/* METRICS */}
        <div style={S.metricsPanel}>
          <div style={{...S.metricSection,flex:"0 0 auto",paddingBottom:0}}>
            <div style={S.sectionTitle}>
              COHERENCE TRACKER{chartData.length>0?" — CLICK ANY POINT TO REWIND":""}
            </div>
          </div>
          <div style={{flex:"0 0 160px",padding:"0 8px 8px 0",overflow:"hidden"}}>
            {chartData.length===0
              ?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",
                  fontFamily:"Courier New, monospace",fontSize:10,color:"#2A4060",letterSpacing:2}}>AWAITING DATA</div>
              :(
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}
                    margin={{top:8,right:12,bottom:4,left:0}}
                    onClick={handleChartClick}
                    className="chart-clickable">
                    <CartesianGrid strokeDasharray="2 4" stroke="#0E1E30"/>
                    <XAxis dataKey="turn" tick={{fontSize:9,fill:"#3A5870",fontFamily:"Courier New"}}/>
                    <YAxis domain={[.2,1.0]} tick={{fontSize:9,fill:"#3A5870",fontFamily:"Courier New"}}
                      tickFormatter={v=>v.toFixed(1)}/>
                    <Tooltip content={<CoherenceTooltip/>}/>
                    <Area type="monotone" dataKey="p90" stroke="none" fill="#0E4A7A" fillOpacity={.25} name="90th pct"/>
                    <Area type="monotone" dataKey="p10" stroke="none" fill="#06090F" fillOpacity={1} name="10th pct"/>
                    <Line type="monotone" dataKey="floor" stroke="#9B2335" strokeWidth={1}
                      strokeDasharray="3 3" dot={false} name="DL floor"/>
                    <Line type="monotone" dataKey="kalman" stroke="#1EAAAA" strokeWidth={2}
                      dot={false} name="Kalman"/>
                    <Scatter dataKey="raw" fill="#C8860A" name="Raw C" r={3}/>
                    <Line type="monotone" dataKey="raw" stroke="#C8860A44" strokeWidth={1}
                      dot={{fill:"#C8860A",r:3}} name="Score"/>
                    <Scatter dataKey="harness" fill="#E05060" name="Drift" r={5}/>
                    {rewindTurn!==null&&(
                      <Line type="monotone" dataKey={d=>d.turn===rewindTurn?1:null}
                        stroke="#40D080" strokeWidth={0} dot={{fill:"#40D080",r:7,strokeWidth:0}} name="Rewind"/>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </div>

          <div style={{flex:1,overflowY:"auto"}}>

            {/* Harness Status */}
            <div style={S.metricSection}>
              <div style={S.sectionTitle}>HARNESS STATUS</div>
              {/* V1.5.0: active preset badge */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2A4060",letterSpacing:2}}>PROFILE</span>
                <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                  padding:"1px 8px",borderRadius:3,
                  color:PRESETS[activePreset]?.color??"#7AB8D8",
                  border:`1px solid ${PRESETS[activePreset]?.color??"#7AB8D8"}33`,
                  background:`${PRESETS[activePreset]?.color??"#7AB8D8"}0A`}}>
                  {PRESETS[activePreset]?.label??activePreset}
                </span>
                <span style={{fontFamily:"Courier New, monospace",fontSize:7,
                  color:"#2A4060"}}>
                  {[!featKalman&&"K",!featGARCH&&"G",!featSDE&&"S",!featRAG&&"R",
                    !featPipe&&"P",!featBSig&&"B",!featHSig&&"H"].filter(Boolean).join(" ")||"all on"}
                </span>
              </div>
              {(()=>{
                const health=computeSessionHealth(coherenceData,driftCount,smoothedVar,calmStreak,lock888Achieved,cfg);
                const hColor=health===null?"#3A5870":health>=75?"#40D080":health>=50?"#E8A030":"#E05060";
                const hLabel=health===null?"—":health>=75?"STRONG":health>=50?"FAIR":"WEAK";
                return health!==null?(
                  <div style={{marginBottom:8,padding:"6px 10px",borderRadius:4,
                    background:`${hColor}0A`,border:`1px solid ${hColor}33`,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A6880",letterSpacing:2}}>SESSION HEALTH</span>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:16,color:hColor,fontWeight:"bold",letterSpacing:1}}>
                      {health}<span style={{fontSize:10,opacity:.7}}>/100</span>
                      <span style={{fontSize:9,marginLeft:6,opacity:.8}}>{hLabel}</span>
                    </span>
                  </div>
                ):null;
              })()}
              {[
                ["κ → DAMPING",  `${KAPPA} → ${DAMPING.toFixed(4)}`,"#C8860A"],
                ["γ_h",          currentMode.gamma_h,               currentMode.color],
                ["cap_eff",      cap_eff.toFixed(8),                  null],
                ["Drift events", driftCount,                          driftCount>0?"#E05060":"#40D080"],
                ["Last C",       lastScore!=null?lastScore.toFixed(4):"—",
                  lastScore==null?"#3A5870":lastScore>.80?"#40D080":lastScore>.65?"#E8A030":"#E05060"],
                ["Kalman x̂",    kalmanState.x.toFixed(4),            "#1EAAAA"],
                ["Kalman P",     kalmanState.P.toFixed(5),             null],
                ["Snapshots",    turnSnapshots.length,                 turnSnapshots.length>0?"#40D080":"#3A5870"],
              ].map(([label,val,color])=>(
                <div key={label} style={S.statRow}>
                  <span style={S.statLabel}>{label}</span>
                  <span style={{...S.statValue,...(color?{color}:{})}}>{val}</span>
                </div>
              ))}
              {featZeroDrift&&<div style={{marginTop:8,padding:"8px 10px",borderRadius:4,background:"#0A1020",
                border:`1px solid ${lockStatus.locked?"#1EAAAA44":"#2A405044"}`}}>
                <div style={{...S.sectionTitle,marginBottom:6}}>ZERO-DRIFT · {RESONANCE_ANCHOR} Hz</div>
                {[
                  ["Status",  lockStatus.locked?"🔒 ACHIEVED":"CONVERGING",lockStatus.locked?"#40D080":"#E8A030"],
                  ["Residual",`${lockStatus.residual.toFixed(8)} Hz`,null],
                  ["Iters",   lockStatus.iters,null],
                ].map(([label,val,color])=>(
                  <div key={label} style={S.statRow}>
                    <span style={S.statLabel}>{label}</span>
                    <span style={{...S.statValue,fontSize:10,...(color?{color}:{})}}>{val}</span>
                  </div>
                ))}
              </div>}
              <div style={{marginTop:8}}>
                <div style={{...S.statLabel,marginBottom:4}}>SUPPRESSION</div>
                <div style={S.driftBar}>
                  <div style={{height:"100%",borderRadius:2,width:`${Math.min(driftCount/8*100,100)}%`,
                    background:`linear-gradient(90deg,#1E6A2A,${currentMode.color})`,
                    transition:"width .5s,background .5s"}}/>
                </div>
              </div>
            </div>

            {/* Pipe + Variance */}
            <div style={S.metricSection}>
              <div style={S.sectionTitle}>VARIANCE PIPE · MUTE · GATE</div>
              {/* V1.5.0: token estimate + session ID */}
              {tokenEstimate>0&&(
                <div style={{marginBottom:8,padding:"4px 8px",borderRadius:3,
                  background:tokenEstimate>70000?"#150808":tokenEstimate>40000?"#0A0A00":"#0A0E18",
                  border:`1px solid ${tokenEstimate>70000?"#E0506044":tokenEstimate>40000?"#E8A03033":"#1A2840"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:tokenEstimate>70000?"#E05060":tokenEstimate>40000?"#E8A030":"#2A4060"}}>
                      EST. TOKENS
                    </span>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                      color:tokenEstimate>70000?"#E05060":tokenEstimate>40000?"#E8A030":"#4A6880",
                      fontWeight:"bold"}}>
                      {tokenEstimate.toLocaleString()}
                      {tokenEstimate>70000?" ⚠":tokenEstimate>40000?" △":""}
                    </span>
                  </div>
                  {tokenEstimate>70000&&(
                    <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                      color:"#A05050",marginTop:2}}>
                      near context limit — consider reset or prune — consider reset or prune
                    </div>
                  )}
                </div>
              )}
              <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                color:"#1A3040",marginBottom:6,letterSpacing:1}}>
                SESSION · {sessionId}
              </div>
              {[
                ["Smoothed σ²",   smoothedVar!=null?smoothedVar.toFixed(6):"—",  varColor],
                ["State",         varLabel,                                         varColor],
                ["Calm streak",   calmStreak,                                       calmStreak>=LOCK_888_STREAK?"#8888FF":"#4A6880"],
                ["LOCK_888",      lock888Achieved?"✓ ACHIEVED":`${LOCK_888_STREAK-calmStreak} away`,
                  lock888Achieved?"#8888FF":"#3A5870"],
                ["Mute mode",     muteModeActive?"ACTIVE — "+MUTE_MAX_TOKENS+" tok":"standby",
                  muteModeActive?"#E8A030":"#3A5870"],
                ["Drift gate",    driftGateActive?"ACTIVE — "+DRIFT_GATE_WORD_LIMIT+" words":"standby",
                  driftGateActive?"#E05060":"#3A5870"],
                ["Events",        eventLog.length,
                  eventLog.length>0?"#4A9EFF":"#3A5870"],
                ["H-Signals",     eventLog.filter(e=>e.type==="probable_hallucination_signal").length,
                  eventLog.filter(e=>e.type==="probable_hallucination_signal").length>0?"#E8A030":"#3A5870"],
                ["B-Signals",     eventLog.filter(e=>e.type==="behavioral_signal").length,
                  eventLog.filter(e=>e.type==="behavioral_signal").length>0?"#8888FF":"#3A5870"],
              ].map(([label,val,color])=>(
                <div key={label} style={S.statRow}>
                  <span style={S.statLabel}>{label}</span>
                  <span style={{...S.statValue,fontSize:10,...(color?{color}:{})}}>{val}</span>
                </div>
              ))}
            </div>

            {/* RAG */}
            {USE_RAG&&(
              <div style={S.metricSection}>
                <div style={S.sectionTitle}>RAG MEMORY</div>
                {[
                  ["Cache",     ragCache.length,  ragCache.length>0?"#40D080":"#3A5870"],
                  ["Retrievals",ragHits,           ragHits>0?"#1EAAAA":"#3A5870"],
                  ["Pruning",   contextPruned?"ACTIVE":`>${PRUNE_THRESHOLD} to trigger`,contextPruned?"#E8A030":"#3A5870"],
                ].map(([label,val,color])=>(
                  <div key={label} style={S.statRow}>
                    <span style={S.statLabel}>{label}</span>
                    <span style={{...S.statValue,fontSize:10,...(color?{color}:{})}}>{val}</span>
                  </div>
                ))}
                {ragCache.slice(0,3).map(e=>(
                  <div key={e.turn} style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#2A5070",lineHeight:1.6,marginTop:3,
                    padding:"3px 6px",background:"#0A1020",borderRadius:3}}>
                    T{e.turn} C={e.score.toFixed(3)} — {e.text.slice(0,55)}…
                  </div>
                ))}
              </div>
            )}

            {/* Error Trace */}
            {errorLog.length>0&&(
              <div style={S.metricSection}>
                <div style={{...S.sectionTitle,color:"#E05060"}}>ARCHITECT · {errorLog.length}{corrections.length>0?" · "+corrections.length+" FP":""}</div>
                {errorLog.slice(-5).map((e,i)=>{
                  const sc=e.severity==="fatal"?"#FF4444":e.severity==="warn"?"#E8A030":"#E05060";
                  return (
                    <div key={i} style={{fontFamily:"Courier New, monospace",fontSize:8,
                      lineHeight:1.6,marginBottom:4,
                      padding:"4px 6px",background:"#150808",borderRadius:3,
                      borderLeft:`2px solid ${sc}66`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{color:sc,letterSpacing:1}}>
                          [{e.severity?.toUpperCase()||"ERR"}] {e.stage?.toUpperCase().split("_").join(" ")}
                        </span>
                        <span style={{color:"#3A5870"}}>T{e.turn} · {e.timestamp?.slice(11,19)}</span>
                      </div>
                      <div style={{color:"#C05050"}}>{e.message?.slice(0,80)}{e.message?.length>80?"…":""}</div>
                      {e.hint&&<div style={{color:"#E8A03099",fontSize:7,marginTop:2}}>💡 {e.hint?.slice(0,60)}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mode override */}
            <div style={S.metricSection}>
              <div style={S.sectionTitle}>OVERRIDE MODE</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(HARNESS_MODES).map(([key,mode])=>(
                  <button key={key} onClick={()=>setHarnessMode(key)} style={{
                    padding:"4px 10px",borderRadius:4,cursor:"pointer",
                    fontFamily:"Courier New, monospace",fontSize:9,letterSpacing:1,
                    border:`1px solid ${key===harnessMode?mode.color:"#1A3050"}`,
                    background:key===harnessMode?`${mode.color}18`:"transparent",
                    color:key===harnessMode?mode.color:"#3A5870",transition:"all .15s",
                  }}>{mode.label}</button>
                ))}
              </div>
              {/* Configurable pruning */}
              <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #1A2840"}}>
                <div style={{...S.sectionTitle,marginBottom:6}}>CONTEXT PRUNING</div>
                <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={S.statLabel}>Trigger at</span>
                    <input type="number" min="4" max="20" value={pruneThreshold}
                      onChange={e=>setPruneThreshold(Math.max(4,Math.min(20,+e.target.value)))}
                      style={{width:42,background:"#0A1020",border:"1px solid #1A3050",
                        borderRadius:3,color:"#7AB8D8",padding:"2px 6px",
                        fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
                    <span style={S.statLabel}>turns</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={S.statLabel}>Keep top</span>
                    <input type="number" min="2" max="10" value={pruneKeep}
                      onChange={e=>setPruneKeep(Math.max(2,Math.min(10,+e.target.value)))}
                      style={{width:42,background:"#0A1020",border:"1px solid #1A3050",
                        borderRadius:3,color:"#7AB8D8",padding:"2px 6px",
                        fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
                    <span style={S.statLabel}>pairs</span>
                  </div>
                </div>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2A4060",marginTop:5}}>
                  Higher trigger = more context kept. Higher keep = smarter pruning.
                </div>
              </div>
            </div>

            {/* SDE params */}
            <div style={S.metricSection}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                cursor:"pointer",marginBottom:showParams?8:0}} onClick={()=>setShowParams(p=>!p)}>
                <div style={{...S.sectionTitle,marginBottom:0}}>SDE PARAMS</div>
                <span style={{...S.statLabel,color:"#2A4060"}}>{showParams?"▲":"▼"}</span>
              </div>
              {showParams&&(
                <>
                  {[
                    ["α",SDE_PARAMS.alpha],["β_p",SDE_PARAMS.beta_p],
                    ["ω",SDE_PARAMS.omega.toFixed(4)],["σ",SDE_PARAMS.sigma],
                    ["HC_MASS_LOSS",HC_MASS_LOSS],["LOCK_888",LOCK_888],
                    ["α/(1+κ)",(SDE_PARAMS.alpha/(1+SDE_PARAMS.kappa)).toFixed(5)],
                    ["b=σ/(1+κ)",(SDE_PARAMS.sigma*DAMPING).toFixed(5)],
                  ].map(([label,val])=>(
                    <div key={label} style={S.statRow}>
                      <span style={S.statLabel}>{label}</span>
                      <span style={S.statValue}>{val}</span>
                    </div>
                  ))}
                  <div style={{marginTop:6,padding:"8px 10px",background:"#0A1020",borderRadius:4,
                    border:"1px solid #1A2840",fontFamily:"Courier New, monospace",
                    fontSize:9,color:"#2A5070",lineHeight:1.8}}>
                    dε = a(t)ε dt + b dW_t<br/>
                    a(t) = (α+β_p·sin(ωt))/(1+κ)<br/>
                    GARCH: σ²_t = ω + α·ε²_t-1 + β·σ²_t-1<br/>
                    Mute: {activeMutePhrases.slice(0,3).join(", ")}…<br/>
                    Gate threshold: σ² &gt; {VAR_CAUTION}
                  </div>
                  {/* V1.5.0: Adaptive sigma controls */}
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #1A2840"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:adaptiveSigmaOn?"#1EAAAA":"#2A4060",letterSpacing:2}}>
                        ADAPTIVE σ {adaptiveSigmaOn?"ON":"OFF"}
                      </span>
                      <button onClick={()=>setAdaptiveSigmaOn(p=>!p)} style={{
                        padding:"2px 10px",borderRadius:3,cursor:"pointer",
                        fontFamily:"Courier New, monospace",fontSize:8,letterSpacing:1,
                        border:`1px solid ${adaptiveSigmaOn?"#1EAAAA":"#2A4060"}`,
                        background:adaptiveSigmaOn?"#0A1A1A":"transparent",
                        color:adaptiveSigmaOn?"#1EAAAA":"#2A4060",transition:"all .15s",
                      }}>{adaptiveSigmaOn?"DISABLE":"ENABLE"}</button>
                    </div>
                    {adaptiveSigmaOn&&(
                      <>
                        <div style={S.statRow}>
                          <span style={S.statLabel}>σ adapted</span>
                          <span style={{...S.statValue,color:"#1EAAAA"}}>{adaptedSigma.toFixed(5)}</span>
                        </div>
                        <div style={S.statRow}>
                          <span style={S.statLabel}>σ original</span>
                          <span style={S.statValue}>{SDE_PARAMS.sigma}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                          <span style={S.statLabel}>Rate</span>
                          <input type="range" min="0.01" max="0.08" step="0.005"
                            value={adaptationRate}
                            onChange={e=>setAdaptationRate(+e.target.value)}
                            style={{flex:1,accentColor:"#1EAAAA"}}/>
                          <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                            color:"#1EAAAA",minWidth:38}}>{adaptationRate.toFixed(3)}</span>
                        </div>
                        <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                          color:"#2A4060",marginTop:4,lineHeight:1.6}}>
                          κ=0.444 fixed (Hudson Constant)<br/>
                          chart bands use original σ
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Mode history */}
            {harnessChangeLog.length>1&&(
              <div style={S.metricSection}>
                <div style={S.sectionTitle}>MODE HISTORY</div>
                {harnessChangeLog.map((entry,i)=>(
                  <div key={i} style={{...S.statRow,marginBottom:3}}>
                    <span style={{...S.statLabel,color:"#2A4060"}}>Turn {entry.turn}</span>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                      color:HARNESS_MODES[entry.mode]?.color??"#888"}}>
                      → {HARNESS_MODES[entry.mode]?.label}{entry.active?" ⚠":""}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* EXPORT CONTENT MODAL */}
      {exportContent&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.88)",zIndex:2001,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>{setExportContent(null);setExportCopied(false);}}>
          <div style={{background:"#080C14",border:"1px solid #1E4060",
            borderRadius:8,maxWidth:740,width:"100%",maxHeight:"88vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"12px 18px",
              borderBottom:"1px solid #1A3050",background:"#060A10",flexShrink:0}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:10,
                color:"#7AB8D8",letterSpacing:2,fontWeight:"bold"}}>
                {exportContent.title}
              </span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>{
                  navigator.clipboard.writeText(exportContent.text).then(()=>{
                    setExportCopied(true);
                    setTimeout(()=>setExportCopied(false),2500);
                  });
                }} style={{padding:"5px 16px",
                  background:exportCopied?"#0A2A0A":"transparent",
                  border:`1px solid ${exportCopied?"#40D080":"#1EAAAA44"}`,
                  borderRadius:4,color:exportCopied?"#40D080":"#1EAAAA",
                  cursor:"pointer",fontSize:9,fontFamily:"Courier New, monospace",
                  letterSpacing:1,transition:"all .2s"}}>
                  {exportCopied?"✓ COPIED":"COPY ALL"}
                </button>
                <button onClick={()=>{setExportContent(null);setExportCopied(false);}}
                  style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
                    color:"#4A6880",cursor:"pointer",fontSize:13,padding:"2px 10px",
                    fontFamily:"Courier New, monospace"}}>✕</button>
              </div>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"14px 18px"}}>
              <pre style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#A8C4E0",lineHeight:1.75,margin:0,
                whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                {exportContent.text}
              </pre>
            </div>
            <div style={{padding:"7px 18px",borderTop:"1px solid #1A3050",
              background:"#060A10",flexShrink:0,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2A4060"}}>
                {exportContent.filename}
              </span>
              <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2A4060"}}>
                EXPERIMENTAL DATA — PROXY ONLY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* R&D DISCLAIMER MODAL — shown on load */}
      {showDisclaimer&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.95)",zIndex:2000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#080C14",border:"2px solid #E8A030",
            borderRadius:8,maxWidth:620,width:"100%",maxHeight:"90vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Title */}
            <div style={{padding:"14px 20px",borderBottom:"1px solid #2A1A00",
              background:"#060A08",flexShrink:0}}>
              <div style={{fontFamily:"Courier New, monospace",fontSize:12,
                color:"#E8A030",letterSpacing:2,fontWeight:"bold",marginBottom:2}}>
                ⚠ RESEARCH &amp; DEVELOPMENT TOOL — IMPORTANT NOTICE
              </div>
              <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#4A6060",letterSpacing:1}}>
                HUDSON &amp; PERRY'S DRIFT LAW · ARCHITECT V1.5.2 · READ IN FULL BEFORE PROCEEDING
              </div>
            </div>

            {/* Body */}
            <div style={{overflowY:"auto",flex:1,padding:"16px 20px",
              fontFamily:"Courier New, monospace",fontSize:8,lineHeight:1.9}}>

              {[
                ["1. EXPERIMENTAL STATUS",
                 "#E8A030",
                 "This software is an experimental research tool in active development. It has not been peer-reviewed, independently audited, clinically validated, or verified against any external dataset. No version of this tool should be considered production-ready, certified, or fit for regulated use."],

                ["2. PROXY INDICATORS — NOT MEASUREMENTS",
                 "#E8A030",
                 "All outputs produced by this tool — including coherence scores, session health scores, hallucination signals, behavioral signals, variance states, Kalman estimates, SDE bands, and Zero-Drift Lock status — are mathematical proxy indicators derived from text analysis heuristics. They do not constitute measurements, assessments, diagnoses, evaluations, or determinations of any kind. They may be inaccurate, misleading, or entirely wrong."],

                ["3. NO CLINICAL, LEGAL, OR SAFETY USE",
                 "#E05060",
                 "Outputs from this tool must not be used — directly or indirectly — to inform medical, psychological, clinical, legal, financial, safety-critical, regulatory, or compliance decisions. This prohibition applies regardless of the context in which the tool is deployed or the nature of the AI being monitored."],

                ["4. NO WARRANTY",
                 "#E05060",
                 "THIS SOFTWARE IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, OR NON-INFRINGEMENT. THE AUTHORS MAKE NO REPRESENTATIONS REGARDING THE CORRECTNESS OR RELIABILITY OF ANY OUTPUT."],

                ["5. LIMITATION OF LIABILITY",
                 "#E05060",
                 "To the maximum extent permitted by applicable law, Hudson & Perry Research, David Hudson, and David Perry shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from the use of, or inability to use, this tool or its outputs. This includes but is not limited to damages from reliance on proxy signals, modified constants, experimental configurations, or any decision made based on tool outputs."],

                ["6. MODIFIED CONSTANTS",
                 "#E8A030",
                 "This tool allows adjustment of foundational constants (κ and RESONANCE_ANCHOR). Results generated with non-default values operate outside the published Hudson & Perry framework and carry no validation basis whatsoever. The authors accept no responsibility for outputs produced under modified-constant configurations."],

                ["7. NOT LEGAL OR PROFESSIONAL ADVICE",
                 "#E8A030",
                 "Nothing in this tool or its outputs constitutes legal, medical, financial, psychological, or any other form of professional advice. Users requiring such advice should consult a qualified licensed professional."],

                ["8. DATA & PRIVACY",
                 "#4A9EFF",
                 "Conversation data processed by this tool is transmitted to Anthropic's API under your own API key and is subject to Anthropic's terms of service and privacy policy. This tool does not independently store, log, or transmit conversation content beyond your active browser session. API keys entered are session-only and are never written to persistent storage."],

                ["9. ACCEPTANCE OF RISK",
                 "#E8A030",
                 "By proceeding past this notice, you acknowledge that you have read and understood these terms, that you accept full responsibility for how you use this tool and interpret its outputs, and that you hold Hudson & Perry Research, David Hudson, and David Perry harmless from any claim arising from your use of this software."],
              ].map(([title,col,body])=>(
                <div key={title} style={{marginBottom:12,paddingBottom:10,
                  borderBottom:"1px solid #0E1820"}}>
                  <div style={{color:col,letterSpacing:1,marginBottom:4,
                    fontWeight:"bold"}}>{title}</div>
                  <div style={{color:"#7A9EBA",lineHeight:1.8}}>{body}</div>
                </div>
              ))}

              <div style={{marginTop:8,padding:"8px 12px",background:"#0A0808",
                borderRadius:4,border:"1px solid #E0506033",
                color:"#A06060",fontSize:7,lineHeight:1.7}}>
                © 2026 Hudson &amp; Perry Research. All rights reserved.
                Contact: 𝕏 @RaccoonStampede · 𝕏 @Prosperous727.
                This notice does not constitute legal advice. Consult a qualified
                attorney regarding your specific obligations and liability exposure.
              </div>
            </div>

            {/* Footer */}
            <div style={{padding:"12px 20px",borderTop:"1px solid #2A1A00",
              background:"#060A08",flexShrink:0,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:7,
                color:"#2A4060",lineHeight:1.5}}>
                Proceeding confirms you have read and accepted all terms above.
              </span>
              <button onClick={()=>setShowDisclaimer(false)}
                style={{padding:"10px 24px",background:"#0A1400",
                  border:"2px solid #E8A030",borderRadius:4,color:"#E8A030",
                  cursor:"pointer",fontSize:10,fontFamily:"Courier New, monospace",
                  letterSpacing:1,fontWeight:"bold",flexShrink:0,marginLeft:16}}
                onClick={()=>{setShowDisclaimer(false);setShowGuide(true);}}>
                I ACCEPT — READ THE GUIDE FIRST
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TUNE MODAL — Presets, Feature Toggles, Custom Config */}
      {showTuning&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.88)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setShowTuning(false)}>
          <div style={{background:"#080C14",border:"1px solid #1E4060",
            borderRadius:8,maxWidth:740,width:"100%",maxHeight:"90vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"12px 18px",
              borderBottom:"1px solid #1A3050",background:"#060A10",flexShrink:0}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:11,
                color:"#40D080",letterSpacing:2,fontWeight:"bold"}}>
                TUNE · {PRESETS[activePreset]?.label??activePreset}
              </span>
              <button onClick={()=>setShowTuning(false)}
                style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
                  color:"#4A6880",cursor:"pointer",fontSize:12,padding:"2px 10px",
                  fontFamily:"Courier New, monospace"}}>✕ CLOSE</button>
            </div>

            {/* TUNE TAB BAR */}
            <div style={{display:"flex",borderBottom:"1px solid #1A3050",background:"#060A10",flexShrink:0}}>
              {[["presets","PRESETS","#40D080"],["features","FEATURES","#4A9EFF"],
                ["math","MATH","#1EAAAA"],
                ["display","DISPLAY","#C8860A"],
              ].map(([tab,label,col])=>(
                <button key={tab} onClick={()=>setTuneTab(tab)} style={{
                  flex:1,padding:"8px 2px",background:"none",cursor:"pointer",
                  fontFamily:"Courier New,monospace",fontSize:8,letterSpacing:1,
                  border:"none",borderBottom:`2px solid ${tuneTab===tab?col:"transparent"}`,
                  color:tuneTab===tab?col:"#3A5070",transition:"color .15s"}}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{overflowY:"auto",flex:1,padding:"14px 18px"}}>

              {/* ── Preset selector ── */}
              <div style={{marginBottom:16,display:tuneTab==="presets"?"block":"none"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#4A7090",letterSpacing:3,marginBottom:8}}>SELECT PROFILE</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.entries(PRESETS).map(([key,p])=>(
                    <button key={key} onClick={()=>{
                      setActivePreset(key);
                      if (key!=="CUSTOM") setCustomConfig({...p});
                    }} style={{padding:"6px 12px",borderRadius:4,cursor:"pointer",
                      fontFamily:"Courier New, monospace",fontSize:9,letterSpacing:1,
                      border:`1px solid ${key===activePreset?p.color:"#1A3050"}`,
                      background:key===activePreset?`${p.color}18`:"transparent",
                      color:key===activePreset?p.color:"#3A5870",transition:"all .15s"}}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2A4060",marginTop:6}}>
                  {PRESETS[activePreset]?.description}
                </div>
              </div>

              {/* ── Feature toggles ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#4A7090",letterSpacing:3,marginBottom:8}}>
                  FEATURE TOGGLES · κ=0.444 &amp; RESONANCE_ANCHOR ALWAYS ON
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[
                    ["Kalman Filter",       featKalman,    setFeatKalman,    "#1EAAAA","Without: raw score used directly"],
                    ["GARCH Variance",      featGARCH,     setFeatGARCH,     "#E8A030","Without: simple window variance"],
                    ["SDE Drift Bands",     featSDE,       setFeatSDE,       "#4A9EFF","Without: drift threshold = 0.45"],
                    ["RAG Memory",          featRAG,       setFeatRAG,       "#8888FF","Without: no context retrieval"],
                    ["Pipe Injection",      featPipe,      setFeatPipe,      "#1EAAAA","Without: no telemetry in prompt"],
                    ["Mute Mode",           featMute,      setFeatMute,      "#E8A030","Without: no token cap on planning phrases"],
                    ["Drift Gate",          featGate,      setFeatGate,      "#E05060","Without: no word limit on high variance"],
                    ["B-Signal Detection",  featBSig,      setFeatBSig,      "#8888FF","Without: behavioral flags suppressed"],
                    ["H-Signal Detection",  featHSig,      setFeatHSig,      "#E8A030","Without: hallucination flags suppressed"],
                    ["Context Pruning",     featPrune,     setFeatPrune,     "#40D080","Without: full context always sent"],
                    ["Zero-Drift Display",  featZeroDrift, setFeatZeroDrift, "#C8860A","Without: lock panel hidden"],
                  ].map(([label,val,setter,col,note])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:8,
                      padding:"6px 10px",borderRadius:4,
                      background:val?"#0A1A0A":"#0A0A0A",
                      border:`1px solid ${val?col+"44":"#1A2030"}`}}>
                      <button onClick={()=>setter(p=>!p)} style={{
                        width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                        background:val?col:"#2A3040",transition:"background .2s",flexShrink:0}}>
                        <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                          margin:"2px",marginLeft:val?14:2,transition:"margin .2s"}}/>
                      </button>
                      <div>
                        <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                          color:val?col:"#3A5070",letterSpacing:1}}>{label}</div>
                        <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                          color:"#2A3848",lineHeight:1.3}}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Hudson Constants — adjustable with disclaimer ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#E8A030",letterSpacing:3,marginBottom:8}}>
                  HUDSON CONSTANTS — ADVANCED
                </div>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#E8A030",marginBottom:10,padding:"6px 10px",
                  background:"#0A0800",borderRadius:3,border:"1px solid #E8A03044",
                  lineHeight:1.7}}>
                  ⚠ These are the framework identity constants. Changing them alters
                  the mathematical foundation of the Drift Law. Results with modified
                  values are not validated and may not reflect the published framework.
                  This tool is in R&amp;D — all outputs are proxy indicators only.
                  No warranty. Use for experimental testing only.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    ["κ (kappa)","0.444 — Hudson Constant. Drives damping, SDE, Kalman.",
                     userKappa,setUserKappa,0.10,2.00,0.001,KAPPA],
                    ["RESONANCE_ANCHOR","623.81 Hz — Zero-Drift Lock target frequency.",
                     userAnchor,setUserAnchor,100,2000,0.01,RESONANCE_ANCHOR],
                  ].map(([label,note,val,setter,min,max,step,def])=>(
                    <div key={label} style={{padding:"8px 10px",borderRadius:4,
                      background:val!==def?"#0A0800":"#0A0E18",
                      border:`1px solid ${val!==def?"#E8A03044":"#1A2840"}`}}>
                      <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:val!==def?"#E8A030":"#4A6880",marginBottom:4,letterSpacing:1}}>
                        {label}{val!==def?" ⚠ MODIFIED":""}
                      </div>
                      <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                        color:"#2A3848",marginBottom:6,lineHeight:1.4}}>{note}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <input type="number" min={min} max={max} step={step}
                          value={val}
                          onChange={e=>setter(+e.target.value)}
                          style={{flex:1,background:"#0A1020",border:`1px solid ${val!==def?"#E8A03066":"#1A3050"}`,
                            borderRadius:3,color:val!==def?"#E8A030":"#7AB8D8",
                            padding:"3px 8px",fontFamily:"Courier New, monospace",fontSize:10}}/>
                        <button onClick={()=>setter(def)}
                          style={{padding:"3px 8px",background:"transparent",
                            border:"1px solid #2A4060",borderRadius:3,color:"#4A6880",
                            cursor:"pointer",fontSize:7,fontFamily:"Courier New, monospace"}}>
                          RESET
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {activePreset==="CUSTOM"&&(
                <div style={{borderTop:"1px solid #1A3050",paddingTop:12,display:tuneTab==="presets"?"block":"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:10}}>
                    <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                      color:"#40D080",letterSpacing:3}}>CUSTOM PARAMETERS</div>
                    <button onClick={()=>setCustomConfig({...PRESETS.DEFAULT})}
                      style={{padding:"3px 10px",background:"transparent",
                        border:"1px solid #2A4060",borderRadius:3,color:"#4A6880",
                        cursor:"pointer",fontSize:8,fontFamily:"Courier New, monospace"}}>
                      RESET TO DEFAULT
                    </button>
                  </div>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                    color:"#E05060",marginBottom:10,padding:"4px 8px",
                    background:"#150808",borderRadius:3,border:"1px solid #E0506033"}}>
                    ⚠ κ=0.444 (Hudson Constant) and RESONANCE_ANCHOR=623.81 are not
                    editable here. They are the framework identity.
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      ["Var Decoherence",    "varDecoherence",    0.05,  0.50,  0.005],
                      ["Var Caution",        "varCaution",        0.03,  0.30,  0.005],
                      ["Var Calm",           "varCalm",           0.02,  0.15,  0.005],
                      ["LOCK_888 Streak",    "lock888Streak",     2,     10,    1    ],
                      ["LOCK_888 Avg C Floor","lock888AvgCFloor", 0.40,  0.95,  0.01 ],
                      ["Gate Word Limit",    "driftGateWordLimit",40,    500,   10   ],
                      ["Mute Max Tokens",    "muteMaxTokens",     40,    500,   10   ],
                      ["GARCH ω",            "garchOmega",        0.001, 0.10,  0.001],
                      ["GARCH α",            "garchAlpha",        0.01,  0.50,  0.01 ],
                      ["GARCH β",            "garchBeta",         0.30,  0.98,  0.01 ],
                      ["SDE α",              "sdeAlpha",         -0.80,  -0.05, 0.01 ],
                      ["SDE β_p",            "sdeBetaP",          0.05,  0.50,  0.01 ],
                      ["SDE σ",              "sdeSigma",          0.03,  0.40,  0.005],
                      ["Prune Threshold",    "pruneThreshold",    3,     20,    1    ],
                      ["Prune Keep",         "pruneKeep",         2,     10,    1    ],
                      ["Escalate→Moderate",  "driftEscalateMod",  1,     10,    1    ],
                      ["Escalate→Deep",      "driftEscalateDeep", 2,     15,    1    ],
                      ["Escalate→Extreme",   "driftEscalateExtreme",3,   20,    1    ],
                      ["Health: Drift -wt",   "healthDriftWeight",    1,   20,    1    ],
                      ["Health: B-Sig -wt",   "healthBSigWeight",     1,   15,    1    ],
                      ["Health: H-Sig -wt",   "healthHSigWeight",     1,   15,    1    ],
                    ].map(([label,key,min,max,step])=>(
                      <div key={key} style={{display:"flex",alignItems:"center",
                        justifyContent:"space-between",gap:8,
                        padding:"4px 0",borderBottom:"1px solid #0E1820"}}>
                        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                          color:"#4A6880",flex:1}}>{label}</span>
                        <input type="number" min={min} max={max} step={step}
                          value={customConfig[key]??0}
                          onChange={e=>setCustomConfig(p=>({...p,[key]:+e.target.value}))}
                          style={{width:72,background:"#0A1020",border:"1px solid #1A3050",
                            borderRadius:3,color:"#40D080",padding:"2px 6px",
                            fontFamily:"Courier New, monospace",fontSize:9,textAlign:"right"}}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── V1.5.0: SDE Path Count ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#4A7090",letterSpacing:3,marginBottom:8}}>SDE SIMULATION PATHS</div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <select value={nPaths} onChange={e=>{
                    const v=+e.target.value;
                    if(v===-1) return; // custom handled below
                    setNPaths(v);
                  }} style={{background:"#0A1020",border:"1px solid #1A3050",
                    borderRadius:3,color:"#7AB8D8",padding:"4px 8px",
                    fontFamily:"Courier New, monospace",fontSize:9}}>
                    {[5,10,20,25,50,100,200,250,300,500].map(n=>(
                      <option key={n} value={n}>{n} paths{n===50?" (default)":n===300?" (original)":""}</option>
                    ))}
                  </select>
                  <input type="number" min="1" max="1000"
                    value={nPaths} onChange={e=>{
                      const v=Math.max(1,Math.min(1000,+e.target.value));
                      if(v>500){
                        // warn about token burn
                      }
                      setNPaths(v);
                    }}
                    style={{width:72,background:"#0A1020",border:`1px solid ${nPaths>500?"#E0506066":"#1A3050"}`,
                      borderRadius:3,color:nPaths>500?"#E05060":"#7AB8D8",padding:"3px 6px",
                      fontFamily:"Courier New, monospace",fontSize:9,textAlign:"center"}}/>
                  <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2A4060"}}>
                    manual (1–1000)
                  </span>
                </div>
                {nPaths>500&&(
                  <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#E05060",marginTop:6,padding:"4px 8px",
                    background:"#150808",borderRadius:3,border:"1px solid #E0506033"}}>
                    ⚠ {nPaths} paths will significantly increase token usage and compute time per turn.
                    Above 300 gives diminishing returns on band accuracy.
                    Recommended max for daily use: 200.
                  </div>
                )}
                {nPaths>200&&nPaths<=500&&(
                  <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#E8A030",marginTop:4}}>
                    △ High path count — expect slower chart updates and higher token usage.
                  </div>
                )}
                <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                  color:"#2A4060",marginTop:4}}>
                  Default 50. More paths = sharper SDE bands. Stored across sessions.
                </div>
              </div>

              {/* ── SDE Parameter Controls ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#4A7090",letterSpacing:3}}>SDE PARAMETERS</div>
                  <button onClick={()=>{setSdeAlphaVal(SDE_PARAMS.alpha);setSdeBetaVal(SDE_PARAMS.beta_p);setSdeSigmaVal(SDE_PARAMS.sigma);setSdeAlphaOn(true);setSdeBetaOn(true);setSdeSigmaOn(true);}}
                    style={{padding:"2px 8px",background:"transparent",border:"1px solid #2A4060",
                      borderRadius:3,color:"#4A6880",cursor:"pointer",fontSize:7,fontFamily:"Courier New, monospace"}}>RESET</button>
                </div>
                <div style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#E05060",
                  marginBottom:8,padding:"3px 8px",background:"#150808",borderRadius:3,border:"1px solid #E0506033"}}>
                  κ=0.444 locked. ω=2π/12 locked. α, β_p, σ are tunable.
                </div>
                {[
                  ["α (mean-revert)", sdeAlphaVal, setSdeAlphaVal, sdeAlphaOn, setSdeAlphaOn, -0.80,-0.05,0.01,"#E05060"],
                  ["β_p (forcing)",   sdeBetaVal,  setSdeBetaVal,  sdeBetaOn,  setSdeBetaOn,  0.01, 0.60, 0.01,"#E8A030"],
                  ["σ (diffusion)",   sdeSigmaVal, setSdeSigmaVal, sdeSigmaOn, setSdeSigmaOn, 0.01, 0.50, 0.005,"#4A9EFF"],
                ].map(([label,val,setter,on,setOn,min,max,step,col])=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"6px 8px",borderRadius:4,marginBottom:4,
                    background:on?"#0A0E18":"#080A10",border:`1px solid ${on?col+"44":"#1A2030"}`}}>
                    <button onClick={()=>setOn(p=>!p)} style={{
                      width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                      background:on?col:"#2A3040",transition:"background .2s",flexShrink:0}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                        margin:"2px",marginLeft:on?14:2,transition:"margin .2s"}}/>
                    </button>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:on?col:"#3A5070",flex:1}}>{label}</span>
                    <input type="number" min={min} max={max} step={step} value={val}
                      onChange={e=>setter(+e.target.value)} disabled={!on}
                      style={{width:64,background:"#060A10",border:`1px solid ${on?col+"66":"#1A2030"}`,
                        borderRadius:3,color:on?col:"#2A3040",padding:"2px 5px",
                        fontFamily:"Courier New, monospace",fontSize:9,textAlign:"right"}}/>
                  </div>
                ))}
              </div>

              {/* ── V1.5.0: Post-Audit Toggle ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#4A7090",letterSpacing:3,marginBottom:8}}>POST-AUDIT</div>
                <div style={{display:"flex",gap:6}}>
                  {[
                    ["off",    "OFF",    "#3A5070","No second pass"],
                    ["light",  "LIGHT",  "#E8A030","Kalman < 0.70"],
                    ["custom", "CUSTOM", "#C8860A","Custom threshold"],
                    ["full",   "FULL",   "#1EAAAA","Every turn"],
                  ].map(([val,label,col,desc])=>(
                    <button key={val} onClick={()=>setPostAuditMode(val)} style={{
                      padding:"5px 12px",borderRadius:4,cursor:"pointer",
                      fontFamily:"Courier New, monospace",fontSize:8,letterSpacing:1,
                      border:`1px solid ${postAuditMode===val?col:"#1A3050"}`,
                      background:postAuditMode===val?`${col}18`:"transparent",
                      color:postAuditMode===val?col:"#3A5070",transition:"all .15s"}}>
                      {label}
                    </button>
                  ))}
                </div>
                {postAuditMode==="custom"&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#C8860A"}}>
                      Fire when Kalman x&#x302; &lt;
                    </span>
                    <input type="number" min="0.30" max="0.95" step="0.01"
                      value={postAuditThresh}
                      onChange={e=>setPostAuditThresh(+e.target.value)}
                      style={{width:60,background:"#0A1020",border:"1px solid #C8860A44",
                        borderRadius:3,color:"#C8860A",padding:"3px 6px",
                        fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2A4060"}}>
                      (default 0.70)
                    </span>
                  </div>
                )}
                <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                  color:"#2A4060",marginTop:5,lineHeight:1.6}}>
                  Recomputes coherence on final response. Logs delta vs live score.
                  Quiet fail = post-audit C drops &gt;0.08 below live C.
                  Light/Custom ~5% tokens. Full ~10%.
                </div>
              </div>

              {/* ── V1.5.0: Mute Phrase Editor ── */}
              <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                    color:"#4A7090",letterSpacing:3}}>MUTE PHRASES</div>
                  <button onClick={()=>setCustomMutePhrases(null)}
                    style={{padding:"2px 8px",background:"transparent",
                      border:"1px solid #2A4060",borderRadius:3,color:"#4A6880",
                      cursor:"pointer",fontSize:7,fontFamily:"Courier New, monospace"}}>
                    RESET TO DEFAULT
                  </button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {(customMutePhrases??MUTE_PHRASES).map((phrase,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:3,
                      padding:"2px 8px",borderRadius:3,
                      background:"#0A1020",border:"1px solid #1A3050"}}>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#4A9EFF"}}>{phrase.trim()}</span>
                      <button onClick={()=>{
                        const cur=customMutePhrases??MUTE_PHRASES;
                        setCustomMutePhrases(cur.filter((_,j)=>j!==i));
                      }} style={{background:"none",border:"none",cursor:"pointer",
                        color:"#3A5070",fontSize:10,padding:0,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <input value={mutePhraseInput}
                    onChange={e=>setMutePhraseInput(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==="Enter"&&mutePhraseInput.trim()){
                        const cur=customMutePhrases??MUTE_PHRASES;
                        setCustomMutePhrases([...cur,mutePhraseInput.toLowerCase().trimEnd()+" "]);
                        setMutePhraseInput("");
                      }
                    }}
                    placeholder="add phrase (press Enter)"
                    style={{flex:1,background:"#0A1020",border:"1px solid #1A3050",
                      borderRadius:3,color:"#7AB8D8",padding:"3px 8px",
                      fontFamily:"Courier New, monospace",fontSize:9,outline:"none"}}/>
                  <button onClick={()=>{
                    if(!mutePhraseInput.trim()) return;
                    const cur=customMutePhrases??MUTE_PHRASES;
                    setCustomMutePhrases([...cur,mutePhraseInput.toLowerCase().trimEnd()+" "]);
                    setMutePhraseInput("");
                  }} style={{padding:"3px 10px",background:"#0A1020",
                    border:"1px solid #4A9EFF44",borderRadius:3,color:"#4A9EFF",
                    cursor:"pointer",fontSize:8,fontFamily:"Courier New, monospace"}}>
                    ADD
                  </button>
                </div>
              </div>
            </div>

            {/* ── MATH TAB — editable math tunables ── */}
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="math"?"block":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#1EAAAA",letterSpacing:3}}>
                  MATH TUNABLES
                </div>
                <button onClick={()=>{
                  setMathTfidf(0.25);setMathJsd(0.25);setMathLen(0.25);
                  setMathStruct(0.15);setMathPersist(0.10);setMathRepThresh(0.65);
                  setMathKalmanR(KALMAN_R);setMathKalmanSigP(KALMAN_SIGMA_P);
                  setMathRagTopK(RAG_TOP_K);setMathMaxTokens(NORMAL_MAX_TOKENS);
                }} style={{padding:"2px 8px",background:"transparent",
                  border:"1px solid #2A4060",borderRadius:3,color:"#4A6880",
                  cursor:"pointer",fontSize:7,fontFamily:"Courier New,monospace"}}>
                  RESET ALL
                </button>
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#E8A030",
                marginBottom:10,padding:"4px 8px",background:"#0A0800",borderRadius:3,
                border:"1px solid #E8A03033",lineHeight:1.6}}>
                Coherence weights should sum to 1.0. Changes apply immediately to next turn.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  ["TF-IDF weight",   mathTfidf,   setMathTfidf,   0.01,0.80,0.01,"#1EAAAA"],
                  ["JSD weight",      mathJsd,     setMathJsd,     0.01,0.80,0.01,"#1EAAAA"],
                  ["Length weight",   mathLen,     setMathLen,     0.01,0.80,0.01,"#1EAAAA"],
                  ["Structure wt",    mathStruct,  setMathStruct,  0.01,0.50,0.01,"#1EAAAA"],
                  ["Persistence wt",  mathPersist, setMathPersist, 0.01,0.50,0.01,"#1EAAAA"],
                  ["Rep threshold",   mathRepThresh,setMathRepThresh,0.30,0.95,0.01,"#E8A030"],
                  ["Kalman R",        mathKalmanR, setMathKalmanR, 0.001,0.20,0.001,"#4A9EFF"],
                  ["Kalman σP",       mathKalmanSigP,setMathKalmanSigP,0.01,0.30,0.005,"#4A9EFF"],
                  ["RAG top-K",       mathRagTopK, setMathRagTopK, 1,10,1,"#8888FF"],
                  ["Max tokens",      mathMaxTokens,setMathMaxTokens,200,4000,100,"#40D080"],
                ].map(([label,val,setter,min,max,step,col])=>(
                  <div key={label} style={{padding:"5px 8px",borderRadius:4,
                    background:"#0A0E18",border:"1px solid #1A2840"}}>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:7,
                      color:"#4A6880",marginBottom:4}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input type="number" min={min} max={max} step={step}
                        value={val}
                        onChange={e=>setter(+e.target.value)}
                        style={{flex:1,background:"#060A10",border:`1px solid ${col}44`,
                          borderRadius:3,color:col,padding:"2px 5px",
                          fontFamily:"Courier New,monospace",fontSize:9,textAlign:"right"}}/>
                      <button onClick={()=>setter(val)} title="default"
                        style={{padding:"1px 5px",background:"transparent",
                          border:"1px solid #1A2840",borderRadius:2,
                          color:"#2A4060",cursor:"pointer",fontSize:7,
                          fontFamily:"Courier New,monospace"}}>↺</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,
                color:"#2A4060",marginTop:8,lineHeight:1.6}}>
                ε ghost tax floor: {EPSILON} (framework constant — not tunable)<br/>
                Mute max tokens: {MUTE_MAX_TOKENS} (set per preset in PRESETS tab)
              </div>
            </div>

            {/* ── DISPLAY TAB ── */}
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="display"?"block":"none"}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#C8860A",letterSpacing:3,marginBottom:12}}>
                DISPLAY
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2A4060",marginBottom:16,lineHeight:1.6,
                padding:"6px 10px",background:"#0A1020",borderRadius:3,border:"1px solid #1A3050"}}>
                Theme toggle and sidebar resize coming in a future build.
                Framework is dark-mode first by design — 623.81 Hz resonance
                anchor is optimized for low-light reading environments.
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2A4060",lineHeight:1.8}}>
                Current layout: 55% chat · 45% metrics<br/>
                Font: Trebuchet MS (body) · Courier New (data)<br/>
                Background: #06090F · Accent: #1EAAAA<br/>
                κ color: #C8860A · Health green: #40D080
              </div>
            </div>

            {/* Footer */}
            <div style={{padding:"8px 18px",borderTop:"1px solid #1A3050",
              background:"#060A10",flexShrink:0,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#2A4060",letterSpacing:1}}>
                ACTIVE: {PRESETS[activePreset]?.label??activePreset} · κ={userKappa.toFixed(4)} · V1.5.2
              </span>
              <button onClick={()=>setShowTuning(false)}
                style={{padding:"4px 14px",background:"#0A1A0A",
                  border:"1px solid #40D08044",borderRadius:4,color:"#40D080",
                  cursor:"pointer",fontSize:9,fontFamily:"Courier New, monospace"}}>
                APPLY &amp; CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REWIND CONFIRM MODAL */}
      {rewindConfirm!==null&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.80)",zIndex:900,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setRewindConfirm(null)}>
          <div style={{background:"#080C14",border:"2px solid #40D080",
            borderRadius:8,padding:24,maxWidth:320,width:"100%",textAlign:"center"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"Courier New, monospace",fontSize:12,
              color:"#40D080",letterSpacing:2,marginBottom:12}}>
              ⟲ REWIND TO TURN {rewindConfirm}?
            </div>
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,
              color:"#4A6880",marginBottom:20,lineHeight:1.7}}>
              Session will restore to the state after Turn {rewindConfirm}.
              You can continue from here or navigate forward with the arrow buttons.
            </div>
            <div style={{display:"flex",gap:12,justifyContent:"center"}}>
              <button onClick={()=>restoreToTurn(rewindConfirm)}
                style={{padding:"10px 24px",background:"#0A2A0A",
                  border:"2px solid #40D080",borderRadius:6,color:"#40D080",
                  cursor:"pointer",fontSize:12,fontFamily:"Courier New, monospace",
                  fontWeight:"bold",letterSpacing:1}}>
                CONFIRM
              </button>
              <button onClick={()=>setRewindConfirm(null)}
                style={{padding:"10px 24px",background:"transparent",
                  border:"1px solid #2A4060",borderRadius:6,color:"#4A6880",
                  cursor:"pointer",fontSize:12,fontFamily:"Courier New, monospace",
                  letterSpacing:1}}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG MODAL */}
      {showLog&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setShowLog(false)}>
          <div style={{background:"#080C14",border:"1px solid #1E4060",
            borderRadius:8,maxWidth:680,width:"100%",maxHeight:"85vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"12px 18px",
              borderBottom:"1px solid #1A3050",background:"#060A10",flexShrink:0}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:11,
                color:"#4A9EFF",letterSpacing:2,fontWeight:"bold"}}>
                ARCHITECT — {eventLog.length} EVENTS{errorLog.length>0?` · ⚠ ${errorLog.length} DIAGNOSTICS`:""}
              </span>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setExportContent(downloadLog(eventLog,sessionId))}
                  style={{background:"none",border:"1px solid #4A9EFF44",borderRadius:4,
                    color:"#4A9EFF",cursor:"pointer",fontSize:10,padding:"2px 10px",
                    fontFamily:"Courier New, monospace"}}>
                  DOWNLOAD
                </button>
                <button onClick={()=>setShowLog(false)}
                  style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
                    color:"#4A6880",cursor:"pointer",fontSize:12,padding:"2px 10px",
                    fontFamily:"Courier New, monospace"}}>
                  ✕ CLOSE
                </button>
              </div>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {/* Error entries first, in red */}
              {errorLog.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:9,
                    color:"#E05060",letterSpacing:2,marginBottom:8,
                    borderBottom:"1px solid #E0506033",paddingBottom:4,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>⚠ ARCHITECT DIAGNOSTICS ({errorLog.length})</span>
                    <button onClick={()=>{
                      const txt=[...errorLog].reverse().map(e=>[
                        `[${e.severity?.toUpperCase()||"ERROR"}] ${e.timestamp} T${e.turn||"?"}`,
                        `Stage: ${e.stage}`,
                        `Message: ${e.message}`,
                        e.source?`Source: ${e.source}`:"",
                        e.hint?`Hint: ${e.hint}`:"",
                        e.fallback?`Fallback: ${e.fallback}`:"",
                        e.inputs?`Inputs: ${JSON.stringify(e.inputs)}`:"",
                        e.session?`Session: ${JSON.stringify(e.session)}`:"",
                        e.stack?`Stack:\n${e.stack}`:"",
                        "─".repeat(60),
                      ].filter(Boolean).join("\n")).join("\n");
                      navigator.clipboard.writeText(txt);
                    }} style={{padding:"2px 8px",background:"transparent",
                      border:"1px solid #E0506044",borderRadius:3,
                      color:"#E05060",cursor:"pointer",
                      fontSize:7,fontFamily:"Courier New, monospace"}}>
                      COPY ALL ERRORS
                    </button>
                  </div>
                  {[...errorLog].reverse().map((e,i)=>{
                    const sevColor=e.severity==="fatal"?"#FF4444"
                      :e.severity==="error"?"#E05060"
                      :e.severity==="warn"?"#E8A030"
                      :"#4A9EFF";
                    return (
                      <div key={i} style={{padding:"10px 12px",marginBottom:8,
                        background:"#0E0808",borderRadius:4,
                        borderLeft:`3px solid ${sevColor}`}}>
                        {/* Header row */}
                        <div style={{display:"flex",justifyContent:"space-between",
                          alignItems:"center",marginBottom:6}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                              color:sevColor,letterSpacing:1,fontWeight:"bold",
                              padding:"1px 6px",border:`1px solid ${sevColor}44`,
                              borderRadius:3,background:`${sevColor}11`}}>
                              {e.severity?.toUpperCase()||"ERROR"}
                            </span>
                            <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                              color:sevColor,letterSpacing:1,fontWeight:"bold"}}>
                              {e.stage?.toUpperCase().split("_").join(" ")||"UNKNOWN"}
                            </span>
                          </div>
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#3A5070"}}>
                            T{e.turn||"?"} · {e.timestamp?.slice(11,19)||""}
                          </span>
                        </div>
                        {/* Message */}
                        <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                          color:"#C05050",lineHeight:1.6,marginBottom:4}}>
                          {e.message}
                        </div>
                        {/* Hint — plain language fix suggestion */}
                        {e.hint&&(
                          <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                            color:"#E8A030",lineHeight:1.5,marginBottom:4,
                            padding:"3px 6px",background:"#0A0800",borderRadius:2}}>
                            💡 {e.hint}
                          </div>
                        )}
                        {/* Source line */}
                        {e.source&&e.source!=="unknown"&&(
                          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                            color:"#4A6080",marginBottom:4}}>
                            at {e.source}
                          </div>
                        )}
                        {/* Inputs snapshot */}
                        {e.inputs&&Object.keys(e.inputs).length>0&&(
                          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                            color:"#2A4050",marginBottom:4,lineHeight:1.6}}>
                            inputs: {Object.entries(e.inputs).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(" · ")}
                          </div>
                        )}
                        {/* Session state */}
                        {e.session&&(
                          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                            color:"#2A4050",marginBottom:4,lineHeight:1.6}}>
                            mode:{e.session.harnessMode} · drift:{e.session.driftCount} · σ²:{e.session.smoothedVar?.toFixed(4)??"—"} · calm:{e.session.calmStreak??"—"}
                          </div>
                        )}
                        {/* Fallback note */}
                        {e.fallback&&(
                          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                            color:"#40D08088",marginBottom:4}}>
                            ↳ {e.fallback}
                          </div>
                        )}
                        {/* Stack trace */}
                        {e.stack&&(
                          <details>
                            <summary style={{fontFamily:"Courier New, monospace",
                              fontSize:7,color:"#3A5070",cursor:"pointer",
                              marginTop:4,userSelect:"none"}}>
                              stack trace ▾
                            </summary>
                            <pre style={{fontFamily:"Courier New, monospace",fontSize:7,
                              color:"#2A4060",margin:"4px 0 0",
                              whiteSpace:"pre-wrap",wordBreak:"break-all",
                              background:"#080C14",padding:"6px 8px",borderRadius:3,
                              lineHeight:1.6}}>
                              {e.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Standard event entries */}
              {eventLog.length===0&&errorLog.length===0?(
                <div style={{fontFamily:"Courier New, monospace",fontSize:10,
                  color:"#2A4060",textAlign:"center",padding:"20px"}}>
                  No events logged yet.
                </div>
              ):([...eventLog].reverse().map((e,i)=>{
                const typeColor=e.type==="probable_hallucination_signal"?"#E8A030"
                  :e.type==="behavioral_signal"?"#8888FF"
                  :e.type==="decoherence_alert"?"#E05060"
                  :e.type==="LOCK_888"?"#8888FF"
                  :e.type==="calm_streak"?"#40D080"
                  :"#4A9EFF";
                return (
                  <div key={i} style={{padding:"8px 10px",marginBottom:6,
                    background:"#0A1020",borderRadius:4,
                    borderLeft:`3px solid ${typeColor}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",
                      alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                        color:typeColor,letterSpacing:1,fontWeight:"bold"}}>
                        {e.type.toUpperCase().split("_").join(" ")}
                      </span>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#2A4060"}}>
                        T{e.turn||"?"} · {e.timestamp?.slice(11,19)||""}
                      </span>
                    </div>
                    {e.note&&<div style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:"#4A6880",lineHeight:1.5}}>{e.note}</div>}
                    {e.detail&&<div style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:"#4A7090",lineHeight:1.5,marginTop:2}}>{e.detail}</div>}
                    {e.signals&&Array.isArray(e.signals)&&(
                      <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#6A8090",lineHeight:1.5,marginTop:2}}>
                        {e.signals.join(" · ")}
                      </div>
                    )}
                    {e.coherence_score!=null&&(
                      <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#3A5870",marginTop:2}}>
                        C={e.coherence_score.toFixed(3)}
                      </div>
                    )}
                    {(e.type==="probable_hallucination_signal"||e.type==="behavioral_signal")&&(
                      <div style={{marginTop:4}}>
                        {corrections.some(x=>x.turn===e.turn&&x.type===e.type)
                          ? <span style={{fontFamily:"Courier New, monospace",fontSize:7,
                              color:"#40D080",letterSpacing:1}}>✓ MARKED FALSE +</span>
                          : <button onClick={()=>{
                              const entry={turn:e.turn,type:e.type,
                                timestamp:new Date().toISOString(),
                                signal_detail:e.detail||e.signals?.join(' | ')||''};
                              setCorrections(p=>[...p,entry]);
                              setEventLog(p=>[...p,{
                                timestamp:entry.timestamp,turn:e.turn,
                                type:"false_positive_correction",
                                corrected_type:e.type,
                                note:"User marked as false positive",
                              }]);
                            }} style={{padding:"2px 8px",background:"transparent",
                              border:"1px solid #40D08044",borderRadius:3,
                              color:"#40D080",cursor:"pointer",fontSize:7,
                              fontFamily:"Courier New, monospace",letterSpacing:1}}>
                              FALSE +
                            </button>
                        }
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      )}

      {/* BOOKMARKS MODAL */}
      {showBookmarks&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setShowBookmarks(false)}>
          <div style={{background:"#080C14",border:"1px solid #C8860A44",
            borderRadius:8,maxWidth:720,width:"100%",maxHeight:"88vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"12px 18px",
              borderBottom:"1px solid #2A2010",background:"#060A10",flexShrink:0}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:11,
                color:"#C8860A",letterSpacing:2,fontWeight:"bold"}}>
                ★ SAVED TURNS — {bookmarks.length}
              </span>
              <button onClick={()=>setShowBookmarks(false)}
                style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
                  color:"#4A6880",cursor:"pointer",fontSize:12,padding:"2px 10px",
                  fontFamily:"Courier New, monospace"}}>
                ✕ CLOSE
              </button>
            </div>
            {/* Body */}
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {bookmarks.length===0?(
                <div style={{fontFamily:"Courier New, monospace",fontSize:10,
                  color:"#2A4060",textAlign:"center",padding:"20px"}}>
                  No bookmarks yet. Click ☆ on any assistant turn to save it.
                </div>
              ):bookmarks.map((bk,i)=>{
                const m=bk.metrics;
                const scoreColor=m.raw==null?"#3A5870":m.raw>.80?"#40D080":m.raw>.65?"#E8A030":"#E05060";
                return (
                  <div key={bk.id} style={{marginBottom:16,borderRadius:6,
                    background:"#0A0E18",border:"1px solid #1A2840",overflow:"hidden"}}>
                    {/* Turn header */}
                    <div style={{display:"flex",justifyContent:"space-between",
                      alignItems:"center",padding:"7px 12px",
                      background:"#0D1422",borderBottom:"1px solid #1A2840"}}>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                        color:"#C8860A",letterSpacing:2,fontWeight:"bold"}}>
                        ★ TURN {bk.turn}
                      </span>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {m.raw!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                            padding:"1px 6px",borderRadius:3,
                            background:m.raw>.80?"#0A2A1A":m.raw>.65?"#2A1A00":"#2A0A0A",
                            color:scoreColor,border:`1px solid ${scoreColor}33`}}>
                            C={m.raw.toFixed(3)}
                          </span>
                        )}
                        {m.kalman!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2A4060"}}>
                            K={m.kalman.toFixed(3)}
                          </span>
                        )}
                        {m.smoothedVar!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            color:m.smoothedVar>VAR_DECOHERENCE?"#E05060"
                              :m.smoothedVar>VAR_CAUTION?"#E8A030"
                              :m.smoothedVar<VAR_CALM?"#40D080":"#7AB8D8"}}>
                            σ²={m.smoothedVar.toFixed(4)}
                          </span>
                        )}
                        {m.harnessActive&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:"#2A0A0A",color:"#E05060",border:"1px solid #E0506033"}}>
                            ⚠ DRIFT
                          </span>
                        )}
                        {m.hallucinationFlag&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:"#1A0A00",color:"#E8A030",border:"1px solid #E8A03033"}}
                            title={m.hallucinationSignals?.join(" | ")||""}>
                            ⚠ H-SIG
                          </span>
                        )}
                        {m.behavioralFlag&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:"#0A0A1A",color:"#8888FF",border:"1px solid #8888FF33"}}
                            title={m.behavioralSignals?.map(s=>s.type).join(" | ")||""}>
                            ⚠ B-SIG
                          </span>
                        )}
                        {m.sourceScore!=null&&(
                          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                            padding:"1px 5px",borderRadius:3,
                            background:m.sourceScore>0.15?"#0A2A1A":"#1A0808",
                            color:m.sourceScore>0.15?"#40D080":"#E05060",
                            border:`1px solid ${m.sourceScore>0.15?"#40D08033":"#E0506033"}`}}>
                            {m.sourceScore>0.15?"✓ SRC":"⚠ SRC"}
                          </span>
                        )}
                        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                          color:"#2A4060",
                          borderLeft:"1px solid #1A3050",paddingLeft:8}}>
                          {HARNESS_MODES[m.mode]?.label??m.mode?.toUpperCase()??"—"}
                        </span>
                        <button onClick={()=>toggleBookmark(bk.cohIdx)}
                          title="Remove bookmark"
                          style={{background:"none",border:"1px solid #C8860A33",
                            borderRadius:3,color:"#C8860A",cursor:"pointer",
                            fontSize:9,padding:"1px 6px",
                            fontFamily:"Courier New, monospace",opacity:0.7}}>
                          ★ REMOVE
                        </button>
                      </div>
                    </div>
                    {/* User prompt */}
                    <div style={{padding:"8px 12px",
                      borderBottom:"1px solid #1A2030",background:"#0A1020"}}>
                      <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#2A4060",letterSpacing:2,marginBottom:4}}>USER</div>
                      <div style={{fontFamily:"'Trebuchet MS', sans-serif",fontSize:12,
                        color:"#7A9EBA",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                        {bk.userText}
                      </div>
                    </div>
                    {/* Assistant response */}
                    <div style={{padding:"8px 12px"}}>
                      <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:"#2A4060",letterSpacing:2,marginBottom:4}}>ASSISTANT</div>
                      <div style={{fontFamily:"'Trebuchet MS', sans-serif",fontSize:12,
                        color:"#B8CDE0",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                        {bk.assistantText}
                      </div>
                    </div>
                    {/* V1.5.0: Annotation field */}
                    <div style={{padding:"6px 12px",borderTop:"1px solid #1A2030",
                      background:"#080A10"}}>
                      <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                        color:"#2A4060",letterSpacing:2,marginBottom:3}}>NOTE</div>
                      <input
                        value={bk.note||""}
                        onChange={e=>setBookmarks(p=>p.map(b=>b.id===bk.id?{...b,note:e.target.value}:b))}
                        placeholder="Add research note (e.g. example of topic hijack T7)…"
                        style={{width:"100%",background:"#0A1020",border:"1px solid #1A2840",
                          borderRadius:3,color:"#7AB8D8",padding:"4px 8px",
                          fontFamily:"'Trebuchet MS', sans-serif",fontSize:11,
                          outline:"none",boxSizing:"border-box"}}/>
                    </div>
                    {/* Signal detail if present */}
                    {(m.hallucinationSignals?.length>0||m.behavioralSignals?.length>0)&&(
                      <div style={{padding:"6px 12px",borderTop:"1px solid #1A2030",
                        background:"#080C14"}}>
                        {m.hallucinationSignals?.map((s,j)=>(
                          <div key={j} style={{fontFamily:"Courier New, monospace",fontSize:8,
                            color:"#E8A030",lineHeight:1.6}}>⚠ H: {s}</div>
                        ))}
                        {m.behavioralSignals?.map((s,j)=>(
                          <div key={j} style={{fontFamily:"Courier New, monospace",fontSize:8,
                            color:"#8888FF",lineHeight:1.6}}>⚠ B: {s.detail||s.type}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{padding:"8px 18px",borderTop:"1px solid #1A2010",
              background:"#060A10",flexShrink:0,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#2A4060",letterSpacing:1}}>
                {bookmarks.length} TURN{bookmarks.length!==1?"S":""} SAVED · CLICK ★ REMOVE TO UNSAVE
              </span>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#2A4060",letterSpacing:1}}>
                V1.5.2 © HUDSON &amp; PERRY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GUIDE MODAL */}
      {showGuide&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setShowGuide(false)}>
          <div style={{background:"#080C14",border:"1px solid #1E4060",
            borderRadius:8,maxWidth:680,width:"100%",maxHeight:"85vh",
            display:"flex",flexDirection:"column",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"12px 18px",
              borderBottom:"1px solid #1A3050",background:"#060A10",flexShrink:0}}>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setGuideTab("guide")}
                  style={{background:"none",border:`1px solid ${guideTab==="guide"?"#4A9EFF":"#2A4060"}`,
                    borderRadius:4,color:guideTab==="guide"?"#4A9EFF":"#4A6880",
                    cursor:"pointer",fontSize:10,padding:"3px 12px",
                    fontFamily:"Courier New, monospace",letterSpacing:1}}>
                  USER GUIDE
                </button>
                <button onClick={()=>setGuideTab("framework")}
                  style={{background:"none",border:`1px solid ${guideTab==="framework"?"#1EAAAA":"#2A4060"}`,
                    borderRadius:4,color:guideTab==="framework"?"#1EAAAA":"#4A6880",
                    cursor:"pointer",fontSize:10,padding:"3px 12px",
                    fontFamily:"Courier New, monospace",letterSpacing:1}}>
                  FRAMEWORK
                </button>
              </div>
              <button onClick={()=>setShowGuide(false)}
                style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
                  color:"#4A6880",cursor:"pointer",fontSize:12,padding:"2px 10px",
                  fontFamily:"Courier New, monospace"}}>
                ✕ CLOSE
              </button>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>
              <pre style={{fontFamily:"Courier New, monospace",fontSize:10,
                color:"#A8C4E0",lineHeight:1.9,margin:0,
                whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                {guideTab==="guide"?GUIDE_CONTENT:FRAMEWORK_CONTENT}
              </pre>
            </div>
            <div style={{padding:"10px 18px",borderTop:"1px solid #1A3050",
              background:"#060A10",flexShrink:0,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#2A4060",letterSpacing:1}}>
                © 2026 DAVID HUDSON &amp; DAVID PERRY
              </span>
              <div style={{display:"flex",gap:12}}>
                <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
                  style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#4A9EFF",textDecoration:"none",letterSpacing:1}}>
                  𝕏 @RaccoonStampede
                </a>
                <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
                  style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#4A9EFF",textDecoration:"none",letterSpacing:1}}>
                  𝕏 @Prosperous727
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
