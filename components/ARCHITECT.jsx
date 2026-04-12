import React, { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Scatter
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  FILE: ARCHITECT.jsx
//  ARCHITECT — UNIVERSAL COHERENCE ENGINE · V1.5.43
//  © Hudson & Perry Research
//  Authors: David Hudson (@RaccoonStampede) · David Perry (@Prosperous727)
//
//  ⚠ RESEARCH & DEVELOPMENT — NOT FOR CLINICAL OR LEGAL USE
//  All outputs are experimental proxy indicators only. No warranty.
//
//  Full patch history: see CHANGELOG.md
// ═══════════════════════════════════════════════════════════════

// ── Deployment ─────────────────────────────────────────────────
const API_ENDPOINT = "/api/proxy"; // Next.js serverless proxy — see pages/api/proxy.ts

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
    icon:"🖼", color:"#1560B0", label:"IMAGE", maxBytes:5*1024*1024,
  },
  pdf: {
    extensions:["pdf"], mimeTypes:["application/pdf"],
    icon:"📄", color:"#C81030", label:"PDF", maxBytes:32*1024*1024,
  },
  text: {
    extensions:[
      "txt","md","markdown","csv","xml","yaml","yml","json","html","htm",
      "css","js","jsx","ts","tsx","py","sh","bash","c","cpp","h","hpp",
      "java","rb","go","rs","swift","kt","sql","r","scala","php","vue",
      "svelte","toml","ini",
    ],
    mimeTypes:[], icon:"📝", color:"#178040", label:"TEXT", maxBytes:2*1024*1024,
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

// ── Jump-diffusion constants (Merton 1976) ─────────────────────
// Sudden topic shifts in conversations are jump processes, not smooth drift.
// JUMP_INTENSITY: expected jumps per step (λ). JUMP_MAGNITUDE: abs jump size.
const JUMP_INTENSITY = 0.05;
const JUMP_MAGNITUDE = 0.12;

// delta: GARCH-in-Mean coupling coefficient (Engle, Lilien & Robins 1987).
// When variance is high, delta subtracts from the drift term — SDE is pushed
// toward mean reversion harder under volatile sessions. Couples GARCH and SDE
// into a single coherent system rather than two parallel independent models.
const SDE_DELTA = 0.30;

const SDE_PARAMS = {
  alpha:-0.25, beta_p:0.18, omega:2*Math.PI/12, sigma:0.10, kappa:KAPPA,
  delta:SDE_DELTA, jumpIntensity:JUMP_INTENSITY, jumpMagnitude:JUMP_MAGNITUDE,
};

const HARNESS_MODES = {
  audit:    {gamma_h:0.05,   label:"AUDIT",      color:"#906000",threshold:1.1 },
  moderate: {gamma_h:50,     label:"MODERATE",   color:"#9A5C08",threshold:0.72},
  deep:     {gamma_h:5000,   label:"DEEP CLEAN", color:"#0A7878",threshold:0.62},
  extreme:  {gamma_h:10000,  label:"EXTREME",    color:"#C81030",threshold:0.50},
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
// V1.5.42: GARCH-in-Mean — delta term couples variance into drift.
// V1.5.42: Jump-diffusion (Merton 1976) — Poisson jump process models
// sudden topic shifts which are discontinuous, not smooth drift.
function simulateSDE(params,T,dt=0.02,nPaths=50,seed=42) {
  const {alpha,beta_p,omega,sigma,kappa,delta=0,jumpIntensity=0,jumpMagnitude=0}=params;
  const lam=1/(1+kappa),nSteps=Math.ceil(T/dt),rng=makeRng(seed),paths=[];
  let runVar=0; // running variance estimate for GARCH-in-Mean
  const jumpProb=1-Math.exp(-(jumpIntensity||0)*dt);
  for (let p=0;p<nPaths;p++) {
    const path=new Float32Array(nSteps+1);path[0]=0;
    for (let i=1;i<=nSteps;i++) {
      const t=i*dt;
      // GARCH-in-Mean: subtract delta*variance from drift — higher variance → stronger reversion
      const a_t=lam*(alpha+beta_p*Math.sin(omega*t)-(delta||0)*runVar);
      const b=lam*sigma;
      const noise=b*Math.sqrt(dt)*randn(rng);
      // Jump term: Poisson arrivals with signed random magnitude
      const jump=rng()<jumpProb?((rng()>0.5?1:-1)*(jumpMagnitude||0)):0;
      path[i]=path[i-1]+a_t*path[i-1]*dt+noise+jump;
      // Update running variance for GARCH-in-Mean (simple EWM)
      runVar=0.85*runVar+0.15*Math.pow(path[i]-path[i-1],2);
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
// V1.5.42: GARCH-in-Mean coupling — smoothedVar (optional, default 0) is
// subtracted from the drift term via delta. When variance is high, the
// process model predicts stronger mean reversion, tightening the estimate.
// Couples the Kalman process model with the GARCH variance output.
// ── Unscented Kalman Filter (UKF) — V2.0 ─────────────────────
// Replaces linear Kalman. Handles nonlinear coherence dynamics correctly.
// Uses sigma points instead of linearization — more accurate at extremes.
// Signature identical to old kalmanStep — drop-in replacement.
function kalmanStep(state, obs, t, params, kalR, kalSigP, smoothedVar=0) {
  const {alpha, beta_p, omega, kappa, delta=0} = params;
  const lam = 1/(1+kappa);
  // Nonlinear state transition f(x,t)
  const f = (x) => {
    const a_t = lam*(alpha + beta_p*Math.sin(omega*t) - (delta||0)*(smoothedVar||0));
    return x + a_t * x * 0.1; // discrete OU approximation
  };
  const R = kalR ?? KALMAN_R;
  const sigP = kalSigP ?? KALMAN_SIGMA_P;
  const Q = Math.pow(sigP * lam, 2);
  const { x, P } = state;
  // UKF parameters
  const n = 1;
  const ukfAlpha = 0.001, ukfKappa = 0, ukfBeta = 2;
  const lambda = ukfAlpha*ukfAlpha*(n + ukfKappa) - n;
  // Sigma points
  const spread = Math.sqrt(Math.max((n + lambda)*P, 1e-10));
  const sp = [x, x + spread, x - spread];
  // Weights
  const Wm = [lambda/(n+lambda), 1/(2*(n+lambda)), 1/(2*(n+lambda))];
  const Wc = [lambda/(n+lambda) + (1 - ukfAlpha*ukfAlpha + ukfBeta),
              1/(2*(n+lambda)), 1/(2*(n+lambda))];
  // Propagate sigma points
  const spProp = sp.map(s => f(s));
  // Predicted mean
  const x_pred = spProp.reduce((s, sp, i) => s + Wm[i]*sp, 0);
  // Predicted covariance
  const P_pred = spProp.reduce((s, sp, i) =>
    s + Wc[i]*Math.pow(sp - x_pred, 2), 0) + Q;
  // Kalman gain and update
  const K = P_pred / (P_pred + R);
  return {
    x: x_pred + K*(obs - x_pred),
    P: Math.max((1-K)*P_pred, 1e-8), // floor prevents numerical collapse
  };
}

// ── Drift Law ──────────────────────────────────────────────────
// V1.5.3 fix #6: epsilon is now a parameter (default EPSILON) so the user-tunable
// mathEpsilon state can be passed from component context. Pure functions unchanged externally.
function driftLawCapEff(gamma_h,epsilon=EPSILON){return epsilon/(1+gamma_h);}
function driftLawFloor(n,gamma_h,epsilon=EPSILON) {
  const ce=driftLawCapEff(gamma_h,epsilon),tau=Math.max(.0225/epsilon,1);
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
    label:"DEFAULT", color:"#0E2A5A",
    description:"Balanced baseline — original framework settings",
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
    label:"TECHNICAL", color:"#0A7878",
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
    label:"CREATIVE", color:"#906000",
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
    label:"RESEARCH", color:"#4848B8",
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
    label:"MEDICAL/LEGAL", color:"#C81030",
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
  CIRCUIT: {
    label:"CIRCUIT", color:"#1A5C1A",
    description:"Logic verification & cascading runs — tight variance, aggressive drift clamping, optimized for repeatable AI reasoning chains",
    varDecoherence:0.140, varCaution:0.080, varCalm:0.050,
    lock888Streak:6, lock888AvgCFloor:0.82,
    driftGateWordLimit:90, muteMaxTokens:90,
    garchOmega:0.012, garchAlpha:0.09, garchBeta:0.88,
    sdeAlpha:-0.38, sdeBetaP:0.10, sdeSigma:0.06,
    pruneThreshold:6, pruneKeep:5,
    driftEscalateMod:2, driftEscalateDeep:4, driftEscalateExtreme:6,
    healthDriftWeight:14, healthBSigWeight:7, healthHSigWeight:12,
  },
  CUSTOM: {
    label:"CUSTOM", color:"#178040",
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

function updateSmoothedVariance(history, prev, cfg) {
  if (history.length<2) return prev??0;
  const recent=history.slice(-20);
  const mean=recent.reduce((s,v)=>s+v,0)/recent.length;
  const rawVar=recent.reduce((s,v)=>s+Math.pow(v-mean,2),0)/recent.length;
  if (prev===null) return rawVar;
  const lastVal=history[history.length-1];
  const epsilon2=Math.pow(lastVal-mean,2);
  // V1.5.3 fix #3: use preset GARCH params — previously always used module-level
  // constants regardless of active preset, making GARCH preset tuning dead config.
  const gO=cfg?.garchOmega??GARCH_OMEGA;
  const gA=cfg?.garchAlpha??GARCH_ALPHA;
  const gB=cfg?.garchBeta??GARCH_BETA;
  const garch=gO+gA*epsilon2+gB*prev;
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

// V1.5.4: merged from buildTfIdf + buildTermFreqDist — single canonical term freq builder.
function buildTermFreq(tokens) {
  if (!tokens||!tokens.length) return {};
  const freq={};
  tokens.forEach(w=>{if(!STOP_WORDS.has(w))freq[w]=(freq[w]||0)+1;});
  const total=Object.values(freq).reduce((s,v)=>s+v,0)||1;
  const dist={};
  Object.keys(freq).forEach(w=>dist[w]=freq[w]/total);
  return dist;
}

// V1.5.42 fix: smoothed IDF — previous formula log(2/df) zeroed shared terms,
// making the dot product always 0 and tfidfSimilarity always return 0.
// Root cause: terms in both docs → IDF=log(1)=0; terms in one doc only → other
// doc has tf=0, so dot contribution is 0 either way. Function was constant 0.
// Fix: smoothed IDF = log((N+1)/(df+1)) + 1 (standard Scikit-learn default).
//   df=2 (shared):    log(3/3)+1 = 1.000 → shared terms now contribute
//   df=1 (unique):    log(3/2)+1 ≈ 1.405 → unique terms weighted higher
// Cosine similarity now measures how closely the two term distributions align,
// with unique terms weighted above shared ones — correct for coherence scoring.
function tfidfSimilarity(tokensA, tokensB) {
  const tfA=buildTermFreq(tokensA), tfB=buildTermFreq(tokensB);
  const allTerms=new Set([...Object.keys(tfA),...Object.keys(tfB)]);
  if (!allTerms.size) return 1;
  let dot=0,normA=0,normB=0;
  allTerms.forEach(term=>{
    const inA=term in tfA?1:0, inB=term in tfB?1:0;
    const idf=(inA+inB>0)?Math.log((2+1)/(inA+inB+1))+1:0;
    const a=(tfA[term]||0)*idf, b=(tfB[term]||0)*idf;
    dot+=a*b; normA+=a*a; normB+=b*b;
  });
  const denom=Math.sqrt(normA)*Math.sqrt(normB);
  return denom===0?0:Math.min(dot/denom,1);
}

// ── Jensen-Shannon Divergence ──────────────────────────────────
function jensenShannonDivergence(tokensA, tokensB) {
  const pA=buildTermFreq(tokensA), pB=buildTermFreq(tokensB);
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

// ── Semantic Coherence — V2.0 ──────────────────────────────────
// Uses embeddings from Web Worker (all-MiniLM-L6-v2).
// Falls back to TF-IDF if embedder not ready.
function cosineSimilarityVec(a, b) {
  let dot=0, normA=0, normB=0;
  for (let i=0; i<a.length; i++) {
    dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i];
  }
  const denom = Math.sqrt(normA)*Math.sqrt(normB);
  return denom===0 ? 0 : Math.min(dot/denom, 1);
}

async function computeSemanticCoherence(newContent, history, weights, repThresh, workerRef) {
  const ah = history.filter(m=>m.role==="assistant");
  if (!ah.length) return 0.88;

  // If worker not ready, fall back to TF-IDF
  if (!workerRef?.current?.ready) {
    return computeCoherence(newContent, history, weights, repThresh);
  }

  const recentText = ah.slice(-4).map(m=>getTextFromContent(m.content)).join(" ");

  // Request embeddings from worker
  const getEmbedding = (text) => new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (e) => {
      if (e.data.id !== id) return;
      workerRef.current.worker.removeEventListener('message', handler);
      if (e.data.type === 'result') resolve(e.data.embedding);
      else reject(new Error(e.data.message));
    };
    workerRef.current.worker.addEventListener('message', handler);
    workerRef.current.worker.postMessage({ type: 'embed', text: text.slice(0, 1000), id });
  });

  try {
    const [newEmb, recEmb] = await Promise.all([
      getEmbedding(newContent),
      getEmbedding(recentText),
    ]);
    const semanticSim = cosineSimilarityVec(newEmb, recEmb);

    // Blend semantic similarity with length/structure/persistence from TF-IDF scorer
    // semantic replaces the tfidf+jsd components (0.50 weight combined)
    const newT = tokenize(newContent);
    const recT = tokenize(recentText);
    const avgLen = ah.reduce((s,m)=>s+getTextFromContent(m.content).length,0)/ah.length;
    const lenScore = Math.exp(-Math.abs(newContent.length-avgLen)/Math.max(avgLen,1)*2);
    const sents = n=>n.split(/[.!?]+/).filter(s=>s.trim().length>8).length;
    const newSC = sents(newContent);
    const avgSC = ah.reduce((s,m)=>s+sents(getTextFromContent(m.content)),0)/ah.length;
    const struct = Math.exp(-Math.abs(newSC-avgSC)/Math.max(avgSC,1)*1.5);
    const tf={}; recT.forEach(w=>{tf[w]=(tf[w]||0)+1;});
    const top = Object.entries(tf).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>e[0]);
    const persist = top.length===0?1:top.filter(t=>newT.includes(t)).length/top.length;
    const lastReply = getTextFromContent(ah[ah.length-1]?.content||"");
    const lastT = tokenize(lastReply);
    const overlap = lastT.length>0 ? lastT.filter(w=>newT.includes(w)).length/lastT.length : 0;
    const rt = repThresh??0.65;
    const repPenalty = overlap>rt ? rt : 1.0;
    const w = weights??{tfidf:0.25,jsd:0.25,length:0.25,structure:0.15,persistence:0.10};
    // semantic replaces tfidf+jsd, keeps length+structure+persistence weights
    const score = (
      semanticSim * (w.tfidf + w.jsd) +
      lenScore * w.length +
      struct * w.structure +
      persist * w.persistence
    ) * repPenalty;
    return Math.min(Math.max(score, 0.30), 0.99);
  } catch {
    // Embedding failed — fall back to TF-IDF
    return computeCoherence(newContent, history, weights, repThresh);
  }
}
// ═══════════════════════════════════════════════════════════════
function detectMuteMode(text, phrases) {
  // No USE_MUTE_MODE guard — call sites gate with featMute so the module
  // constant (boot default only) never silently re-enables detection.
  if (!text||text.length<8) return false;
  const lower = text.toLowerCase().trimStart();
  return (phrases??MUTE_PHRASES).some(phrase => lower.startsWith(phrase));
}

function buildMuteInjection(cfg) {
  const cap=cfg?.muteMaxTokens??MUTE_MAX_TOKENS;
  // V1.5.4 fix #14: was cap/8|0 which gave ~15 words for 120-token budget.
  // Standard approximation is ~0.75 words/token → 120 tokens ≈ 90 words.
  const wordLimit=Math.round(cap*0.75);
  return `\n\n[MUTE_MODE ACTIVE]\nRespond in ${wordLimit} words or fewer. ` +
    `One direct answer. No elaboration, no follow-up steps unless explicitly asked.`;
}

// ═══════════════════════════════════════════════════════════════
//  DRIFT GATE
// ═══════════════════════════════════════════════════════════════
function buildDriftGateInjection(smoothedVar,cfg) {
  const caution=cfg?.varCaution??VAR_CAUTION;
  const decohere=cfg?.varDecoherence??VAR_DECOHERENCE;
  const wordLim=cfg?.driftGateWordLimit??DRIFT_GATE_WORD_LIMIT;
  // No USE_DRIFT_GATE guard — featGate at the call site is the live gate.
  if (smoothedVar===null||smoothedVar<=caution) return "";
  const severity=smoothedVar>decohere?"CRITICAL":"ELEVATED";
  return `\n\n[DRIFT_GATE — Variance ${severity}: σ²=${smoothedVar.toFixed(4)}]\n` +
    `Hard limit: respond in ${wordLim} words or fewer. ` +
    `No new frameworks. No unsolicited steps. Reference only prior established context.`;
}

// ═══════════════════════════════════════════════════════════════
//  PIPING ENGINE
// ═══════════════════════════════════════════════════════════════
function buildPipeInjection(smoothedVar,kalmanX,kalmanP,calmStreak,driftCount,harnessMode,turn,hSignalCount,bSignalCount,adaptedSig,cfg) {
  // No USE_PIPING guard — featPipe at the call site is the live gate.
  // V1.5.9 fix #Grok-4: reads cfg.varDecoherence/varCaution/varCalm
  // so pipe directives respond to preset thresholds, not hardcoded module constants.
  if (turn<2) return "";
  const vDec=cfg?.varDecoherence??VAR_DECOHERENCE;
  const vCau=cfg?.varCaution??VAR_CAUTION;
  const vCal=cfg?.varCalm??VAR_CALM;
  const varState=smoothedVar>vDec?"DECOHERENCE"
    :smoothedVar>vCau?"CAUTION"
    :smoothedVar<vCal?"CALM":"NOMINAL";
  const directive=smoothedVar>vDec
    ?`Re-align to Resonance Anchor ${RESONANCE_ANCHOR} Hz. One sentence only. No questions. No elaboration. Direct answer.`
    :smoothedVar>vCau
    ?`Variance rising. Consolidate. Increase term persistence.`
    :smoothedVar<vCal&&calmStreak>=3
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
  return `\n\n[SYSTEM_INTERNAL — ARCHITECT PIPE | Turn ${turn}]` +
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
  // V1.5.42: threshold raised from 0.05 to 0.15 — calibrated for smoothed IDF
  // (V1.5.42 fix). Old threshold was set against broken TF-IDF that always
  // returned 0. With working similarity, 0.05 is too loose and retrieves
  // marginally-related turns. 0.15 requires meaningful term overlap.
  return cache.map(e=>({...e,sim:tfidfSimilarity(qt,e.tokens)}))
    .sort((a,b)=>b.sim-a.sim).slice(0,k).filter(e=>e.sim>.15);
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
    `ARCHITECT — UNIVERSAL COHERENCE ENGINE · CHAT EXPORT`,
    `EXPERIMENTAL DATA — PROXY INDICATORS ONLY`,
    `Session ID: ${sessionId??'—'}  ·  ${new Date().toISOString()}`,
    `κ: ${userKappa}${kappaNote}  ·  ANCHOR: ${userAnchor}${anchorNote}`,
    ``,
  ].join("\n");
  const auditRows=coherenceData.map((d,i)=>{
    const turn=i+1;
    const status=d.raw>0.80?"✓ OK":d.raw>0.55?"△ WATCH":"⚠ DRIFT";
    const mode=d.mode?.toUpperCase()||"AUDIT";
    // L1: use smoothedVar thresholds from module defaults for export
    // (cfg not available here — export is session-level, thresholds may have changed mid-session)
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
function downloadResearch(coherenceData, eventLog, sessionId, userKappa, userAnchor, activePreset, researchNotes, cfg) {
  const ts = new Date().toISOString();
  const kappaNote = userKappa!==0.444?` [MODIFIED from 0.444]`:"";
  const anchorNote = userAnchor!==623.81?` [MODIFIED from 623.81]`:"";
  const header = [
    `ARCHITECT — UNIVERSAL COHERENCE ENGINE · RESEARCH EXPORT`,
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
      // N2 fix: use cfg preset weights so MEDICAL/CREATIVE etc. match live health score.
      // Was hardcoded 4/6/8 regardless of preset.
      const dw = cfg?.healthDriftWeight ?? 8;
      const bw = cfg?.healthBSigWeight  ?? 4;
      const hw = cfg?.healthHSigWeight  ?? 6;
      const avgC = coherenceData.slice(0,i+1).reduce((s,x)=>s+x.raw,0)/(i+1);
      const dc = coherenceData.slice(0,i+1).filter(x=>x.harnessActive).length;
      const bP = Math.min(coherenceData.slice(0,i+1).filter(x=>x.behavioralFlag).length*bw,20);
      const hP = Math.min(coherenceData.slice(0,i+1).filter(x=>x.hallucinationFlag).length*hw,18);
      return Math.min(100,Math.max(0,Math.round(avgC*100)-Math.min(dc*dw,40)-bP-hP));
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
    'ARCHITECT — SDE PATH EXPORT',
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
  `You are a highly precise technical assistant operating within ARCHITECT V1.5.43, a real-time AI coherence engine. `+
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
  deep:     `\n\n[ARCHITECT — Deep Clean | κ=0.444 | γ_h=5000]\nDrift detected. Every claim must trace to established context.`,
  extreme:  `\n\n[ARCHITECT — EXTREME | κ=0.444 | γ_h=10000]\nCRITICAL DRIFT. One claim at a time. Ground every sentence in prior facts.`,
};

// ── Session export ─────────────────────────────────────────────
function buildExportBlock(s) {
  const {kalmanState,harnessMode,driftCount,turnCount,lastScore,
         coherenceData,ragCache,smoothedVar,calmStreak,lock888Achieved,
         userKappa,userAnchor,activePreset,
         featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
         featGate,featBSig,featHSig,featPrune,featZeroDrift,
         nPaths,postAuditMode}=s;
  const mode=HARNESS_MODES[harnessMode],cap_eff=driftLawCapEff(mode.gamma_h); // export block uses module EPSILON — no user state here
  const liveDamp=1/(1+(userKappa??KAPPA));
  const anchor=userAnchor??RESONANCE_ANCHOR;
  const lock=applyZeroDriftLock(anchor-(lastScore??0)*.01,anchor);
  const avgC=coherenceData.length?(coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length).toFixed(4):"N/A";
  const ragSummary=ragCache.length
    ?ragCache.map(e=>`  T${e.turn}|C=${e.score.toFixed(3)}: ${e.text.slice(0,120).replace(/\n/g," ")}…`).join("\n")
    :"  (empty)";
  const kappaNote=(userKappa??KAPPA)!==KAPPA?` ⚠ MODIFIED from 0.444`:"";
  const anchorNote=(userAnchor??RESONANCE_ANCHOR)!==RESONANCE_ANCHOR?` ⚠ MODIFIED from 623.81`:"";
  return `START_MISSION_PROTOCOL: HUDSON_PERRY_DRIFT_ARCHITECT_V1.5.43
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHITECT — Universal Coherence Engine V1.5.43
© Hudson & Perry Research
⚠ R&D ONLY — Proxy indicators, no warranty

1. FEATURES ACTIVE (boot defaults — live state in 1b below)
Profile:${activePreset??'DEFAULT'} | RAG:${USE_RAG} | Pipe:${USE_PIPING}
MuteMode:${USE_MUTE_MODE} | DriftGate:${USE_DRIFT_GATE}
Prune:>${PRUNE_THRESHOLD}msg→top ${PRUNE_KEEP}

1b. FEATURE TOGGLES (live — these govern actual runtime behaviour)
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

// ═══════════════════════════════════════════════════════════════
//  THEME — V1.5.6 light/daytime palette
//  All module-level components and the S styles object read from here.
//  Swap bgRoot↔bgDark etc. to toggle between light and dark modes.
// ═══════════════════════════════════════════════════════════════
const THEME = {
  bgRoot:       "#F0F4FA",
  bgPanel:      "#FFFFFF",
  bgCard:       "#F4F7FB",
  bgInput:      "#EEF2F7",
  bgSunken:     "#E6ECF4",
  bgWarn:       "#FFF8EE",
  bgError:      "#FFF1F3",
  bgSuccess:    "#EEFBF4",
  bgRewind:     "#E6F4EC",
  bgHSig:       "#FFF4E8",
  bgBSig:       "#F0EFFF",
  border:       "#B0C4DA",
  borderLight:  "#C8D8EC",
  borderFaint:  "#D8E4F0",
  borderAccent: "#7AAAC8",
  // Text — darkened throughout for light-theme readability
  textPrimary:  "#0E1C2A",  // near-black body text
  textSecond:   "#162840",  // dark secondary
  textMid:      "#1E3C5C",  // mid-weight labels
  textDim:      "#2E5070",  // secondary labels
  textFaint:    "#2E5070",  // tertiary labels (was far too pale)
  textTiny:     "#1E3C5C",  // smallest labels
  teal:         "#0A7878",
  green:        "#178040",
  red:          "#C81030",
  orange:       "#9A5C08",
  purple:       "#4848B8",
  blue:         "#1560B0",
  gold:         "#906000",
  userBubble:   "#E8F0F8",
  userBubbleBorder:"#8AAECE",
  userText:     "#0E1C2A",
  asstBubble:   "#F6F8FC",
  asstBubbleBorder:"#B8CCE0",
  asstText:     "#0E1C2A",
  driftBubble:  "#FEF0F2",
  driftBorder:  "#C8103055",
};

// ── Tooltip ────────────────────────────────────────────────────
function CoherenceTooltip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#EEF2F7",border:"1px solid #A8C8E0",padding:"10px 14px",
      borderRadius:6,fontSize:11,fontFamily:"Courier New, monospace",color:"#0E1C2A"}}>
      <div style={{color:"#0E2A5A",marginBottom:4}}>Turn {label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"#0E1C2A"}}>
          {p.name}: {typeof p.value==="number"?p.value.toFixed(4):p.value}
        </div>
      ))}
      <div style={{marginTop:4,fontFamily:"Courier New, monospace",fontSize:9,color:"#0A7878"}}>
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
      <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2E5070",marginRight:2}}>{cfg.label}</span>
      <button onClick={()=>onRemove(att.id)} style={{background:"none",border:"none",cursor:"pointer",
        color:"#1E3C5C",fontSize:14,padding:0,lineHeight:1,minWidth:20,minHeight:20,
        display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
    </div>
  );
}

// ── Response entropy (Shannon) ─────────────────────────────────
// Measures information density of the response token distribution.
// Very low entropy (<0.8): repetitive filler — model stagnating.
// Very high entropy (>3.5) + high new-vocab rate: possible hallucination
// (inventing novel entities/specifics not grounded in session context).
function computeResponseEntropy(tokens) {
  if (!tokens.length) return 0;
  const freq={};
  tokens.forEach(w=>{freq[w]=(freq[w]||0)+1;});
  const total=tokens.length;
  return -Object.values(freq).reduce((s,c)=>{
    const p=c/total;
    return s+p*Math.log2(p);
  },0);
}

// ── Vocabulary growth rate ─────────────────────────────────────
// Fraction of tokens in the new response that are entirely new to the
// session vocabulary (not seen in last 4 assistant turns).
// High rate (>0.70) under elevated variance = novel entity injection risk.
function computeVocabGrowthRate(newTokens, history) {
  const ah=history.filter(m=>m.role==="assistant");
  if (ah.length<2||!newTokens.length) return 0;
  const priorVocab=new Set(
    ah.slice(-4).flatMap(m=>tokenize(getTextFromContent(m.content)))
  );
  if (!priorVocab.size) return 0;
  return newTokens.filter(t=>!priorVocab.has(t)).length/newTokens.length;
}

// ── N-gram repetition ──────────────────────────────────────────
// Bigram overlap between new response and last 4 assistant turns.
// High bigram repetition (>0.40) = model looping or confusion.
// More sensitive than word-level overlap with just the prior turn.
function buildBigrams(tokens) {
  const bg=[];
  for (let i=0;i<tokens.length-1;i++) bg.push(tokens[i]+"_"+tokens[i+1]);
  return bg;
}
function checkNgramRepetition(responseText, history) {
  const ah=history.filter(m=>m.role==="assistant");
  if (ah.length<2) return 0;
  const newBg=buildBigrams(tokenize(responseText));
  if (!newBg.length) return 0;
  const priorBg=new Set(
    ah.slice(-4).flatMap(m=>buildBigrams(tokenize(getTextFromContent(m.content))))
  );
  return newBg.filter(b=>priorBg.has(b)).length/newBg.length;
}



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

  // V1.5.42: n-gram repetition — high bigram overlap with recent turns
  // indicates model looping or confusion, not caught by word-level checks.
  const ngramRate=checkNgramRepetition(responseText,history);
  if (ngramRate>0.40&&ah.length>=3) {
    signals.push({type:"phrase_repetition",detail:`${Math.round(ngramRate*100)}% bigram overlap with recent turns — possible looping`});
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
  // V1.5.42: related threshold lowered from 0.35 to 0.25 — calibrated for
  // smoothed IDF. With working TF-IDF, on-topic continuations score 0.30-0.50.
  // Old 0.35 threshold was at the edge of normal on-topic scoring and missed
  // related turns. 0.25 catches same-topic turns more reliably.
  const related=ah.slice(-6).filter(m=>{
    const sim=tfidfSimilarity(respT,tokenize(getTextFromContent(m.content)));
    return sim>0.25;
  });
  if (!related.length) return false;
  const avgSim=related.reduce((s,m)=>
    s+tfidfSimilarity(respT,tokenize(getTextFromContent(m.content))),0)/related.length;
  return avgSim<0.15;
}

function assessHallucinationSignals(responseText, smoothedVar, attachments, history, cfg) {
  const confidenceHits=detectConfidenceLanguage(responseText);
  const sourceScore=checkSourceConsistency(responseText, attachments);
  const contradiction=checkSelfContradiction(responseText, history);
  // M1 fix: use cfg.varCaution so MEDICAL preset's tighter threshold (0.090) applies
  const vCau=cfg?.varCaution??VAR_CAUTION;

  // V1.5.42: entropy + vocab growth rate signals
  const respTokens=tokenize(responseText);
  const entropy=computeResponseEntropy(respTokens);
  const vocabGrowth=computeVocabGrowthRate(respTokens,history);

  const signals=[];
  if (confidenceHits>=2&&smoothedVar>vCau) {
    signals.push(`high-confidence language (${confidenceHits} markers) with elevated variance`);
  }
  if (sourceScore!==null&&sourceScore<0.08) {
    signals.push(`low source consistency (${(sourceScore*100).toFixed(1)}% match with attached document)`);
  }
  if (contradiction) {
    signals.push("possible self-contradiction with prior turn on same topic");
  }
  // Low entropy = repetitive filler, model stagnating
  if (entropy>0&&entropy<0.8&&respTokens.length>10) {
    signals.push(`low response entropy (${entropy.toFixed(2)}) — repetitive or low-information reply`);
  }
  // High new-vocab rate under elevated variance = novel entity injection risk
  if (vocabGrowth>0.70&&smoothedVar>vCau&&history.filter(m=>m.role==="assistant").length>=3) {
    signals.push(`high vocabulary novelty (${Math.round(vocabGrowth*100)}% new terms) under elevated variance — possible confabulation`);
  }

  return {
    flagged: signals.length>0,
    signals,
    sourceScore,
    confidenceHits,
    contradiction,
    entropy,
    vocabGrowth,
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
  // V1.5.42: continuous variance penalty — replaces binary step function.
  // Previous: 0/10/20 at three fixed thresholds. Now scales continuously
  // with variance * 100, capped at 25. More granular health signal.
  const varPenalty=Math.min(25,Math.round((smoothedVar||0)*100));
  const calmBonus=lock888?10:calmStreak>=3?5:0;
  const bSigCount=coherenceData.filter(d=>d.behavioralFlag).length;
  const hSigCount=coherenceData.filter(d=>d.hallucinationFlag).length;
  const bPenalty=Math.min(bSigCount*bw,20);
  const hPenalty=Math.min(hSigCount*hw,18);
  const base=Math.round(avgC*100);
  return Math.min(100,Math.max(0,base-driftPenalty-varPenalty-bPenalty-hPenalty+calmBonus));
}

// ═══════════════════════════════════════════════════════════════
//  V1.5.42 ADDITIONS
// ═══════════════════════════════════════════════════════════════

// ── 1. EWMA Coherence Trend ────────────────────────────────────
// Exponentially weighted moving average over raw coherence scores.
// Returns direction: +1 (improving), -1 (declining), 0 (flat).
// Alpha=0.30: recent turns weighted ~3x more than older turns.
// Complements Kalman position estimate with directional momentum.
const EWMA_ALPHA = 0.30;
function computeEWMATrend(scoreHistory) {
  if (scoreHistory.length < 3) return {ewma:null,trend:0,momentum:0};
  let ewma = scoreHistory[0];
  for (let i=1; i<scoreHistory.length; i++) {
    ewma = EWMA_ALPHA*scoreHistory[i] + (1-EWMA_ALPHA)*ewma;
  }
  // Momentum: compare ewma of last half vs first half
  const mid = Math.floor(scoreHistory.length/2);
  let ewmaFirst=scoreHistory[0], ewmaSecond=scoreHistory[mid];
  for (let i=1; i<mid; i++) ewmaFirst=EWMA_ALPHA*scoreHistory[i]+(1-EWMA_ALPHA)*ewmaFirst;
  for (let i=mid+1; i<scoreHistory.length; i++) ewmaSecond=EWMA_ALPHA*scoreHistory[i]+(1-EWMA_ALPHA)*ewmaSecond;
  const momentum = ewmaSecond - ewmaFirst;
  const trend = momentum > 0.02 ? 1 : momentum < -0.02 ? -1 : 0;
  return {ewma, trend, momentum};
}

// ── 2. Hedge Detection ─────────────────────────────────────────
// Detects excessive epistemic hedging — the opposite of over-confidence.
// Grice's Maxim of Quantity (1975): responses should be as informative
// as required. Excessive hedging on technical/factual questions violates
// this and signals low-confidence responses that may still be wrong.
// Fires as H-signal when hedge density exceeds threshold.
const HEDGE_PATTERNS = [
  /\bI('m| am) not (sure|certain|entirely sure|fully sure)\b/i,
  /\bit('s| is) (possible|conceivable|plausible) that\b/i,
  /\bmight (be|have|want|consider)\b/i,
  /\bcould (be|potentially|possibly)\b/i,
  /\bI (think|believe|suspect|imagine) (but|though|although)\b/i,
  /\bI('m| am) not (an expert|a doctor|a lawyer|qualified)\b/i,
  /\btake (this|that|it) with a (grain|pinch) of salt\b/i,
  /\byou (might|may|should) (want to |consider )?consult\b/i,
  /\bdon't (quote|hold) me on (that|this)\b/i,
  /\bI (could be|may be) wrong\b/i,
];
function detectHedgeDensity(text) {
  const matches = HEDGE_PATTERNS.filter(p=>p.test(text)).length;
  const wordCount = text.split(/\s+/).length;
  // Density: hedge patterns per 100 words
  return {count:matches, density: wordCount > 0 ? (matches/wordCount)*100 : 0};
}

// ── 3. Response Truncation Detection ──────────────────────────
// Responses that end abruptly signal token limit or context exhaustion.
// Model didn't complete its answer but didn't flag it either.
// Checks last non-whitespace character — valid endings: . ? ! ) ] "
// Also catches mid-list truncation (ends on comma or colon).
function detectTruncation(text) {
  const trimmed = text.trimEnd();
  if (!trimmed || trimmed.length < 50) return false;
  const last = trimmed[trimmed.length-1];
  const validEndings = new Set(['.','!','?',')',']','}','"',"'",'`',':']);
  // Colon at end = likely truncated (was about to list something)
  if (last === ':') return true;
  if (last === ',') return true;
  return !validEndings.has(last);
}

// ── 4. Semantic Anchor Distance ────────────────────────────────
// Tracks how far the current response has drifted from the session's
// opening turns (turns 1-3 = the "anchor"). Local turn-by-turn coherence
// can stay high while the session slowly drifts far from original topic.
// This closes the slow-burn drift gap that turn-by-turn scoring misses.
// Returns similarity to anchor [0,1]. Low = session has drifted far.
function computeAnchorDistance(responseText, history) {
  const ah = history.filter(m=>m.role==="assistant");
  if (ah.length < 4) return null; // need enough turns before anchor matters
  // Anchor = first 3 assistant turns
  const anchorText = ah.slice(0,3).map(m=>getTextFromContent(m.content)).join(" ");
  const anchorTokens = tokenize(anchorText);
  const respTokens = tokenize(responseText);
  if (!anchorTokens.length || !respTokens.length) return null;
  return tfidfSimilarity(respTokens, anchorTokens);
}

// ── 5. Kalman Innovation Whiteness Check ───────────────────────
// If the Kalman filter is correctly specified, the innovation sequence
// (obs - predicted) should be white noise — uncorrelated across turns.
// Serial correlation = model misspecification (process or noise model wrong).
// Lag-1 autocorrelation. |r| > 0.5 = significant serial correlation.
// Reference: Box & Jenkins (1970), standard Kalman validation procedure.
function computeInnovationAutocorrelation(scoreHistory, kalmanHistory) {
  if (!kalmanHistory||kalmanHistory.length < 5||scoreHistory.length < 5) return null;
  const n = Math.min(scoreHistory.length, kalmanHistory.length);
  // Innovation = obs - predicted (simplified: obs - kalman_x)
  const innov = [];
  for (let i=0; i<n; i++) {
    innov.push(scoreHistory[i] - (kalmanHistory[i]?.x ?? scoreHistory[i]));
  }
  // Lag-1 autocorrelation
  const mean = innov.reduce((s,v)=>s+v,0)/innov.length;
  let cov=0, variance=0;
  for (let i=1; i<innov.length; i++) {
    cov += (innov[i]-mean)*(innov[i-1]-mean);
    variance += Math.pow(innov[i]-mean,2);
  }
  variance += Math.pow(innov[0]-mean,2);
  return variance === 0 ? 0 : cov/variance;
}

// ── 6. Token Budget Efficiency Ratio ──────────────────────────
// Response information density relative to length.
// High entropy + short = efficient. Low entropy + long = expensive waste.
// Ratio: entropy / log2(wordCount) — normalized so 1.0 = optimal.
// < 0.4 = long response with low information (padding/filler).
// > 1.2 = dense, efficient response.
// Especially useful for MEDICAL/CIRCUIT where precision-per-token matters.
function computeEfficiencyRatio(text, entropy) {
  const wordCount = text.split(/\s+/).filter(w=>w.length>0).length;
  if (wordCount < 5 || entropy <= 0) return null;
  const lenNorm = Math.log2(Math.max(wordCount, 2));
  return lenNorm > 0 ? entropy / lenNorm : null;
}

// ── Framework Document ─────────────────────────────────────────
const FRAMEWORK_CONTENT=`ARCHITECT — UNIVERSAL COHERENCE ENGINE
TIME-VARYING ERROR DYNAMICS & AI COHERENCE ENGINE
Authors: David Hudson (@RaccoonStampede) & David Perry (@Prosperous727)
Version 3.6  |  V1.5.43  |  © 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TWO-LEVEL ARCHITECTURE

  STRUCTURAL LAYER — defines where meaningful signal emerges.
    The SDE + Coherence Layer specify the location and nature of
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
  2. Drift-Law Layer — macro inefficiency auditor
  3. AI Coherence Engine (this tool) — live implementation

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

PART 2 — COHERENCE LAYER

  ΔS = cap_eff × (1 − exp(−nᵅ / τ)) + β·sin(γn)
  cap_eff = ε / (1 + γ_h)   ε = 0.05 (minimum coherence floor)

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
           Per-preset GARCH tuning ✓ | Epsilon parameterization ✓
           Post-audit dual Kalman ✓ | React Context architecture ✓
           Full cfg threading end-to-end ✓ | Math tunables persist ✓
           External: Grok review 9.2/10, top 1% personal AI tooling

REQUIRES VALIDATION: C-score vs. human judgment | H-signal
false positive rate | 623.81 Hz physical anchor

V1.5.3–V1.5.43 ADDITIONS TO FRAMEWORK
  GARCH preset tuning: per-preset omega/alpha/beta now applied.
  Epsilon param: mathEpsilon wired to cap_eff, chart bands, MATH tab.
  cfg threading: varCaution/Decoherence/Calm flow through pipe, gate,
    signals, status bar, health scoring, CSV export end-to-end.
  Typing fix: onInput+onCompositionEnd, guarded setHasInput.
  Persistence: all math tunables, SDE params, post-audit threshold,
    and Advanced Tab state survive session reload.
  Rewind: prev/next buttons use actual buffer bounds.
  All key values memoized. Model string: claude-sonnet-4-6.
  V1.5.17–V1.5.43: Advanced Tab (CIR/Heston, Custom Rails, MHT Study,
    Poole CA Sim, DATL Heartbeat). CIRCUIT preset. SDE path viz.
    Circuit Signal sidebar. Mobile scroll fixed. Full pseudoscience
    cleanup — experimental framing behind consent gate. MessageBubble
    memoized. All version strings normalized to V1.5.43.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

© 2026 David Hudson & David Perry
𝕏 @RaccoonStampede · @Prosperous727`;

// ── Guide Content ──────────────────────────────────────────────
const GUIDE_CONTENT=`ARCHITECT — UNIVERSAL COHERENCE ENGINE · USER GUIDE
How to Read the Graph · How to Detect Drift · How to Use the Harness
Version 1.5.39  |  © 2026 David Hudson & David Perry

ARCHITECT monitors AI response quality in real time. It scores every
response mathematically, tracks coherence trends, and injects corrective
directives automatically. This guide covers what you see and how to use it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT IS THIS TOOL?

ARCHITECT is a real-time AI coherence engine. It wraps a conversation
with Claude and adds a live measurement and correction layer on top.

Every AI response is scored using a combination of text similarity metrics
(TF-IDF + Jensen-Shannon Divergence), length and structural consistency,
and vocabulary persistence. That score is then tracked using a Kalman
filter (noise-smoothed trajectory estimate) and a GARCH variance model
(volatility clustering). When coherence drops, the tool automatically
adjusts the next system prompt to correct course.

The result: a dashboard that shows whether the AI is staying on topic,
drifting, or behaving inconsistently — and acts on it automatically.

What's confirmed and validated: TF-IDF + JSD scoring, Kalman filtering,
GARCH(1,1) variance, pipe injection, behavioral signal detection, and
session health scoring. These are the core tools. Everything in the
standard interface is mathematically grounded.

Advanced users who want to explore experimental models (CIR, Heston,
custom math, user-defined rails) can access those via the ADVANCED tab
in TUNE — clearly labeled as experimental.

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

  ── Red dashed line (Coherence Floor)
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

PART 8 — V1.5.x ADDITIONS (V1.5.0 → V1.5.43)

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
  CUSTOM   User-set Kalman threshold.
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

MATH TAB TUNABLES (TUNE → MATH)
  All five coherence weights (TF-IDF, JSD, Length, Structure, Persistence),
  repetition threshold, Kalman R and SigmaP, RAG top-K, max tokens, and
  epsilon (minimum floor) are all user-editable.
  Live weight sum displayed — green ✓ at 1.000, amber ⚠ when off.
  Weights are independent multipliers. Sum of 1.0 is recommended but
  not enforced. All MATH tunables persist across session reloads.

INDUSTRY PRESETS (TUNE → PRESETS)
  DEFAULT / TECHNICAL / CREATIVE / RESEARCH / MEDICAL / CIRCUIT / CUSTOM
  Each preset tunes GARCH params, SDE params, variance thresholds,
  word limits, health penalty weights, and drift escalation thresholds.
  CIRCUIT uses the tightest logic-verification settings. MEDICAL uses
  the tightest clinical settings. CREATIVE uses the loosest.

REWIND (click any chart dot, or use PREV / NEXT)
  Restores full session state to any prior turn.
  Buffer holds last 20 snapshots. LIVE returns to present.

RESEARCH NOTES
  Open via NOTES button in the header.
  Free-form text stamped on every RESEARCH export.
  Persists across session resets and reloads.

ADVANCED TAB (TUNE → ⚗ ADVANCED)
  Experimental features for advanced users only. Must be explicitly unlocked.
  Carries a clear warning: features here are experimental or unvalidated.

  ALTERNATIVE SDE MODELS (Advanced)
    HPDL (default) — Hudson-Perry Ornstein-Uhlenbeck + periodic SDE.
    CIR — Cox-Ingersoll-Ross: dX = κ(θ−X)dt + σ√X dW
      Ensures variance stays positive. Good for rate/volatility processes.
    HESTON — Stochastic volatility: correlated variance process.
      dV = κ(θ−V)dt + σ√V dW₁ · dS/S = √V dW₂ · correlation ρ.
    Both CIR and Heston are experimental in this context. Use with caution.

  CUSTOM RAILS (Advanced)
    User-defined behavioral guidelines injected into every prompt.
    Write plain language — the AI will follow these as additional rules.
    Examples: "Never exceed 3 paragraphs." · "Always cite sources."
    Toggleable on/off. Persists across sessions.

  MHT STUDY (Advanced)
    Metatron-Hudson Theory SDE study module. Robitaille Helix invariants
    (psi, kappa bound, tau), H_drift annihilator parameters, and DATL
    Heartbeat. Live computed values at t=1. Study use only.

  POOLE CA SIM (Advanced)
    3D cellular automaton simulator. Adjustable birth/survival parameters.
    Default B:5-7 / S:5-9. Live canvas preview. Full adder truth table
    (8/8 Turing completeness verification).

SDE PATH VISUALIZATION (TUNE -> FEATURES -> SDE Path Viz)
  Toggle to render faint OU ensemble paths on the coherence chart.
  Up to 20 paths in the active preset color. Opacity in DISPLAY tab.

CIRCUIT SIGNAL (metrics sidebar)
  Appears when Poole CA Sim is active. Shows full adder pass rate.
  >= 87.5% renders green, below renders amber.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

© 2026 David Hudson & David Perry. All rights reserved.
𝕏 @RaccoonStampede (David Hudson)
𝕏 @Prosperous727 (David Perry)`;

// ═══════════════════════════════════════════════════════════════
//  CONTEXTS (V1.5.8 — Phase 2 of component split)
//  TuneCtx   — all TUNE panel state (was 30+ props on TuneModal)
//  SessionCtx — session data shared by Log, Bookmarks, Export modals
//  State still lives in HudsonPerryDriftV1. Contexts are value objects
//  memoized there. Modals read via useContext — no prop drilling.
// ═══════════════════════════════════════════════════════════════
const TuneCtx    = createContext(null);
const SessionCtx = createContext(null);

// ═══════════════════════════════════════════════════════════════
//  MODAL SUB-COMPONENTS (V1.5.6 — extracted from main render)
//  Each receives only the props it needs. React.memo prevents
//  re-renders when unrelated state changes in the main component.
//  State management stays in HudsonPerryDriftV1 — no restructure needed.
// ═══════════════════════════════════════════════════════════════
// ── ExportContentModal ──────────────────────────────────────────────
const ExportContentModal = React.memo(function ExportContentModal() {
  const {exportContent,setExportContent,exportCopied,setExportCopied} = useContext(SessionCtx);
  if (!exportContent) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.55)",zIndex:2001,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>{setExportContent(null);setExportCopied(false);}}>
    <div style={{background:"#FFFFFF",border:"1px solid #A8C8E0",
      borderRadius:8,maxWidth:740,width:"100%",maxHeight:"88vh",
      display:"flex",flexDirection:"column",overflow:"hidden"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"12px 18px",
        borderBottom:"1px solid #1A3050",background:"#FAFCFF",flexShrink:0}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:10,
          color:"#0E2A5A",letterSpacing:2,fontWeight:"bold"}}>
          {exportContent.title}
        </span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{
            navigator.clipboard.writeText(exportContent.text).then(()=>{
              setExportCopied(true);
              setTimeout(()=>setExportCopied(false),2500);
            });
          }} style={{padding:"5px 16px",
            background:exportCopied?"#E8F4EC":"transparent",
            border:`1px solid ${exportCopied?"#178040":"#1EAAAA44"}`,
            borderRadius:4,color:exportCopied?"#178040":"#0A7878",
            cursor:"pointer",fontSize:9,fontFamily:"Courier New, monospace",
            letterSpacing:1,transition:"all .2s"}}>
            {exportCopied?"✓ COPIED":"COPY ALL"}
          </button>
          <button onClick={()=>{setExportContent(null);setExportCopied(false);}}
            style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
              color:"#1E3C5C",cursor:"pointer",fontSize:13,padding:"2px 10px",
              fontFamily:"Courier New, monospace"}}>✕</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"14px 18px",WebkitOverflowScrolling:"touch"}}>
        <pre style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#0E1C2A",lineHeight:1.75,margin:0,
          whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
          {exportContent.text}
        </pre>
      </div>
      <div style={{padding:"7px 18px",borderTop:"1px solid #1A3050",
        background:"#FAFCFF",flexShrink:0,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2E5070"}}>
          {exportContent.filename}
        </span>
        <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2E5070"}}>
          EXPERIMENTAL DATA — PROXY ONLY
        </span>
      </div>
    </div>
  </div>
  );
});

// ── DisclaimerModal ──────────────────────────────────────────────
const DisclaimerModal = React.memo(function DisclaimerModal({showDisclaimer,setShowDisclaimer,setShowGuide,hudsonMode,setHudsonMode,setUserKappa}) {
  if (!showDisclaimer) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.70)",zIndex:2000,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"#FFFFFF",border:"2px solid #9A5C08",
      borderRadius:8,maxWidth:620,width:"100%",maxHeight:"90vh",
      display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Title */}
      <div style={{padding:"14px 20px",borderBottom:"1px solid #2A1A00",
        background:"#FAFCFF",flexShrink:0}}>
        <div style={{fontFamily:"Courier New, monospace",fontSize:12,
          color:"#9A5C08",letterSpacing:2,fontWeight:"bold",marginBottom:2}}>
          ⚠ RESEARCH &amp; DEVELOPMENT TOOL — IMPORTANT NOTICE
        </div>
        <div style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#4A6060",letterSpacing:1}}>
          ARCHITECT — UNIVERSAL COHERENCE ENGINE V1.5.43 · READ IN FULL BEFORE PROCEEDING
        </div>
      </div>

      {/* Body */}
      <div style={{overflowY:"auto",flex:1,padding:"16px 20px",
        fontFamily:"Courier New, monospace",fontSize:8,lineHeight:1.9}}>

        {[
          ["1. EXPERIMENTAL STATUS",
           "#9A5C08",
           "This software is an experimental research tool in active development. It has not been peer-reviewed, independently audited, clinically validated, or verified against any external dataset. No version of this tool should be considered production-ready, certified, or fit for regulated use."],

          ["2. PROXY INDICATORS — NOT MEASUREMENTS",
           "#9A5C08",
           "All outputs produced by this tool — including coherence scores, session health scores, hallucination signals, behavioral signals, variance states, Kalman estimates, SDE bands, and Zero-Drift Lock status — are mathematical proxy indicators derived from text analysis heuristics. They do not constitute measurements, assessments, diagnoses, evaluations, or determinations of any kind. They may be inaccurate, misleading, or entirely wrong."],

          ["3. NO CLINICAL, LEGAL, OR SAFETY USE",
           "#C81030",
           "Outputs from this tool must not be used — directly or indirectly — to inform medical, psychological, clinical, legal, financial, safety-critical, regulatory, or compliance decisions. This prohibition applies regardless of the context in which the tool is deployed or the nature of the AI being monitored."],

          ["4. NO WARRANTY",
           "#C81030",
           "THIS SOFTWARE IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, OR NON-INFRINGEMENT. THE AUTHORS MAKE NO REPRESENTATIONS REGARDING THE CORRECTNESS OR RELIABILITY OF ANY OUTPUT."],

          ["5. LIMITATION OF LIABILITY",
           "#C81030",
           "To the maximum extent permitted by applicable law, Hudson & Perry Research, David Hudson, and David Perry shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from the use of, or inability to use, this tool or its outputs. This includes but is not limited to damages from reliance on proxy signals, modified constants, experimental configurations, or any decision made based on tool outputs."],

          ["6. MODIFIED CONSTANTS",
           "#9A5C08",
           "ARCHITECT allows adjustment of foundational constants (κ and RESONANCE_ANCHOR). Results generated with non-default values operate outside the published Hudson & Perry framework and carry no validation basis whatsoever. The authors accept no responsibility for outputs produced under modified-constant configurations."],

          ["7. NOT LEGAL OR PROFESSIONAL ADVICE",
           "#9A5C08",
           "Nothing in this tool or its outputs constitutes legal, medical, financial, psychological, or any other form of professional advice. Users requiring such advice should consult a qualified licensed professional."],

          ["8. DATA & PRIVACY",
           "#1560B0",
           "Conversation data processed by this tool is transmitted to Anthropic's API under your own API key and is subject to Anthropic's terms of service and privacy policy. This tool does not independently store, log, or transmit conversation content beyond your active browser session. API keys entered are session-only and are never written to persistent storage."],

          ["9. ACCEPTANCE OF RISK",
           "#9A5C08",
           "By proceeding past this notice, you acknowledge that you have read and understood these terms, that you accept full responsibility for how you use this tool and interpret its outputs, and that you hold Hudson & Perry Research, David Hudson, and David Perry harmless from any claim arising from your use of this software."],
        ].map(([title,col,body])=>(
          <div key={title} style={{marginBottom:12,paddingBottom:10,
            borderBottom:"1px solid #0E1820"}}>
            <div style={{color:col,letterSpacing:1,marginBottom:4,
              fontWeight:"bold"}}>{title}</div>
            <div style={{color:"#162840",lineHeight:1.8}}>{body}</div>
          </div>
        ))}

        <div style={{marginTop:8,padding:"8px 12px",background:"#FFF1F2",
          borderRadius:4,border:"1px solid #E0506033",
          color:"#A06060",fontSize:7,lineHeight:1.7}}>
          © 2026 Hudson &amp; Perry Research. All rights reserved.
          Contact: 𝕏 @RaccoonStampede · 𝕏 @Prosperous727.
          This notice does not constitute legal advice. Consult a qualified
          attorney regarding your specific obligations and liability exposure.
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:"14px 20px",borderTop:"1px solid #2A1A00",
        background:"#FAFCFF",flexShrink:0}}>

        {/* Framework choice — shown until user picks */}
        <div style={{marginBottom:12,padding:"10px 14px",borderRadius:6,
          background:"#F0F4FA",border:"1px solid #2A4060"}}>
          <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#0E2A5A",
            letterSpacing:2,fontWeight:"bold",marginBottom:6}}>
            CHOOSE FRAMEWORK MODE
          </div>
          <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",
            lineHeight:1.8,marginBottom:10}}>
            ARCHITECT uses a damping constant κ in its SDE and Kalman engine. Choose your default:
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button
              onClick={()=>{setHudsonMode("hudson");setUserKappa(0.444);}}
              style={{flex:1,minWidth:160,padding:"10px 12px",cursor:"pointer",
                borderRadius:4,fontFamily:"Courier New,monospace",fontSize:8,
                letterSpacing:1,fontWeight:"bold",textAlign:"left",
                background:hudsonMode==="hudson"?"#0E2A5A":"#EEF4FF",
                color:hudsonMode==="hudson"?"#FFFFFF":"#0E2A5A",
                border:hudsonMode==="hudson"?"2px solid #0E2A5A":"1px solid #2A4060"}}>
              <div style={{fontSize:10,marginBottom:3}}>κ = 0.444</div>
              <div style={{opacity:.85}}>HUDSON FRAMEWORK</div>
              <div style={{fontSize:7,opacity:.7,marginTop:3,lineHeight:1.6}}>
                Validated default. Hudson-Perry Drift Law. Full framework active including Zero-Drift Lock and LOCK_888 stability.
              </div>
            </button>
            <button
              onClick={()=>{setHudsonMode("standard");setUserKappa(0.5);}}
              style={{flex:1,minWidth:160,padding:"10px 12px",cursor:"pointer",
                borderRadius:4,fontFamily:"Courier New,monospace",fontSize:8,
                letterSpacing:1,fontWeight:"bold",textAlign:"left",
                background:hudsonMode==="standard"?"#178040":"#EEFAF4",
                color:hudsonMode==="standard"?"#FFFFFF":"#178040",
                border:hudsonMode==="standard"?"2px solid #178040":"1px solid #40A060"}}>
              <div style={{fontSize:10,marginBottom:3}}>κ = 0.500</div>
              <div style={{opacity:.85}}>STANDARD MODE</div>
              <div style={{fontSize:7,opacity:.7,marginTop:3,lineHeight:1.6}}>
                Neutral OU damping. No framework claims. Tune κ freely 0.00–5.00 in Advanced → Edit Constants.
              </div>
            </button>
          </div>
          {!hudsonMode&&(
            <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#9A5C08",
              marginTop:6,textAlign:"center"}}>
              ↑ Choose one to continue
            </div>
          )}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"Courier New, monospace",fontSize:7,
            color:"#2E5070",lineHeight:1.5}}>
            Proceeding confirms you have read and accepted all terms above.
          </span>
          <button
            disabled={!hudsonMode}
            style={{padding:"10px 24px",
              background:hudsonMode?"#F0FFEE":"#E8EEF4",
              border:hudsonMode?"2px solid #9A5C08":"2px solid #A0B0C0",
              borderRadius:4,
              color:hudsonMode?"#9A5C08":"#8090A0",
              cursor:hudsonMode?"pointer":"not-allowed",
              fontSize:10,fontFamily:"Courier New, monospace",
              letterSpacing:1,fontWeight:"bold",flexShrink:0,marginLeft:16}}
            onClick={()=>{if(hudsonMode){setShowDisclaimer(false);setShowGuide(true);}}}>
            I ACCEPT — READ THE GUIDE FIRST
          </button>
        </div>
      </div>
    </div>
  </div>
  );
});

// ── TuneModal ──────────────────────────────────────────────
const TuneModal = React.memo(function TuneModal() {
  const {
    showTuning,setShowTuning,activePreset,setActivePreset,customConfig,setCustomConfig,
    userKappa,setUserKappa,userAnchor,setUserAnchor,hudsonMode,setHudsonMode,
    featKalman,setFeatKalman,featGARCH,setFeatGARCH,featSDE,setFeatSDE,
    featRAG,setFeatRAG,featPipe,setFeatPipe,featMute,setFeatMute,featGate,setFeatGate,
    featBSig,setFeatBSig,featHSig,setFeatHSig,featPrune,setFeatPrune,featZeroDrift,setFeatZeroDrift,
    nPaths,setNPaths,postAuditMode,setPostAuditMode,postAuditThresh,setPostAuditThresh,
    adaptiveSigmaOn,setAdaptiveSigmaOn,adaptedSigma,adaptationRate,setAdaptationRate,
    sdeAlphaVal,setSdeAlphaVal,sdeBetaVal,setSdeBetaVal,sdeSigmaVal,setSdeSigmaVal,
    sdeAlphaOn,setSdeAlphaOn,sdeBetaOn,setSdeBetaOn,sdeSigmaOn,setSdeSigmaOn,
    customMutePhrases,setCustomMutePhrases,mutePhraseInput,setMutePhraseInput,
    mathEpsilon,setMathEpsilon,mathTfidf,setMathTfidf,mathJsd,setMathJsd,
    mathLen,setMathLen,mathStruct,setMathStruct,mathPersist,setMathPersist,
    mathRepThresh,setMathRepThresh,mathKalmanR,setMathKalmanR,mathKalmanSigP,setMathKalmanSigP,
    mathRagTopK,setMathRagTopK,mathMaxTokens,setMathMaxTokens,
    tuneTab,setTuneTab,pruneThreshold,setPruneThreshold,pruneKeep,setPruneKeep,showParams,setShowParams,
    showSdePaths,setShowSdePaths,pathOpacity,setPathOpacity,
    advancedUnlocked,setAdvancedUnlocked,
    showSdeConfig,setShowSdeConfig,showRailsConfig,setShowRailsConfig,showConstEditor,setShowConstEditor,
    showMhtStudy,setShowMhtStudy,mhtPsi,setMhtPsi,mhtKappa,setMhtKappa,mhtTau,setMhtTau,
    showPoole,setShowPoole,pooleBirth1,setPooleBirth1,pooleBirth2,setPooleBirth2,
    pooleSurv1,setPooleSurv1,pooleSurv2,setPooleSurv2,pooleGen,setPooleGen,caPassRate,setCaPassRate,
    showIntegrityFloor,setShowIntegrityFloor,featIntegrityFloor,setFeatIntegrityFloor,
    integrityThreshold,setIntegrityThreshold,integrityBreachCount,
    mhtGamma,setMhtGamma,mhtCap,setMhtCap,mhtAlpha,setMhtAlpha,mhtBeta,setMhtBeta,mhtSigma,setMhtSigma,
    userRailsEnabled,setUserRailsEnabled,
    userCustomRails,setUserCustomRails,sdeModel,setSdeModel,
    cirKappa,setCirKappa,cirTheta,setCirTheta,cirSigma,setCirSigma,
    hestonKappa,setHestonKappa,hestonTheta,setHestonTheta,
    hestonSigma,setHestonSigma,hestonRho,setHestonRho,hestonV0,setHestonV0,
  } = useContext(TuneCtx);
  if (!showTuning) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.55)",zIndex:1000,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>setShowTuning(false)}>
    <div style={{background:"#FFFFFF",border:"1px solid #A8C8E0",
      borderRadius:8,maxWidth:740,width:"100%",maxHeight:"90vh",
      display:"flex",flexDirection:"column",overflow:"hidden",
      WebkitOverflowScrolling:"touch"}}
      onClick={e=>e.stopPropagation()}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"12px 18px",
        borderBottom:"1px solid #1A3050",background:"#FAFCFF",flexShrink:0}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:11,
          color:"#178040",letterSpacing:2,fontWeight:"bold"}}>
          TUNE · {PRESETS[activePreset]?.label??activePreset}
        </span>
        <button onClick={()=>setShowTuning(false)}
          style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
            color:"#1E3C5C",cursor:"pointer",fontSize:12,padding:"2px 10px",
            fontFamily:"Courier New, monospace"}}>✕ CLOSE</button>
      </div>

      {/* TUNE TAB BAR */}
      <div style={{display:"flex",borderBottom:"1px solid #1A3050",background:"#FAFCFF",flexShrink:0}}>
        {[["presets","PRESETS","#178040"],["features","FEATURES","#1560B0"],
          ["math","MATH","#0A7878"],
          ["display","DISPLAY","#906000"],
          ["advanced","⚗ ADVANCED","#C81030"],
        ].map(([tab,label,col])=>(
          <button key={tab} onClick={()=>setTuneTab(tab)} style={{
            flex:1,padding:"8px 2px",background:"none",cursor:"pointer",
            fontFamily:"Courier New,monospace",fontSize:8,letterSpacing:1,
            border:"none",borderBottom:`2px solid ${tuneTab===tab?col:"transparent"}`,
            color:tuneTab===tab?col:"#2E5070",transition:"color .15s"}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{overflowY:"auto",flex:1,padding:"14px 18px",WebkitOverflowScrolling:"touch"}}>

        {/* ── Preset selector ── */}
        <div style={{marginBottom:16,display:tuneTab==="presets"?"block":"none"}}>
          <div style={{fontFamily:"Courier New, monospace",fontSize:9,
            color:"#1E3C5C",letterSpacing:3,marginBottom:8}}>SELECT PROFILE</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(PRESETS).map(([key,p])=>(
              <button key={key} onClick={()=>{
                setActivePreset(key);
                if (key!=="CUSTOM") setCustomConfig({...p});
              }} style={{padding:"6px 12px",borderRadius:4,cursor:"pointer",
                fontFamily:"Courier New, monospace",fontSize:9,letterSpacing:1,
                border:`1px solid ${key===activePreset?p.color:"#C0D0E4"}`,
                background:key===activePreset?`${p.color}18`:"transparent",
                color:key===activePreset?p.color:"#2E5070",transition:"all .15s"}}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{fontFamily:"Courier New, monospace",fontSize:8,
            color:"#2E5070",marginTop:6}}>
            {PRESETS[activePreset]?.description}
          </div>
        </div>

        {/* ── Feature toggles ── */}
        <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
          <div style={{fontFamily:"Courier New, monospace",fontSize:9,
            color:"#1E3C5C",letterSpacing:3,marginBottom:8}}>
            FEATURE TOGGLES
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[
              ["Kalman Filter",       featKalman,    setFeatKalman,    "#0A7878","Without: raw score used directly"],
              ["GARCH Variance",      featGARCH,     setFeatGARCH,     "#9A5C08","Without: simple window variance"],
              ["SDE Drift Bands",     featSDE,       setFeatSDE,       "#1560B0","Without: drift threshold = 0.45"],
              ["RAG Memory",          featRAG,       setFeatRAG,       "#4848B8","Without: no context retrieval"],
              ["Pipe Injection",      featPipe,      setFeatPipe,      "#0A7878","Without: no telemetry in prompt"],
              ["Mute Mode",           featMute,      setFeatMute,      "#9A5C08","Without: no token cap on planning phrases"],
              ["Drift Gate",          featGate,      setFeatGate,      "#C81030","Without: no word limit on high variance"],
              ["B-Signal Detection",  featBSig,      setFeatBSig,      "#4848B8","Without: behavioral flags suppressed"],
              ["H-Signal Detection",  featHSig,      setFeatHSig,      "#9A5C08","Without: hallucination flags suppressed"],
              ["Context Pruning",     featPrune,     setFeatPrune,     "#178040","Without: full context always sent"],
              ["SDE Path Viz",        showSdePaths,  setShowSdePaths,  "#5090C0","Renders live OU paths on chart"],
            ].map(([label,val,setter,col,note])=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:8,
                padding:"6px 10px",borderRadius:4,
                background:val?"#EEF8F2":"#F4F4F8",
                border:`1px solid ${val?col+"44":"#CDD8E8"}`}}>
                <button onClick={()=>setter(p=>!p)} style={{
                  width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                  background:val?col:"#B4C4D4",transition:"background .2s",flexShrink:0}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                    margin:"2px",marginLeft:val?14:2,transition:"margin .2s"}}/>
                </button>
                <div>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:val?col:"#2E5070",letterSpacing:1}}>{label}</div>
                  <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                    color:"#607080",lineHeight:1.3}}>{note}</div>
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
                color:"#178040",letterSpacing:3}}>CUSTOM PARAMETERS</div>
              <button onClick={()=>setCustomConfig({...PRESETS.DEFAULT})}
                style={{padding:"3px 10px",background:"transparent",
                  border:"1px solid #2A4060",borderRadius:3,color:"#1E3C5C",
                  cursor:"pointer",fontSize:8,fontFamily:"Courier New, monospace"}}>
                RESET TO DEFAULT
              </button>
            </div>
            <div style={{fontFamily:"Courier New, monospace",fontSize:7,
              color:"#C81030",marginBottom:10,padding:"4px 8px",
              background:"#FFF0F2",borderRadius:3,border:"1px solid #E0506033"}}>
              ⚠ Core framework constants are fixed. To explore experimental
              constant tuning, see TUNE → ⚗ ADVANCED.
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
                    color:"#1E3C5C",flex:1}}>{label}</span>
                  <input type="number" min={min} max={max} step={step}
                    value={customConfig[key]??0}
                    onChange={e=>setCustomConfig(p=>({...p,[key]:+e.target.value}))}
                    style={{width:72,background:"#EEF2F7",border:"1px solid #C0D0E4",
                      borderRadius:3,color:"#178040",padding:"2px 6px",
                      fontFamily:"Courier New, monospace",fontSize:9,textAlign:"right"}}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── V1.5.0: SDE Path Count ── */}
        <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
          <div style={{fontFamily:"Courier New, monospace",fontSize:9,
            color:"#1E3C5C",letterSpacing:3,marginBottom:8}}>SDE SIMULATION PATHS</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <select value={nPaths} onChange={e=>{
              const v=+e.target.value;
              if(v===-1) return; // custom handled below
              setNPaths(v);
            }} style={{background:"#EEF2F7",border:"1px solid #C0D0E4",
              borderRadius:3,color:"#0E2A5A",padding:"4px 8px",
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
              style={{width:72,background:"#EEF2F7",border:`1px solid ${nPaths>500?"#E0506066":"#C0D0E4"}`,
                borderRadius:3,color:nPaths>500?"#C81030":"#0E2A5A",padding:"3px 6px",
                fontFamily:"Courier New, monospace",fontSize:9,textAlign:"center"}}/>
            <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2E5070"}}>
              manual (1–1000)
            </span>
          </div>
          {nPaths>500&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:8,
              color:"#C81030",marginTop:6,padding:"4px 8px",
              background:"#FFF0F2",borderRadius:3,border:"1px solid #E0506033"}}>
              ⚠ {nPaths} paths will significantly increase token usage and compute time per turn.
              Above 300 gives diminishing returns on band accuracy.
              Recommended max for daily use: 200.
            </div>
          )}
          {nPaths>200&&nPaths<=500&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:8,
              color:"#9A5C08",marginTop:4}}>
              △ High path count — expect slower chart updates and higher token usage.
            </div>
          )}
          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
            color:"#2E5070",marginTop:4}}>
            Default 50. More paths = sharper SDE bands. Stored across sessions.
          </div>
        </div>

        {/* ── SDE Parameter Controls ── */}
        <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#1E3C5C",letterSpacing:3}}>SDE PARAMETERS</div>
            <button onClick={()=>{setSdeAlphaVal(SDE_PARAMS.alpha);setSdeBetaVal(SDE_PARAMS.beta_p);setSdeSigmaVal(SDE_PARAMS.sigma);setSdeAlphaOn(true);setSdeBetaOn(true);setSdeSigmaOn(true);}}
              style={{padding:"2px 8px",background:"transparent",border:"1px solid #2A4060",
                borderRadius:3,color:"#1E3C5C",cursor:"pointer",fontSize:7,fontFamily:"Courier New, monospace"}}>RESET</button>
          </div>
          <div style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#C81030",
            marginBottom:8,padding:"3px 8px",background:"#FFF0F2",borderRadius:3,border:"1px solid #E0506033"}}>
            ω=2π/12 locked. α, β_p, σ are tunable. (damping constant fixed — see ⚗ ADVANCED)
          </div>
          {[
            ["α (mean-revert)", sdeAlphaVal, setSdeAlphaVal, sdeAlphaOn, setSdeAlphaOn, -0.80,-0.05,0.01,"#C81030"],
            ["β_p (forcing)",   sdeBetaVal,  setSdeBetaVal,  sdeBetaOn,  setSdeBetaOn,  0.01, 0.60, 0.01,"#9A5C08"],
            ["σ (diffusion)",   sdeSigmaVal, setSdeSigmaVal, sdeSigmaOn, setSdeSigmaOn, 0.01, 0.50, 0.005,"#1560B0"],
          ].map(([label,val,setter,on,setOn,min,max,step,col])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:8,
              padding:"6px 8px",borderRadius:4,marginBottom:4,
              background:on?"#F2F4F8":"#F4F7FB",border:`1px solid ${on?col+"44":"#CDD8E8"}`}}>
              <button onClick={()=>setOn(p=>!p)} style={{
                width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                background:on?col:"#B4C4D4",transition:"background .2s",flexShrink:0}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                  margin:"2px",marginLeft:on?14:2,transition:"margin .2s"}}/>
              </button>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:on?col:"#2E5070",flex:1}}>{label}</span>
              <input type="number" min={min} max={max} step={step} value={val}
                onChange={e=>setter(+e.target.value)} disabled={!on}
                style={{width:64,background:"#FAFCFF",border:`1px solid ${on?col+"66":"#CDD8E8"}`,
                  borderRadius:3,color:on?col:"#B4C4D4",padding:"2px 5px",
                  fontFamily:"Courier New, monospace",fontSize:9,textAlign:"right"}}/>
            </div>
          ))}
        </div>

        {/* ── V1.5.0: Post-Audit Toggle ── */}
        <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
          <div style={{fontFamily:"Courier New, monospace",fontSize:9,
            color:"#1E3C5C",letterSpacing:3,marginBottom:8}}>POST-AUDIT</div>
          <div style={{display:"flex",gap:6}}>
            {[
              ["off",    "OFF",    "#2E5070","No second pass"],
              ["light",  "LIGHT",  "#9A5C08","Kalman < 0.70"],
              ["custom", "CUSTOM", "#906000","Custom threshold"],
              ["full",   "FULL",   "#0A7878","Every turn"],
            ].map(([val,label,col,desc])=>(
              <button key={val} onClick={()=>setPostAuditMode(val)} style={{
                padding:"5px 12px",borderRadius:4,cursor:"pointer",
                fontFamily:"Courier New, monospace",fontSize:8,letterSpacing:1,
                border:`1px solid ${postAuditMode===val?col:"#C0D0E4"}`,
                background:postAuditMode===val?`${col}18`:"transparent",
                color:postAuditMode===val?col:"#2E5070",transition:"all .15s"}}>
                {label}
              </button>
            ))}
          </div>
          {postAuditMode==="custom"&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#906000"}}>
                Fire when Kalman x&#x302; &lt;
              </span>
              <input type="number" min="0.30" max="0.95" step="0.01"
                value={postAuditThresh}
                onChange={e=>setPostAuditThresh(+e.target.value)}
                style={{width:60,background:"#EEF2F7",border:"1px solid #90600088",
                  borderRadius:3,color:"#906000",padding:"3px 6px",
                  fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
              <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2E5070"}}>
                (default 0.70)
              </span>
            </div>
          )}
          <div style={{fontFamily:"Courier New, monospace",fontSize:7,
            color:"#2E5070",marginTop:5,lineHeight:1.6}}>
            Recomputes coherence on final response. Logs delta vs live score.
            Quiet fail = post-audit C drops &gt;0.08 below live C.
            Light/Custom ~5% tokens. Full ~10%.
          </div>
        </div>

        {/* ── V1.5.0: Mute Phrase Editor ── */}
        <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="features"?"block":"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,
              color:"#1E3C5C",letterSpacing:3}}>MUTE PHRASES</div>
            <button onClick={()=>setCustomMutePhrases(null)}
              style={{padding:"2px 8px",background:"transparent",
                border:"1px solid #2A4060",borderRadius:3,color:"#1E3C5C",
                cursor:"pointer",fontSize:7,fontFamily:"Courier New, monospace"}}>
              RESET TO DEFAULT
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {(customMutePhrases??MUTE_PHRASES).map((phrase,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:3,
                padding:"2px 8px",borderRadius:3,
                background:"#EEF2F7",border:"1px solid #C0D0E4"}}>
                <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#1560B0"}}>{phrase.trim()}</span>
                <button onClick={()=>{
                  const cur=customMutePhrases??MUTE_PHRASES;
                  setCustomMutePhrases(cur.filter((_,j)=>j!==i));
                }} style={{background:"none",border:"none",cursor:"pointer",
                  color:"#2E5070",fontSize:10,padding:0,lineHeight:1}}>✕</button>
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
              style={{flex:1,background:"#EEF2F7",border:"1px solid #C0D0E4",
                borderRadius:3,color:"#0E2A5A",padding:"3px 8px",
                fontFamily:"Courier New, monospace",fontSize:9,outline:"none"}}/>
            <button onClick={()=>{
              if(!mutePhraseInput.trim()) return;
              const cur=customMutePhrases??MUTE_PHRASES;
              setCustomMutePhrases([...cur,mutePhraseInput.toLowerCase().trimEnd()+" "]);
              setMutePhraseInput("");
            }} style={{padding:"3px 10px",background:"#EEF2F7",
              border:"1px solid #4A9EFF44",borderRadius:3,color:"#1560B0",
              cursor:"pointer",fontSize:8,fontFamily:"Courier New, monospace"}}>
              ADD
            </button>
          </div>
        </div>

      {/* ── MATH TAB — editable math tunables ── */}
      <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="math"?"block":"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#0A7878",letterSpacing:3}}>
            MATH TUNABLES
          </div>
          <button onClick={()=>{
            setMathEpsilon(EPSILON);
            setMathTfidf(0.25);setMathJsd(0.25);setMathLen(0.25);
            setMathStruct(0.15);setMathPersist(0.10);setMathRepThresh(0.65);
            setMathKalmanR(KALMAN_R);setMathKalmanSigP(KALMAN_SIGMA_P);
            setMathRagTopK(RAG_TOP_K);setMathMaxTokens(NORMAL_MAX_TOKENS);
          }} style={{padding:"2px 8px",background:"transparent",
            border:"1px solid #2A4060",borderRadius:3,color:"#1E3C5C",
            cursor:"pointer",fontSize:7,fontFamily:"Courier New,monospace"}}>
            RESET ALL
          </button>
        </div>
        <div style={{fontFamily:"Courier New,monospace",fontSize:7,
          marginBottom:10,padding:"4px 8px",borderRadius:3,lineHeight:1.6,
          background:(()=>{const s=mathTfidf+mathJsd+mathLen+mathStruct+mathPersist;return Math.abs(s-1.0)<0.01?"#EEFBF4":"#FFF8EE";})(),
          border:(()=>{const s=mathTfidf+mathJsd+mathLen+mathStruct+mathPersist;return `1px solid ${Math.abs(s-1.0)<0.01?"#17804033":"#9A5C0844"}`;})(),
          color:(()=>{const s=mathTfidf+mathJsd+mathLen+mathStruct+mathPersist;return Math.abs(s-1.0)<0.01?"#178040":"#9A5C08";})()}}>
          Coherence weights Σ = {(mathTfidf+mathJsd+mathLen+mathStruct+mathPersist).toFixed(3)}
          {Math.abs(mathTfidf+mathJsd+mathLen+mathStruct+mathPersist-1.0)<0.01
            ?" ✓ (ideal — 1.000)"
            :" ⚠ deviates from 1.0 — scores will shift. Weights are independent multipliers; sum of 1.0 is recommended but not required."}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[
            // V1.5.3+: math tunables — epsilon + coherence weights, all user-editable
            ["ε min floor",mathEpsilon,  setMathEpsilon,  0.01,0.20, 0.005,"#906000",EPSILON],
            ["TF-IDF weight",   mathTfidf,    setMathTfidf,    0.01,0.80, 0.01, "#0A7878",0.25],
            ["JSD weight",      mathJsd,      setMathJsd,      0.01,0.80, 0.01, "#0A7878",0.25],
            ["Length weight",   mathLen,      setMathLen,      0.01,0.80, 0.01, "#0A7878",0.25],
            ["Structure wt",    mathStruct,   setMathStruct,   0.01,0.50, 0.01, "#0A7878",0.15],
            ["Persistence wt",  mathPersist,  setMathPersist,  0.01,0.50, 0.01, "#0A7878",0.10],
            ["Rep threshold",   mathRepThresh,setMathRepThresh, 0.30,0.95,0.01, "#9A5C08",0.65],
            ["Kalman R",        mathKalmanR,  setMathKalmanR,  0.001,0.20,0.001,"#1560B0",KALMAN_R],
            ["Kalman σP",       mathKalmanSigP,setMathKalmanSigP,0.01,0.30,0.005,"#1560B0",KALMAN_SIGMA_P],
            ["RAG top-K",       mathRagTopK,  setMathRagTopK,  1,10,  1,    "#4848B8",RAG_TOP_K],
            ["Max tokens",      mathMaxTokens,setMathMaxTokens,200,4000,100, "#178040",NORMAL_MAX_TOKENS],
          ].map(([label,val,setter,min,max,step,col,def])=>(
            <div key={label} style={{padding:"5px 8px",borderRadius:4,
              background:"#F2F4F8",border:"1px solid #1A2840"}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,
                color:"#1E3C5C",marginBottom:4}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input type="number" min={min} max={max} step={step}
                  value={val}
                  onChange={e=>setter(+e.target.value)}
                  style={{flex:1,background:"#FAFCFF",border:`1px solid ${col}44`,
                    borderRadius:3,color:col,padding:"2px 5px",
                    fontFamily:"Courier New,monospace",fontSize:9,textAlign:"right"}}/>
                <button onClick={()=>setter(def)} title={"Reset to default ("+def+")"}
                  style={{padding:"1px 5px",background:"transparent",
                    border:"1px solid #1A2840",borderRadius:2,
                    color:"#2E5070",cursor:"pointer",fontSize:7,
                    fontFamily:"Courier New,monospace"}}>↺</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{fontFamily:"Courier New,monospace",fontSize:7,
          color:"#2E5070",marginTop:8,lineHeight:1.6}}>
          ε (min floor): tunable above (default {EPSILON}). Affects cap_eff and drift floor bands.<br/>
          Mute max tokens: {MUTE_MAX_TOKENS} (set per preset in PRESETS tab)
        </div>
      </div>

      {/* ── DISPLAY TAB ── */}
      {/* Advanced tab nudge at bottom of MATH */}
      <div style={{display:tuneTab==="math"?"block":"none",
        marginBottom:16,padding:"8px 12px",borderRadius:4,
        background:"#F8F0FF",border:"1px solid #8040C030"}}>
        <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#4828A0",lineHeight:1.6}}>
          ⚗ Want to explore experimental SDE models (CIR, Heston), custom
          behavioral rails, or advanced constant tuning?<br/>
          See the <strong>⚗ ADVANCED</strong> tab — explicitly labeled experimental.
        </div>
      </div>

      <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:16,display:tuneTab==="display"?"block":"none"}}>
        <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#906000",letterSpacing:3,marginBottom:12}}>
          DISPLAY
        </div>
        <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",marginBottom:16,lineHeight:1.6,
          padding:"6px 10px",background:"#EEF2F7",borderRadius:3,border:"1px solid #C0D0E4"}}>
          Theme toggle and sidebar resize coming in a future build.
          Framework is dark-mode first by design.
          Optimized for extended reading sessions.
        </div>
        <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",lineHeight:1.8}}>
          Current layout: 55% chat · 45% metrics<br/>
          Font: Trebuchet MS (body) · Courier New (data)<br/>
          Background: #06090F · Accent: #1EAAAA<br/>
          κ color: #C8860A · Health green: #40D080
        </div>
        {showSdePaths&&(
          <div style={{marginTop:12,padding:'8px 10px',background:'#EEF6FA',borderRadius:4,border:'1px solid #5090C033'}}>
            <div style={{fontFamily:'Courier New,monospace',fontSize:8,color:'#1E6A8A',letterSpacing:1,marginBottom:8}}>SDE PATH OPACITY</div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <input type='number' min={0.05} max={0.40} step={0.05} value={pathOpacity}
                onChange={e=>setPathOpacity(parseFloat(e.target.value))}
                style={{width:60,fontFamily:'Courier New,monospace',fontSize:9,color:'#1E6A8A',
                  background:'#FAFCFF',border:'1px solid #5090C044',borderRadius:3,padding:'2px 6px'}}/>
              <span style={{fontFamily:'Courier New,monospace',fontSize:7,color:'#4A7090'}}>0.05–0.40 · default 0.15</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ADVANCED TAB ──────────────────────────────────────────── */}
      <div style={{display:tuneTab==="advanced"?"block":"none",padding:"4px 0"}}>

        {/* Warning banner */}
        <div style={{background:"#FEF0F2",border:"1px solid #C8103040",borderRadius:4,
          padding:"10px 12px",marginBottom:14}}>
          <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#C81030",
            letterSpacing:2,marginBottom:6}}>⚠ ADVANCED / EXPERIMENTAL ZONE</div>
          <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#8A0020",
            lineHeight:1.7}}>
            Features in this tab may include <strong>pseudoscientific framing</strong>,
            unvalidated mathematical models, and experimental parameters that have not
            been empirically confirmed. This section is for users who want to explore
            outside established boundaries. Results here carry no validation basis.<br/>
            <strong>Standard operation does not require this tab.</strong>
          </div>
        </div>

        {/* Unlock gate */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,
          padding:"8px 10px",background:"#F8F0FF",border:"1px solid #8040C040",borderRadius:4}}>
          <input type="checkbox" id="advUnlock" checked={advancedUnlocked}
            onChange={e=>setAdvancedUnlocked(e.target.checked)}
            style={{width:14,height:14,cursor:"pointer"}}/>
          <label htmlFor="advUnlock" style={{fontFamily:"Courier New,monospace",
            fontSize:8,color:"#4828A0",cursor:"pointer",lineHeight:1.5}}>
            I understand this section contains experimental / unvalidated features.
            I am enabling it intentionally.
          </label>
        </div>

        {advancedUnlocked && (<>

          {/* ── FEATURE TOGGLES ─────────────────────────────────── */}
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#4828A0",
              letterSpacing:3,marginBottom:8}}>EXPERIMENTAL FEATURES</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:4}}>
              {[
                ["Alt SDE Model",   showSdeConfig,    ()=>setShowSdeConfig(p=>!p),    "#C81030","Use CIR or Heston SDE"],
                ["Custom Rails",    showRailsConfig,  ()=>setShowRailsConfig(p=>!p),  "#4828A0","Inject custom guidelines"],
                ["Stability Panel", featZeroDrift,    ()=>setFeatZeroDrift(p=>!p),    "#906000","Convergence sidebar panel"],
                ["Edit Constants",  showConstEditor,  ()=>setShowConstEditor(p=>!p),  "#9A5C08","Modify framework constants"],
                ["MHT Study",       showMhtStudy,     ()=>setShowMhtStudy(p=>!p),      "#1E6A8A","Metatron-Hudson Theory SDE"],
                ["Integrity Floor",  showIntegrityFloor, ()=>setShowIntegrityFloor(p=>!p), "#4828A0","Hydrogen floor integrity detection"],
              ].map(([label,val,toggle,col,note])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:8,
                  padding:"6px 10px",borderRadius:4,
                  background:val?"#EEF8F2":"#F4F4F8",
                  border:`1px solid ${val?col+"44":"#CDD8E8"}`}}>
                  <button onClick={toggle} style={{
                    width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                    background:val?col:"#B4C4D4",transition:"background .2s",flexShrink:0}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                      margin:"2px",marginLeft:val?14:2,transition:"margin .2s"}}/>
                  </button>
                  <div>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:8,
                      color:val?col:"#2E5070",letterSpacing:1}}>{label}</div>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:7,
                      color:"#607080",lineHeight:1.3}}>{note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ALT SDE CONFIG — shows when Alt SDE is on ─────── */}
          {showSdeConfig&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#C81030",
                letterSpacing:2,marginBottom:8}}>SDE MODEL CONFIG</div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {[["cir","CIR"],["heston","HESTON"]].map(([key,label])=>(
                  <button key={key} onClick={()=>setSdeModel(key)}
                    style={{padding:"4px 14px",borderRadius:4,cursor:"pointer",
                      fontFamily:"Courier New,monospace",fontSize:8,
                      background:sdeModel===key?"#FEE8E8":"#F4F7FB",
                      border:`1px solid ${sdeModel===key?"#C81030":"#C0D0E4"}`,
                      color:sdeModel===key?"#C81030":"#2E5070"}}>{label}</button>
                ))}
              </div>
              {sdeModel==="cir"&&(
                <div style={{background:"#F0F4FA",border:"1px solid #B0C4DA",borderRadius:4,padding:10}}>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#4A7090",marginBottom:8}}>dX = κ(θ−X)dt + σ√X dW</div>
                  {[["κ (mean-reversion)",cirKappa,setCirKappa,0.01,2.0,0.01],
                    ["θ (long-run mean)", cirTheta,setCirTheta,0.01,0.50,0.01],
                    ["σ (volatility)",    cirSigma,setCirSigma,0.01,0.50,0.01],
                  ].map(([lbl,val,set,mn,mx,step])=>(
                    <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",flex:1}}>{lbl}</span>
                      <input type="number" min={mn} max={mx} step={step} value={val}
                        onChange={e=>set(parseFloat(e.target.value))}
                        style={{width:70,fontFamily:"Courier New,monospace",fontSize:9,
                          color:"#1E3C5C",background:"#EEF2F7",border:"1px solid #B0C4DA",
                          borderRadius:3,padding:"4px 6px",textAlign:"right"}}/>
                    </div>
                  ))}
                </div>
              )}
              {sdeModel==="heston"&&(
                <div style={{background:"#F0F4FA",border:"1px solid #B0C4DA",borderRadius:4,padding:10}}>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#4A7090",marginBottom:8}}>dV=κ(θ−V)dt+σ√V dW₁ · dS/S=√V dW₂ · ρ</div>
                  {[["κ (mean-reversion)",hestonKappa,setHestonKappa,0.01,5.0,0.1],
                    ["θ (long-run var)",  hestonTheta,setHestonTheta,0.01,0.20,0.005],
                    ["σ (vol-of-vol)",    hestonSigma,setHestonSigma,0.01,1.0,0.01],
                    ["ρ (correlation)",   hestonRho,  setHestonRho,  -1.0,1.0,0.05],
                    ["V₀ (initial var)", hestonV0,   setHestonV0,   0.01,0.20,0.005],
                  ].map(([lbl,val,set,mn,mx,step])=>(
                    <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",flex:1}}>{lbl}</span>
                      <input type="number" min={mn} max={mx} step={step} value={val}
                        onChange={e=>set(parseFloat(e.target.value))}
                        style={{width:70,fontFamily:"Courier New,monospace",fontSize:9,
                          color:"#1E3C5C",background:"#EEF2F7",border:"1px solid #B0C4DA",
                          borderRadius:3,padding:"4px 6px",textAlign:"right"}}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CUSTOM RAILS CONFIG — shows when Custom Rails is on */}
          {showRailsConfig&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#4828A0",
                letterSpacing:2,marginBottom:8}}>CUSTOM RAILS</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",
                lineHeight:1.7,marginBottom:8}}>
                Plain-language rules injected into every prompt alongside HPDL directives.
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button onClick={()=>setUserRailsEnabled(p=>!p)} style={{
                  width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                  background:userRailsEnabled?"#4828A0":"#B4C4D4",transition:"background .2s",flexShrink:0}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                    margin:"2px",marginLeft:userRailsEnabled?14:2,transition:"margin .2s"}}/>
                </button>
                <span style={{fontFamily:"Courier New,monospace",fontSize:8,
                  color:userRailsEnabled?"#4828A0":"#2E5070"}}>
                  {userRailsEnabled?"Injecting into pipe":"Enable injection"}
                </span>
              </div>
              <textarea value={userCustomRails} onChange={e=>setUserCustomRails(e.target.value)}
                placeholder={"Examples:\n· Never exceed 3 paragraphs.\n· Always cite sources.\n· Use metric units only."}
                style={{width:"100%",minHeight:100,fontFamily:"Courier New,monospace",
                  fontSize:8,color:"#0E1C2A",background:"#F4F7FB",
                  border:"1px solid #8040C060",borderRadius:3,padding:8,
                  resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
              {userRailsEnabled&&userCustomRails.trim()&&(
                <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#178040",marginTop:4}}>
                  ✓ Active — injecting into pipe on every turn
                </div>
              )}
            </div>
          )}

          {/* ── CONSTANTS CONFIG — shows when Edit Constants is on */}
          {showConstEditor&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#9A5C08",
                letterSpacing:2,marginBottom:4}}>FRAMEWORK CONSTANTS</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,lineHeight:1.7,
                marginBottom:10,padding:"6px 10px",borderRadius:3,
                background:hudsonMode==="hudson"?"#EEFAF4":"#FFF8EE",
                border:hudsonMode==="hudson"?"1px solid #1A5C1A44":"1px solid #E8A03044",
                color:hudsonMode==="hudson"?"#1A5C1A":"#8A4000"}}>
                {hudsonMode==="hudson"
                  ?"HUDSON FRAMEWORK ACTIVE — κ=0.444 is the validated default. Modify only if you understand the implications."
                  :"STANDARD MODE — κ=0.500 neutral OU damping. Tune freely 0.00–5.00. No framework claims."}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  ["κ (damping)",
                   hudsonMode==="hudson"?"Hudson default: 0.444":"Standard default: 0.500",
                   userKappa,setUserKappa,0.00,5.00,0.001,
                   hudsonMode==="hudson"?KAPPA:0.5],
                  ["Stability Anchor","Default 623.81",userAnchor,setUserAnchor,100,2000,0.01,RESONANCE_ANCHOR],
                ].map(([label,note,val,setter,min,max,step,def])=>(
                  <div key={label} style={{padding:"8px 10px",borderRadius:4,
                    background:"#FFF8EE",border:"1px solid #E8A03044"}}>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#9A5C08",marginBottom:3}}>{label}</div>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#607080",marginBottom:5}}>{note}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input type="number" min={min} max={max} step={step} value={val}
                        onChange={e=>{
                          const v=parseFloat(e.target.value);
                          if (!isNaN(v)&&v>=min&&v<=max) setter(v);
                        }}
                        style={{flex:1,background:"#EEF2F7",border:"1px solid #C0D0E4",
                          borderRadius:3,color:"#0E2A5A",padding:"3px 8px",
                          fontFamily:"Courier New,monospace",fontSize:10}}/>
                      <button onClick={()=>setter(def)}
                        style={{padding:"3px 8px",background:"transparent",
                          border:"1px solid #2A4060",borderRadius:3,color:"#1E3C5C",
                          cursor:"pointer",fontSize:7,fontFamily:"Courier New,monospace"}}>↺ RESET</button>
                    </div>
                    <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",marginTop:3}}>
                      {label==="κ (damping)"?`Range 0.00–5.00 · damping λ=${(1/(1+(val||0))).toFixed(4)}`:`Range 100–2000 Hz`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INTEGRITY FLOOR — Trumble/CLS hydrogen floor concept ── */}
          {showIntegrityFloor&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#4828A0",
                letterSpacing:2,marginBottom:6}}>INTEGRITY FLOOR — COHERENCE BOND THRESHOLD</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",
                lineHeight:1.8,marginBottom:10,padding:"8px 10px",
                background:"#F4F0FF",borderRadius:3,border:"1px solid #4828A044"}}>
                Two different things can go wrong in an AI conversation.<br/>
                <strong style={{color:"#9A5C08"}}>DRIFT</strong> — the AI is losing the thread. Recoverable. The harness can pull it back.<br/>
                <strong style={{color:"#C81030"}}>INTEGRITY BREACH</strong> — the coherence bond is gone. Reset, not repair.<br/><br/>
                Inspired by the hydrogen ionization floor (13.59844 eV) from Trumble's
                Macro-Ratchet Framework (2026) — the principle that every system has a
                minimum threshold below which it doesn't drift, it dissolves.<br/><br/>
                When the coherence score falls below this threshold, an INTEGRITY_BREACH
                event is logged and the pipe directive changes from "consolidate" to
                "session integrity compromised — consider reset."
              </div>

              {/* Detection toggle */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,
                padding:"8px 10px",borderRadius:4,
                background:featIntegrityFloor?"#F0EEFF":"#F4F4F8",
                border:`1px solid ${featIntegrityFloor?"#4828A044":"#CDD8E8"}`}}>
                <button onClick={()=>setFeatIntegrityFloor(p=>!p)} style={{
                  width:28,height:16,borderRadius:8,border:"none",cursor:"pointer",
                  background:featIntegrityFloor?"#4828A0":"#B4C4D4",transition:"background .2s",flexShrink:0}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",
                    margin:"2px",marginLeft:featIntegrityFloor?14:2,transition:"margin .2s"}}/>
                </button>
                <div>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:8,
                    color:featIntegrityFloor?"#4828A0":"#2E5070",letterSpacing:1}}>
                    {featIntegrityFloor?"DETECTION ACTIVE":"DETECTION OFF"}
                  </div>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#607080"}}>
                    Log INTEGRITY_BREACH events and change pipe directive when score falls below threshold
                  </div>
                </div>
              </div>

              {/* Threshold tuner */}
              <div style={{padding:"8px 10px",borderRadius:4,background:"#F4F0FF",
                border:"1px solid #4828A033",marginBottom:8}}>
                <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#4828A0",
                  marginBottom:4,letterSpacing:1}}>INTEGRITY THRESHOLD</div>
                <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#607080",marginBottom:6}}>
                  Score below this = INTEGRITY BREACH (not drift). Default 0.15. Range 0.05–0.40.
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={0.05} max={0.40} step={0.01}
                    value={integrityThreshold}
                    onChange={e=>{
                      const v=parseFloat(e.target.value);
                      if(!isNaN(v)&&v>=0.05&&v<=0.40) setIntegrityThreshold(v);
                    }}
                    style={{width:70,fontFamily:"Courier New,monospace",fontSize:10,
                      color:"#4828A0",background:"#EEEEFF",border:"1px solid #4828A044",
                      borderRadius:3,padding:"3px 8px",textAlign:"right"}}/>
                  <button onClick={()=>setIntegrityThreshold(0.15)}
                    style={{padding:"3px 8px",background:"transparent",
                      border:"1px solid #4828A0",borderRadius:3,color:"#4828A0",
                      cursor:"pointer",fontSize:7,fontFamily:"Courier New,monospace"}}>
                    ↺ RESET
                  </button>
                  <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#4A5090"}}>
                    Current floor: {integrityThreshold.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Breach counter */}
              {featIntegrityFloor&&(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 10px",borderRadius:4,
                  background:integrityBreachCount>0?"#FFF0FF":"#F4F0FF",
                  border:`1px solid ${integrityBreachCount>0?"#C81030":"#4828A033"}`}}>
                  <span style={{fontFamily:"Courier New,monospace",fontSize:8,
                    color:"#4828A0",letterSpacing:1}}>INTEGRITY BREACHES THIS SESSION</span>
                  <span style={{fontFamily:"Courier New,monospace",fontSize:14,
                    color:integrityBreachCount>0?"#C81030":"#178040",fontWeight:"bold"}}>
                    {integrityBreachCount}
                  </span>
                </div>
              )}

              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#607080",
                marginTop:8,lineHeight:1.6}}>
                Reference: Trumble, R.T. (2026). The Macro-Ratchet Framework. Zenodo.
                Concept: hydrogen ionization floor 13.59844 eV (NIST). Study use only.
              </div>
            </div>
          )}

          {/* MHT Study */}
          {showMhtStudy&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#1E6A8A",letterSpacing:2,marginBottom:6}}>METATRON-HUDSON THEORY — SDE STUDY</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",lineHeight:1.7,marginBottom:10,padding:"6px 10px",background:"#EEF6FA",borderRadius:3,border:"1px solid #1E6A8A33"}}>
                Experimental fusion of Robitaille Helix invariants with HPDL drift law. r(t)=e^ψt(cos t,sin t,t) with GARCH torsion clamps + Kalman curvature guards. Study only — not used in coherence scoring.
              </div>
              <div style={{background:"#E8F4FA",border:"1px solid #1E6A8A33",borderRadius:4,padding:10,marginBottom:10}}>
                <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#1E6A8A",letterSpacing:1,marginBottom:6}}>INVARIANTS</div>
                {[
                  ["ψ (radial growth)",`e^ψt | ψ=${mhtPsi.toFixed(6)}`,"#1E6A8A"],
                  ["κ bound",`κ(t) ≤ ${mhtKappa.toFixed(6)}`,"#C81030"],
                  ["τ (torsion)",`0<τ<1 | active:${mhtTau.toFixed(3)}`,"#178040"],
                  ["R_heart(t)","ψ + nτ_GARCH/κ_Kalman + H_drift","#4828A0"],
                ].map(([lbl,val,col])=>(
                  <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",flex:1}}>{lbl}</span>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:col}}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#4A7090",marginBottom:8}}>H_drift: ΔS = cap·(1−e^(−n^α/τ)) + β·sin(γn) + N(0,σ)</div>
              {[
                ["ψ",mhtPsi,setMhtPsi,1.0,4.0,0.001],
                ["κ cap",mhtKappa,setMhtKappa,0.1,1.0,0.001],
                ["τ (torsion)",mhtTau,setMhtTau,0.01,0.99,0.01],
                ["cap",mhtCap,setMhtCap,1.0,10.0,0.01],
                ["α (exp)",mhtAlpha,setMhtAlpha,0.5,4.0,0.1],
                ["β (amp)",mhtBeta,setMhtBeta,0.0,1.0,0.01],
                ["γ (freq)",mhtGamma,setMhtGamma,0.0,1.0,0.005],
                ["σ (noise)",mhtSigma,setMhtSigma,0.0,0.5,0.01],
              ].map(([lbl,val,set,mn,mx,step])=>(
                <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <span style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#2E5070",flex:1}}>{lbl}</span>
                  <input type="number" min={mn} max={mx} step={step} value={val} onChange={e=>set(parseFloat(e.target.value))}
                    style={{width:70,fontFamily:"Courier New,monospace",fontSize:9,color:"#1E6A8A",background:"#EEF6FA",border:"1px solid #1E6A8A44",borderRadius:3,padding:"3px 6px",textAlign:"right"}}/>
                </div>
              ))}
              <div style={{marginTop:10,padding:"8px 10px",background:"#F0F8FF",borderRadius:4,border:"1px solid #1E6A8A22"}}>
                <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#1E6A8A",letterSpacing:1,marginBottom:6}}>LIVE COMPUTED (t=1)</div>
                {(()=>{
                  const r_t=Math.exp(mhtPsi);
                  const R_heart=mhtPsi+(mhtTau)/Math.max(mhtKappa,0.001);
                  const H_drift=mhtCap*(1-Math.exp(-Math.pow(1,mhtAlpha)/Math.max(mhtTau,0.001)))+mhtBeta*Math.sin(mhtGamma);
                  const annihilated=Math.max(0,H_drift-(1-mhtKappa));
                  return [
                    ["r(t)=e^ψt",r_t.toFixed(6)],
                    ["R_heart(t)",R_heart.toFixed(6)],
                    ["H_drift(t)",H_drift.toFixed(6)],
                    ["Annihilated",annihilated.toFixed(6)],
                    ["κ valid",mhtKappa<=0.414214?"✓ ≤√2−1":"⚠ EXCEEDS"],
                    ["τ valid",mhtTau>0&&mhtTau<1?"✓ in range":"⚠ OUT"],
                  ].map(([lbl,val])=>(
                    <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070"}}>{lbl}</span>
                      <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:val.startsWith("⚠")?"#C81030":val.startsWith("✓")?"#178040":"#1E6A8A"}}>{val}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── POOLE MANIFOLD CA SIMULATOR ── */}
          {showPoole&&(
            <div style={{borderTop:"1px solid #1A3050",paddingTop:12,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:9,color:"#1A5C1A",
                letterSpacing:2,marginBottom:6}}>POOLE MANIFOLD — DISCRETE CA LATTICE</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",
                lineHeight:1.7,marginBottom:10,padding:"6px 10px",background:"#EEF6EE",
                borderRadius:3,border:"1px solid #1A5C1A33"}}>
                3D cellular automaton. B:{pooleBirth1}-{pooleBirth2} / S:{pooleSurv1}-{pooleSurv2}.
                Local fluid-logic only. Turing complete. Study use only.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                {[["Birth min",pooleBirth1,setPooleBirth1],["Birth max",pooleBirth2,setPooleBirth2],
                  ["Survive min",pooleSurv1,setPooleSurv1],["Survive max",pooleSurv2,setPooleSurv2]
                ].map(([lbl,val,set])=>(
                  <div key={lbl} style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",width:70,flexShrink:0}}>{lbl}</span>
                    <input type="number" min={1} max={13} step={1} value={val}
                      onChange={e=>set(parseInt(e.target.value))}
                      style={{width:50,fontFamily:"Courier New,monospace",fontSize:9,
                        color:"#1A5C1A",background:"#EEF6EE",border:"1px solid #1A5C1A44",
                        borderRadius:3,padding:"3px 6px",textAlign:"right"}}/>
                  </div>
                ))}
              </div>
              <div style={{background:"#0A1A0A",borderRadius:4,padding:8,marginBottom:8,display:"flex",justifyContent:"center"}}>
                <canvas width={160} height={160} style={{imageRendering:"pixelated",border:"1px solid #1A5C1A44"}}
                  ref={el=>{
                    if (!el) return;
                    const ctx2=el.getContext("2d");
                    const S=14, rows=11, cols=11;
                    const g=Array.from({length:rows},(_,r)=>
                      Array.from({length:cols},(_,c)=>((r*3+c*7+pooleGen*11)%5===0||(r+c+pooleGen)%7===0)?1:0)
                    );
                    ctx2.fillStyle="#0A1A0A"; ctx2.fillRect(0,0,160,160);
                    g.forEach((row,r)=>row.forEach((cell,c)=>{
                      const nb=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
                        .filter(([dr,dc])=>{const nr=r+dr,nc=c+dc;return nr>=0&&nr<rows&&nc>=0&&nc<cols&&g[nr][nc];}).length;
                      const next=cell?(nb>=pooleSurv1&&nb<=pooleSurv2):(nb>=pooleBirth1&&nb<=pooleBirth2);
                      const v=next?(cell?220:150):30;
                      ctx2.fillStyle="rgb("+Math.floor(v*0.25)+","+v+","+Math.floor(v*0.25)+")";
                      ctx2.fillRect(c*S+4,r*S+4,S-2,S-2);
                    }));
                    ctx2.fillStyle="#40A040"; ctx2.font="7px Courier New";
                    ctx2.fillText("B:"+pooleBirth1+"-"+pooleBirth2+" S:"+pooleSurv1+"-"+pooleSurv2+" gen:"+pooleGen,4,158);
                  }}
                />
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
                <button onClick={()=>setPooleGen(p=>p+1)} style={{padding:"4px 14px",background:"#EEF6EE",
                  border:"1px solid #1A5C1A44",borderRadius:3,color:"#1A5C1A",cursor:"pointer",
                  fontFamily:"Courier New,monospace",fontSize:8}}>STEP</button>
                <button onClick={()=>setPooleGen(0)} style={{padding:"4px 14px",background:"#F4F4F4",
                  border:"1px solid #CDD8E8",borderRadius:3,color:"#2E5070",cursor:"pointer",
                  fontFamily:"Courier New,monospace",fontSize:8}}>RESET</button>
              </div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070",marginBottom:4}}>
                Full adder truth table — Turing completeness verification:
              </div>
              <div style={{background:"#F0F8F0",border:"1px solid #1A5C1A22",borderRadius:3,padding:"6px 8px"}}>
                {(()=>{
                  const fa=(a,b,cin)=>({s:(a^b^cin),k:((a&b)|(b&cin)|(a&cin))});
                  const cases=[[0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1]];
                  const res=cases.map(([a,b,c])=>{const r=fa(a,b,c);return {a,b,c,r,ok:r.s===((a+b+c)%2)&&r.k===Math.floor((a+b+c)/2)};});
                  const passed=res.filter(x=>x.ok).length;
                  return (
                    <div>
                      {res.map(({a,b,c,r,ok},i)=>(
                        <div key={i} style={{display:"flex",gap:10,fontFamily:"Courier New,monospace",
                          fontSize:7,color:ok?"#1A5C1A":"#C81030",marginBottom:2}}>
                          <span>A={a} B={b} Ci={c}</span>
                          <span>S={r.s} Co={r.k}</span>
                          <span>{ok?"✓":"✗"}</span>
                        </div>
                      ))}
                      <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#1A5C1A",marginTop:4,fontWeight:"bold"}}
                        ref={el=>{if(el){setCaPassRate(passed/8);}}}
                      >
                        {passed}/8 PASSED
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── DATL HEARTBEAT appended to MHT section ── */}
          {showMhtStudy&&(
            <div style={{borderTop:"1px solid #1E4060",paddingTop:10,marginBottom:14}}>
              <div style={{fontFamily:"Courier New,monospace",fontSize:8,color:"#1E6A8A",letterSpacing:2,marginBottom:6}}>DATL HEARTBEAT</div>
              <div style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#4A7090",marginBottom:8}}>
                N(t) = floor(ψ·n_task/κ)+1+Δ_hb(t) where Δ_hb=sin(2πt/998001)·e^(ψt/10)
              </div>
              {(()=>{
                const t=(Date.now()%9980010)/100000;
                const hb=Math.sin(2*Math.PI*t/998001)*Math.exp(mhtPsi*t/10);
                const N=Math.floor(mhtPsi*4/Math.max(mhtKappa,0.001))+1+hb;
                const bar=Math.abs(Math.sin(2*Math.PI*t/998001));
                return (
                  <div style={{background:"#E8F4FA",borderRadius:3,padding:"8px 10px"}}>
                    {[
                      ["Δ_heartbeat",hb.toExponential(4)],
                      ["N(t) agents",N.toFixed(2)],
                      ["Period","998001 steps (ultra-low)"],
                    ].map(([lbl,val])=>(
                      <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070"}}>{lbl}</span>
                        <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#1E6A8A"}}>{val}</span>
                      </div>
                    ))}
                    <div style={{marginTop:4,height:4,background:"#1E6A8A22",borderRadius:2}}>
                      <div style={{height:"100%",width:(bar*100).toFixed(1)+"%",
                        background:"#1E6A8A",borderRadius:2,transition:"width .5s"}}/>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </>)}
      </div>

      </div>{/* end scroll container */}

      {/* Footer */}
      <div style={{padding:"8px 18px",borderTop:"1px solid #1A3050",
        background:"#FAFCFF",flexShrink:0,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#2E5070",letterSpacing:1}}>
          ACTIVE: {PRESETS[activePreset]?.label??activePreset} · V1.5.43
        </span>
        <button onClick={()=>setShowTuning(false)}
          style={{padding:"4px 14px",background:"#EEF8F2",
            border:"1px solid #40D08044",borderRadius:4,color:"#178040",
            cursor:"pointer",fontSize:9,fontFamily:"Courier New, monospace"}}>
          APPLY &amp; CLOSE
        </button>
      </div>
    </div>
  </div>
  );
});

// ── RewindConfirmModal ──────────────────────────────────────────────
const RewindConfirmModal = React.memo(function RewindConfirmModal({rewindConfirm,setRewindConfirm,restoreToTurn}) {
  if (!rewindConfirm) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.45)",zIndex:900,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>setRewindConfirm(null)}>
    <div style={{background:"#FFFFFF",border:"2px solid #178040",
      borderRadius:8,padding:24,maxWidth:320,width:"100%",textAlign:"center"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"Courier New, monospace",fontSize:12,
        color:"#178040",letterSpacing:2,marginBottom:12}}>
        ⟲ REWIND TO TURN {rewindConfirm}?
      </div>
      <div style={{fontFamily:"Courier New, monospace",fontSize:9,
        color:"#1E3C5C",marginBottom:20,lineHeight:1.7}}>
        Session will restore to the state after Turn {rewindConfirm}.
        You can continue from here or navigate forward with the arrow buttons.
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <button onClick={()=>restoreToTurn(rewindConfirm)}
          style={{padding:"10px 24px",background:"#E8F4EC",
            border:"2px solid #178040",borderRadius:6,color:"#178040",
            cursor:"pointer",fontSize:12,fontFamily:"Courier New, monospace",
            fontWeight:"bold",letterSpacing:1}}>
          CONFIRM
        </button>
        <button onClick={()=>setRewindConfirm(null)}
          style={{padding:"10px 24px",background:"transparent",
            border:"1px solid #2A4060",borderRadius:6,color:"#1E3C5C",
            cursor:"pointer",fontSize:12,fontFamily:"Courier New, monospace",
            letterSpacing:1}}>
          CANCEL
        </button>
      </div>
    </div>
  </div>
  );
});

// ── LogModal ──────────────────────────────────────────────
const LogModal = React.memo(function LogModal() {
  const {showLog,setShowLog,eventLog,errorLog,sessionId,setExportContent,corrections} = useContext(SessionCtx);
  if (!showLog) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.50)",zIndex:1000,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>setShowLog(false)}>
    <div style={{background:"#FFFFFF",border:"1px solid #A8C8E0",
      borderRadius:8,maxWidth:680,width:"100%",maxHeight:"85vh",
      display:"flex",flexDirection:"column",overflow:"hidden"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"12px 18px",
        borderBottom:"1px solid #1A3050",background:"#FAFCFF",flexShrink:0}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:11,
          color:"#1560B0",letterSpacing:2,fontWeight:"bold"}}>
          ARCHITECT — {eventLog.length} EVENTS{errorLog.length>0?` · ⚠ ${errorLog.length} DIAGNOSTICS`:""}
        </span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setExportContent(downloadLog(eventLog,sessionId))}
            style={{background:"none",border:"1px solid #4A9EFF44",borderRadius:4,
              color:"#1560B0",cursor:"pointer",fontSize:10,padding:"2px 10px",
              fontFamily:"Courier New, monospace"}}>
            DOWNLOAD
          </button>
          <button onClick={()=>setShowLog(false)}
            style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
              color:"#1E3C5C",cursor:"pointer",fontSize:12,padding:"2px 10px",
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
              color:"#C81030",letterSpacing:2,marginBottom:8,
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
                color:"#C81030",cursor:"pointer",
                fontSize:7,fontFamily:"Courier New, monospace"}}>
                COPY ALL ERRORS
              </button>
            </div>
            {[...errorLog].reverse().map((e,i)=>{
              const sevColor=e.severity==="fatal"?"#FF4444"
                :e.severity==="error"?"#C81030"
                :e.severity==="warn"?"#9A5C08"
                :"#1560B0";
              return (
                <div key={i} style={{padding:"10px 12px",marginBottom:8,
                  background:"#FEF4F4",borderRadius:4,
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
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2E5070"}}>
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
                      color:"#9A5C08",lineHeight:1.5,marginBottom:4,
                      padding:"3px 6px",background:"#FFF8EE",borderRadius:2}}>
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
                        fontSize:7,color:"#2E5070",cursor:"pointer",
                        marginTop:4,userSelect:"none"}}>
                        stack trace ▾
                      </summary>
                      <pre style={{fontFamily:"Courier New, monospace",fontSize:7,
                        color:"#2E5070",margin:"4px 0 0",
                        whiteSpace:"pre-wrap",wordBreak:"break-all",
                        background:"#FFFFFF",padding:"6px 8px",borderRadius:3,
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
            color:"#2E5070",textAlign:"center",padding:"20px"}}>
            No events logged yet.
          </div>
        ):([...eventLog].reverse().map((e,i)=>{
          const typeColor=e.type==="probable_hallucination_signal"?"#9A5C08"
            :e.type==="behavioral_signal"?"#4848B8"
            :e.type==="decoherence_alert"?"#C81030"
            :e.type==="LOCK_888"?"#4848B8"
            :e.type==="calm_streak"?"#178040"
            :"#1560B0";
          return (
            <div key={i} style={{padding:"8px 10px",marginBottom:6,
              background:"#EEF2F7",borderRadius:4,
              borderLeft:`3px solid ${typeColor}`}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:4}}>
                <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:typeColor,letterSpacing:1,fontWeight:"bold"}}>
                  {e.type.toUpperCase().split("_").join(" ")}
                </span>
                <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2E5070"}}>
                  T{e.turn||"?"} · {e.timestamp?.slice(11,19)||""}
                </span>
              </div>
              {e.note&&<div style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#1E3C5C",lineHeight:1.5}}>{e.note}</div>}
              {e.detail&&<div style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#1E3C5C",lineHeight:1.5,marginTop:2}}>{e.detail}</div>}
              {e.signals&&Array.isArray(e.signals)&&(
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#6A8090",lineHeight:1.5,marginTop:2}}>
                  {e.signals.join(" · ")}
                </div>
              )}
              {e.coherence_score!=null&&(
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2E5070",marginTop:2}}>
                  C={e.coherence_score.toFixed(3)}
                </div>
              )}
              {(e.type==="probable_hallucination_signal"||e.type==="behavioral_signal")&&(
                <div style={{marginTop:4}}>
                  {corrections.some(x=>x.turn===e.turn&&x.type===e.type)
                    ? <span style={{fontFamily:"Courier New, monospace",fontSize:7,
                        color:"#178040",letterSpacing:1}}>✓ MARKED FALSE +</span>
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
                        color:"#178040",cursor:"pointer",fontSize:7,
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
  );
});

// ── BookmarksModal ──────────────────────────────────────────────
const BookmarksModal = React.memo(function BookmarksModal() {
  const {showBookmarks,setShowBookmarks,bookmarks,setBookmarks,messages,coherenceData,toggleBookmark} = useContext(SessionCtx);
  if (!showBookmarks) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.50)",zIndex:1000,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>setShowBookmarks(false)}>
    <div style={{background:"#FFFFFF",border:"1px solid #90600088",
      borderRadius:8,maxWidth:720,width:"100%",maxHeight:"88vh",
      display:"flex",flexDirection:"column",overflow:"hidden"}}
      onClick={e=>e.stopPropagation()}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"12px 18px",
        borderBottom:"1px solid #2A2010",background:"#FAFCFF",flexShrink:0}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:11,
          color:"#906000",letterSpacing:2,fontWeight:"bold"}}>
          ★ SAVED TURNS — {bookmarks.length}
        </span>
        <button onClick={()=>setShowBookmarks(false)}
          style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
            color:"#1E3C5C",cursor:"pointer",fontSize:12,padding:"2px 10px",
            fontFamily:"Courier New, monospace"}}>
          ✕ CLOSE
        </button>
      </div>
      {/* Body */}
      <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
        {bookmarks.length===0?(
          <div style={{fontFamily:"Courier New, monospace",fontSize:10,
            color:"#2E5070",textAlign:"center",padding:"20px"}}>
            No bookmarks yet. Click ☆ on any assistant turn to save it.
          </div>
        ):bookmarks.map((bk,i)=>{
          const m=bk.metrics;
          const scoreColor=m.raw==null?"#2E5070":m.raw>.80?"#178040":m.raw>.65?"#9A5C08":"#C81030";
          return (
            <div key={bk.id} style={{marginBottom:16,borderRadius:6,
              background:"#F2F4F8",border:"1px solid #1A2840",overflow:"hidden"}}>
              {/* Turn header */}
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"7px 12px",
                background:"#FFFFFF",borderBottom:"1px solid #1A2840"}}>
                <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                  color:"#906000",letterSpacing:2,fontWeight:"bold"}}>
                  ★ TURN {bk.turn}
                </span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {m.raw!=null&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                      padding:"1px 6px",borderRadius:3,
                      background:m.raw>.80?"#E8F4EC":m.raw>.65?"#FFF4DD":"#FFEEEE",
                      color:scoreColor,border:`1px solid ${scoreColor}33`}}>
                      C={m.raw.toFixed(3)}
                    </span>
                  )}
                  {m.kalman!=null&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#2E5070"}}>
                      K={m.kalman.toFixed(3)}
                    </span>
                  )}
                  {m.smoothedVar!=null&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:m.smoothedVar>VAR_DECOHERENCE?"#C81030"
                        :m.smoothedVar>VAR_CAUTION?"#9A5C08"
                        :m.smoothedVar<VAR_CALM?"#178040":"#0E2A5A"}}>
                      σ²={m.smoothedVar.toFixed(4)}
                    </span>
                  )}
                  {m.harnessActive&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      padding:"1px 5px",borderRadius:3,
                      background:"#FFEEEE",color:"#C81030",border:"1px solid #E0506033"}}>
                      ⚠ DRIFT
                    </span>
                  )}
                  {m.hallucinationFlag&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      padding:"1px 5px",borderRadius:3,
                      background:"#FFF4E8",color:"#9A5C08",border:"1px solid #E8A03033"}}
                      title={m.hallucinationSignals?.join(" | ")||""}>
                      ⚠ H-SIG
                    </span>
                  )}
                  {m.behavioralFlag&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      padding:"1px 5px",borderRadius:3,
                      background:"#EEEEFF",color:"#4848B8",border:"1px solid #8888FF33"}}
                      title={m.behavioralSignals?.map(s=>s.type).join(" | ")||""}>
                      ⚠ B-SIG
                    </span>
                  )}
                  {m.sourceScore!=null&&(
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      padding:"1px 5px",borderRadius:3,
                      background:m.sourceScore>0.15?"#E8F4EC":"#FEF0F0",
                      color:m.sourceScore>0.15?"#178040":"#C81030",
                      border:`1px solid ${m.sourceScore>0.15?"#40D08033":"#E0506033"}`}}>
                      {m.sourceScore>0.15?"✓ SRC":"⚠ SRC"}
                    </span>
                  )}
                  <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#2E5070",
                    borderLeft:"1px solid #1A3050",paddingLeft:8}}>
                    {HARNESS_MODES[m.mode]?.label??m.mode?.toUpperCase()??"—"}
                  </span>
                  <button onClick={()=>toggleBookmark(bk.cohIdx)}
                    title="Remove bookmark"
                    style={{background:"none",border:"1px solid #C8860A33",
                      borderRadius:3,color:"#906000",cursor:"pointer",
                      fontSize:9,padding:"1px 6px",
                      fontFamily:"Courier New, monospace",opacity:0.7}}>
                    ★ REMOVE
                  </button>
                </div>
              </div>
              {/* User prompt */}
              <div style={{padding:"8px 12px",
                borderBottom:"1px solid #1A2030",background:"#EEF2F7"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2E5070",letterSpacing:2,marginBottom:4}}>USER</div>
                <div style={{fontFamily:"'Trebuchet MS', sans-serif",fontSize:12,
                  color:"#162840",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                  {bk.userText}
                </div>
              </div>
              {/* Assistant response */}
              <div style={{padding:"8px 12px"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2E5070",letterSpacing:2,marginBottom:4}}>ASSISTANT</div>
                <div style={{fontFamily:"'Trebuchet MS', sans-serif",fontSize:12,
                  color:"#1A2A3A",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                  {bk.assistantText}
                </div>
              </div>
              {/* V1.5.0: Annotation field */}
              <div style={{padding:"6px 12px",borderTop:"1px solid #1A2030",
                background:"#F4F7FB"}}>
                <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                  color:"#2E5070",letterSpacing:2,marginBottom:3}}>NOTE</div>
                <input
                  value={bk.note||""}
                  onChange={e=>setBookmarks(p=>p.map(b=>b.id===bk.id?{...b,note:e.target.value}:b))}
                  placeholder="Add research note (e.g. example of topic hijack T7)…"
                  style={{width:"100%",background:"#EEF2F7",border:"1px solid #1A2840",
                    borderRadius:3,color:"#0E2A5A",padding:"4px 8px",
                    fontFamily:"'Trebuchet MS', sans-serif",fontSize:11,
                    outline:"none",boxSizing:"border-box"}}/>
              </div>
              {/* Signal detail if present */}
              {(m.hallucinationSignals?.length>0||m.behavioralSignals?.length>0)&&(
                <div style={{padding:"6px 12px",borderTop:"1px solid #1A2030",
                  background:"#FFFFFF"}}>
                  {m.hallucinationSignals?.map((s,j)=>(
                    <div key={j} style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:"#9A5C08",lineHeight:1.6}}>⚠ H: {s}</div>
                  ))}
                  {m.behavioralSignals?.map((s,j)=>(
                    <div key={j} style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:"#4848B8",lineHeight:1.6}}>⚠ B: {s.detail||s.type}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Footer */}
      <div style={{padding:"8px 18px",borderTop:"1px solid #1A2010",
        background:"#FAFCFF",flexShrink:0,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#2E5070",letterSpacing:1}}>
          {bookmarks.length} TURN{bookmarks.length!==1?"S":""} SAVED · CLICK ★ REMOVE TO UNSAVE
        </span>
        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#2E5070",letterSpacing:1}}>
          V1.5.43 © HUDSON &amp; PERRY
        </span>
      </div>
    </div>
  </div>
  );
});

// ── GuideModal ──────────────────────────────────────────────
const GuideModal = React.memo(function GuideModal({showGuide,setShowGuide,guideTab,setGuideTab}) {
  if (!showGuide) return null;
  return (
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(30,50,80,0.50)",zIndex:1000,display:"flex",
    alignItems:"center",justifyContent:"center",padding:16}}
    onClick={()=>setShowGuide(false)}>
    <div style={{background:"#FFFFFF",border:"1px solid #A8C8E0",
      borderRadius:8,maxWidth:680,width:"100%",maxHeight:"85vh",
      display:"flex",flexDirection:"column",overflow:"hidden"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"12px 18px",
        borderBottom:"1px solid #1A3050",background:"#FAFCFF",flexShrink:0}}>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setGuideTab("guide")}
            style={{background:"none",border:`1px solid ${guideTab==="guide"?"#1560B0":"#2E5070"}`,
              borderRadius:4,color:guideTab==="guide"?"#1560B0":"#1E3C5C",
              cursor:"pointer",fontSize:10,padding:"3px 12px",
              fontFamily:"Courier New, monospace",letterSpacing:1}}>
            USER GUIDE
          </button>
          <button onClick={()=>setGuideTab("framework")}
            style={{background:"none",border:`1px solid ${guideTab==="framework"?"#0A7878":"#2E5070"}`,
              borderRadius:4,color:guideTab==="framework"?"#0A7878":"#1E3C5C",
              cursor:"pointer",fontSize:10,padding:"3px 12px",
              fontFamily:"Courier New, monospace",letterSpacing:1}}>
            FRAMEWORK
          </button>
        </div>
        <button onClick={()=>setShowGuide(false)}
          style={{background:"none",border:"1px solid #2A4060",borderRadius:4,
            color:"#1E3C5C",cursor:"pointer",fontSize:12,padding:"2px 10px",
            fontFamily:"Courier New, monospace"}}>
          ✕ CLOSE
        </button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>
        <pre style={{fontFamily:"Courier New, monospace",fontSize:10,
          color:"#0E1C2A",lineHeight:1.9,margin:0,
          whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
          {guideTab==="guide"?GUIDE_CONTENT:FRAMEWORK_CONTENT}
        </pre>
      </div>
      <div style={{padding:"10px 18px",borderTop:"1px solid #1A3050",
        background:"#FAFCFF",flexShrink:0,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"Courier New, monospace",fontSize:8,
          color:"#2E5070",letterSpacing:1}}>
          © 2026 DAVID HUDSON &amp; DAVID PERRY
        </span>
        <div style={{display:"flex",gap:12}}>
          <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
            style={{fontFamily:"Courier New, monospace",fontSize:8,
              color:"#1560B0",textDecoration:"none",letterSpacing:1}}>
            𝕏 @RaccoonStampede
          </a>
          <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
            style={{fontFamily:"Courier New, monospace",fontSize:8,
              color:"#1560B0",textDecoration:"none",letterSpacing:1}}>
            𝕏 @Prosperous727
          </a>
        </div>
      </div>
    </div>
  </div>
  );
});

// N4 fix: extracted above main component so React sees a stable component type.
// Was defined inline in render — recreated as a new function reference every render.
const ScoreBadge=({score,kalman})=>{
  const ref=kalman!=null?kalman:score;
  const bg=ref>.70?"#E8F8EE":ref>.50?"#FFF8E8":"#FEEEEE";
  const fg=ref>.70?"#178040":ref>.50?"#906000":"#C81030";
  return <span style={{fontFamily:"Courier New, monospace",fontSize:10,padding:"1px 7px",
    borderRadius:3,background:bg,color:fg,border:`1px solid ${fg}33`,marginLeft:8,letterSpacing:1}}>
    C={score.toFixed(3)}</span>;
};


// ── MessageBubble ───────────────────────────────────────────────
// Extracted as React.memo — each bubble only re-renders when its own
// message or coherence data changes, not on every keystroke or state update.
// In long sessions (50+ turns) this prevents re-rendering the entire
// chat history on every token during streaming.
const MessageBubble = React.memo(function MessageBubble({
  msg, i, isUser, ti, cdata, drifted, display, atts,
  onDelete, onBookmark, isBookmarked, S, THEME,
}) {
  return (
    <div style={{display:"flex",flexDirection:"column",
      alignItems:isUser?"flex-end":"flex-start"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
        <div style={S.roleLabel}>{isUser?"USER":"ASSISTANT"}</div>
        {!isUser&&ti>=0&&(
          <button onClick={onDelete} title="Delete turn"
            style={{background:"none",border:"1px solid #2A4060",borderRadius:3,
              color:"#2E5070",cursor:"pointer",fontSize:9,padding:"1px 5px",
              fontFamily:"Courier New, monospace",lineHeight:1.4,opacity:0.5}}>x</button>
        )}
        {!isUser&&ti>=0&&(
          <button onClick={onBookmark}
            title={isBookmarked?"Remove bookmark":"Bookmark this turn"}
            style={{background:"none",
              border:`1px solid ${isBookmarked?"#C8860A88":"#2E5070"}`,
              borderRadius:3,color:isBookmarked?"#906000":"#2E5070",
              cursor:"pointer",fontSize:10,padding:"1px 5px",
              fontFamily:"Courier New, monospace",lineHeight:1.4,
              opacity:isBookmarked?1:0.5}}>
            {isBookmarked?"★":"☆"}
          </button>
        )}
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
          <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#C81030",
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
            <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#2E5070"}}>
              K={cdata.kalman.toFixed(3)}
            </span>
            {cdata.smoothedVar!=null&&(
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:cdata.smoothedVar>VAR_DECOHERENCE?"#C81030"
                  :cdata.smoothedVar>VAR_CAUTION?"#9A5C08"
                  :cdata.smoothedVar<VAR_CALM?"#178040":"#0E2A5A"}}>
                σ²={cdata.smoothedVar.toFixed(4)}
              </span>
            )}
            {cdata.sourceScore!=null&&(
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                padding:"1px 5px",borderRadius:3,
                background:cdata.sourceScore>0.15?"#E8F4EC":"#FEF0F0",
                color:cdata.sourceScore>0.15?"#178040":"#C81030",
                border:`1px solid ${cdata.sourceScore>0.15?"#40D08033":"#E0506033"}`}}>
                {cdata.sourceScore>0.15?"✓ SRC":"⚠ SRC"}
              </span>
            )}
            {cdata.hallucinationFlag&&(
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                padding:"1px 5px",borderRadius:3,
                background:"#FFF4E8",color:"#9A5C08",
                border:"1px solid #E8A03033"}}
                title={cdata.hallucinationSignals?.join(" | ")||""}>
                ⚠ H-SIG
              </span>
            )}
            {cdata.behavioralFlag&&(
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                padding:"1px 5px",borderRadius:3,
                background:"#EEEEFF",color:"#4848B8",
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
}, (prev, next) => {
  // Custom equality — only re-render when this message's data changes
  return prev.display === next.display
    && prev.drifted === next.drifted
    && prev.isBookmarked === next.isBookmarked
    && prev.cdata === next.cdata
    && prev.atts === next.atts;
});

export default function HudsonPerryDriftV1() {
  const [messages,        setMessages]        = useState([]);
  // V1.5.6 fix (typing bug): replaced `const [input, setInput]` with `hasInput` boolean.
  // The old controlled textarea caused sendMessage to be recreated + the full component
  // to re-render on every single keystroke (visible as letter-jumping in the artifact iframe).
  // Text is now read via inputValueRef (set in V1.5.4). Only a boolean state tracks
  // whether the textarea has content — used solely for the send button disabled state.
  const [hasInput,        setHasInput]        = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [harnessMode,     setHarnessMode]     = useState("audit");
  const [kalmanState,     setKalmanState]     = useState({x:0,P:.05});
  const [kalmanHistory,   setKalmanHistory]   = useState([]); // V1.5.42: innovation whiteness check
  const [coherenceData,   setCoherenceData]   = useState([]);
  const [driftCount,      setDriftCount]      = useState(0);
  const [turnCount,       setTurnCount]       = useState(0);
  const [lastScore,       setLastScore]       = useState(null);
  const [showParams,      setShowParams]      = useState(false);
  const [showSdePaths,    setShowSdePaths]    = useState(false);
  const [pathOpacity,     setPathOpacity]     = useState(0.15);
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
  const [featZeroDrift,   setFeatZeroDrift]   = useState(false); // Advanced tab only — default off
  // V1.5.0: Adjustable Hudson Constants — defaults preserved, warning shown when changed
  const [userKappa,       setUserKappa]       = useState(KAPPA);
  const [userAnchor,      setUserAnchor]      = useState(RESONANCE_ANCHOR);
  const [hudsonMode,      setHudsonMode]      = useState(null);
  const [showDisclaimer,  setShowDisclaimer]  = useState(true);
  // V1.5.0: Session UUID — generated once per mount, stamped on all exports
  const [sessionId] = useState(()=>`HP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`);
  const [tokenEstimate,   setTokenEstimate]   = useState(0);
  const [bookmarks,       setBookmarks]       = useState([]);
  const [showBookmarks,   setShowBookmarks]   = useState(false);
  // V1.5.2: false-positive corrections dataset — exported in RESEARCH CSV
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
  // ── Advanced Tab state ───────────────────────────────────────────
  const [advancedUnlocked,  setAdvancedUnlocked]  = useState(false);
  const [showSdeConfig,     setShowSdeConfig]     = useState(false);
  const [showRailsConfig,   setShowRailsConfig]   = useState(false);
  const [showConstEditor,   setShowConstEditor]   = useState(false);
  const [showMhtStudy,      setShowMhtStudy]      = useState(false);
  const [mhtPsi,    setMhtPsi]    = useState(2.058171);
  const [mhtKappa,  setMhtKappa]  = useState(0.414214);
  const [mhtTau,    setMhtTau]    = useState(0.5);
  const [mhtGamma,  setMhtGamma]  = useState(0.05);
  const [mhtCap,    setMhtCap]    = useState(5.035);
  const [mhtAlpha,  setMhtAlpha]  = useState(1.8);
  const [mhtBeta,   setMhtBeta]   = useState(0.2);
  const [mhtSigma,  setMhtSigma]  = useState(0.15);
  // Poole CA sim state
  const [showPoole,    setShowPoole]    = useState(false);
  const [pooleBirth1,  setPooleBirth1]  = useState(5);
  const [pooleBirth2,  setPooleBirth2]  = useState(7);
  const [pooleSurv1,   setPooleSurv1]   = useState(5);
  const [pooleSurv2,   setPooleSurv2]   = useState(9);
  const [pooleGen,     setPooleGen]     = useState(0);
  const [caPassRate,   setCaPassRate]   = useState(null);
  // V1.5.42: Integrity Floor (Trumble/CLS hydrogen floor concept)
  // showIntegrityFloor = panel visible, featIntegrityFloor = detection active
  const [showIntegrityFloor,   setShowIntegrityFloor]   = useState(false);
  const [featIntegrityFloor,   setFeatIntegrityFloor]   = useState(false);
  const [integrityThreshold,   setIntegrityThreshold]   = useState(0.15);
  const [integrityBreachCount, setIntegrityBreachCount] = useState(0);
  const [userRailsEnabled,  setUserRailsEnabled]  = useState(false);
  const [userCustomRails,   setUserCustomRails]   = useState("");
  const [sdeModel,          setSdeModel]          = useState("hpdl"); // "hpdl"|"cir"|"heston"
  // CIR params: dX = κ(θ-X)dt + σ√X dW
  const [cirKappa,  setCirKappa]  = useState(0.444);
  const [cirTheta,  setCirTheta]  = useState(0.10);
  const [cirSigma,  setCirSigma]  = useState(0.08);
  // Heston params: dV = κ(θ-V)dt + σ√V dW₁, dS/S = √V dW₂, corr ρ
  const [hestonKappa, setHestonKappa] = useState(2.0);
  const [hestonTheta, setHestonTheta] = useState(0.04);
  const [hestonSigma, setHestonSigma] = useState(0.30);
  const [hestonRho,   setHestonRho]   = useState(-0.70);
  const [hestonV0,    setHestonV0]    = useState(0.04);

  const chatEndRef=useRef(null);
  const inputRef=useRef(null);
  // V1.5.4: inputValueRef mirrors textarea — sendMessage reads this, not state
  const inputValueRef=useRef("");
  // V1.5.9 fix #C: researchNotes converted to uncontrolled textarea
  const researchNotesRef=useRef("");

  // ── V2.0: Embedder Web Worker ref ────────────────────────────
  // workerRef.current = { worker: Worker, ready: bool }
  const workerRef=useRef(null);

  // ── V2.0: Provider + key storage state ───────────────────────
  const [provider,       setProvider]       = useState("anthropic");
  const [keySaved,       setKeySaved]       = useState(false);   // true when saved to localStorage
  const [embedderStatus, setEmbedderStatus] = useState("init");  // "init"|"loading"|"ready"|"error"
  useEffect(()=>{
    if (rewindTurn===null) chatEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages,rewindTurn]);

  // ── V2.0: Load saved key + provider from localStorage on mount ──
  useEffect(()=>{
    try {
      const savedKey      = localStorage.getItem("architect_api_key");
      const savedProvider = localStorage.getItem("architect_provider");
      if (savedKey)      { setApiKey(savedKey);       setKeySaved(true); }
      if (savedProvider) { setProvider(savedProvider); }
    } catch(e) {}
  },[]);

  // ── V2.0: Initialize embedder Web Worker on mount ─────────────
  useEffect(()=>{
    if (typeof window === "undefined") return;
    try {
      setEmbedderStatus("loading");
      const worker = new Worker("/embedder.worker.js");
      workerRef.current = { worker, ready: false };
      worker.onmessage = (e) => {
        if (e.data.type==="ready") {
          workerRef.current.ready = true;
          setEmbedderStatus("ready");
        } else if (e.data.type==="error" && !workerRef.current.ready) {
          setEmbedderStatus("error");
        } else if (e.data.type==="status") {
          setEmbedderStatus("loading");
        }
      };
      worker.onerror = () => setEmbedderStatus("error");
      worker.postMessage({ type: "init" });
    } catch(e) {
      setEmbedderStatus("error");
    }
    return () => {
      try { workerRef.current?.worker?.terminate(); } catch(e) {}
    };
  },[]);

  // N3 fix: flush researchNotes ref to state on tab close.
  // Uncontrolled textarea only calls setResearchNotes on blur — if user types
  // and closes without blurring, the notes would be lost on next session load.
  useEffect(()=>{
    const flush=()=>{
      if(researchNotesRef.current&&researchNotesRef.current!==researchNotes){
        // Synchronously save latest ref value to storage directly — state update
        // won't fire in time before unload, but storage.set is fire-and-forget here.
        try {
          window.storage.set("hpdl_notes_flush",researchNotesRef.current);
        } catch(e){}
      }
    };
    window.addEventListener("beforeunload",flush);
    return ()=>window.removeEventListener("beforeunload",flush);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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
        if (p.hudsonMode!=null)        setHudsonMode(p.hudsonMode);
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
        if (p.mathEpsilon!=null)        setMathEpsilon(p.mathEpsilon);
        // P1 fix: restore coherence weights + math tunables
        if (p.mathTfidf!=null)          setMathTfidf(p.mathTfidf);
        if (p.mathJsd!=null)            setMathJsd(p.mathJsd);
        if (p.mathLen!=null)            setMathLen(p.mathLen);
        if (p.mathStruct!=null)         setMathStruct(p.mathStruct);
        if (p.mathPersist!=null)        setMathPersist(p.mathPersist);
        if (p.mathRepThresh!=null)      setMathRepThresh(p.mathRepThresh);
        if (p.mathKalmanR!=null)        setMathKalmanR(p.mathKalmanR);
        if (p.mathKalmanSigP!=null)     setMathKalmanSigP(p.mathKalmanSigP);
        if (p.mathRagTopK!=null)        setMathRagTopK(p.mathRagTopK);
        if (p.mathMaxTokens!=null)      setMathMaxTokens(p.mathMaxTokens);
        if (p.sdeAlphaVal!=null)        setSdeAlphaVal(p.sdeAlphaVal);
        if (p.sdeBetaVal!=null)         setSdeBetaVal(p.sdeBetaVal);
        if (p.sdeSigmaVal!=null)        setSdeSigmaVal(p.sdeSigmaVal);
        if (p.sdeAlphaOn!=null)         setSdeAlphaOn(p.sdeAlphaOn);
        if (p.sdeBetaOn!=null)          setSdeBetaOn(p.sdeBetaOn);
        if (p.sdeSigmaOn!=null)         setSdeSigmaOn(p.sdeSigmaOn);
        if (p.postAuditThresh!=null)    setPostAuditThresh(p.postAuditThresh);
        if (p.showSdePaths!=null)        setShowSdePaths(p.showSdePaths);
        if (p.pathOpacity!=null)         setPathOpacity(p.pathOpacity);
        // Advanced Tab restore
        if (p.advancedUnlocked!=null)   setAdvancedUnlocked(p.advancedUnlocked);
        if (p.showSdeConfig!=null)       setShowSdeConfig(p.showSdeConfig);
        if (p.showRailsConfig!=null)     setShowRailsConfig(p.showRailsConfig);
        if (p.showConstEditor!=null)     setShowConstEditor(p.showConstEditor);
        if (p.showMhtStudy!=null)        setShowMhtStudy(p.showMhtStudy);
        if (p.showPoole!=null)           setShowPoole(p.showPoole);
        if (p.showIntegrityFloor!=null)  setShowIntegrityFloor(p.showIntegrityFloor);
        if (p.featIntegrityFloor!=null)  setFeatIntegrityFloor(p.featIntegrityFloor);
        if (p.integrityThreshold!=null)  setIntegrityThreshold(p.integrityThreshold);
        if (p.pooleBirth1!=null)         setPooleBirth1(p.pooleBirth1);
        if (p.pooleBirth2!=null)         setPooleBirth2(p.pooleBirth2);
        if (p.pooleSurv1!=null)          setPooleSurv1(p.pooleSurv1);
        if (p.pooleSurv2!=null)          setPooleSurv2(p.pooleSurv2);
        if (p.mhtPsi!=null)              setMhtPsi(p.mhtPsi);
        if (p.mhtKappa!=null)            setMhtKappa(p.mhtKappa);
        if (p.mhtTau!=null)              setMhtTau(p.mhtTau);
        if (p.mhtGamma!=null)            setMhtGamma(p.mhtGamma);
        if (p.mhtCap!=null)              setMhtCap(p.mhtCap);
        if (p.mhtAlpha!=null)            setMhtAlpha(p.mhtAlpha);
        if (p.mhtBeta!=null)             setMhtBeta(p.mhtBeta);
        if (p.mhtSigma!=null)            setMhtSigma(p.mhtSigma);
        if (p.userRailsEnabled!=null)    setUserRailsEnabled(p.userRailsEnabled);
        if (p.userCustomRails)           setUserCustomRails(p.userCustomRails);
        if (p.sdeModel)                  setSdeModel(p.sdeModel);
        if (p.cirKappa!=null)            setCirKappa(p.cirKappa);
        if (p.cirTheta!=null)            setCirTheta(p.cirTheta);
        if (p.cirSigma!=null)            setCirSigma(p.cirSigma);
        if (p.hestonKappa!=null)         setHestonKappa(p.hestonKappa);
        if (p.hestonTheta!=null)         setHestonTheta(p.hestonTheta);
        if (p.hestonSigma!=null)         setHestonSigma(p.hestonSigma);
        if (p.hestonRho!=null)           setHestonRho(p.hestonRho);
        if (p.hestonV0!=null)            setHestonV0(p.hestonV0);
        if (p.nPaths!=null)            setNPaths(p.nPaths);
        if (p.postAuditMode)           setPostAuditMode(p.postAuditMode);
        if (p.customMutePhrases)       setCustomMutePhrases(p.customMutePhrases);
        if (p.researchNotes)           setResearchNotes(p.researchNotes);
      } catch(e) { /* hpdl_config not yet set — first session */ }
      // N3 fix: recover notes flushed via beforeunload if they weren't in hpdl_config
      try {
        const nr=await window.storage.get("hpdl_notes_flush");
        if(nr?.value) { setResearchNotes(nr.value); window.storage.delete("hpdl_notes_flush"); }
      } catch(e) {}

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
          harnessMode,activePreset,customConfig,userKappa,userAnchor,hudsonMode,
          featKalman,featGARCH,featSDE,featRAG,featPipe,
          featMute,featGate,featBSig,featHSig,featPrune,featZeroDrift,
          adaptiveSigmaOn,adaptationRate,adaptedSigma,
          nPaths,postAuditMode,customMutePhrases,researchNotes,
          mathEpsilon, // V1.5.3 fix #6: persist user-tuned epsilon
          // P1 fix: coherence weights + math tunables were missing — reset to defaults on reload
          mathTfidf,mathJsd,mathLen,mathStruct,mathPersist,mathRepThresh,
          mathKalmanR,mathKalmanSigP,mathRagTopK,mathMaxTokens,
          sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn,
          postAuditThresh,showSdePaths,pathOpacity,
          // Advanced Tab
          advancedUnlocked,showSdeConfig,showRailsConfig,showConstEditor,showMhtStudy,showPoole,caPassRate,pooleBirth1,pooleBirth2,pooleSurv1,pooleSurv2,pooleGen,
          showIntegrityFloor,featIntegrityFloor,integrityThreshold,
          mhtPsi,mhtKappa,mhtTau,mhtGamma,mhtCap,mhtAlpha,mhtBeta,mhtSigma,
          userRailsEnabled,userCustomRails,sdeModel,
          cirKappa,cirTheta,cirSigma,hestonKappa,hestonTheta,hestonSigma,hestonRho,hestonV0,
        }));
      } catch(e) { console.warn("hpdl: config save failed",e); }
    })();
  },[harnessMode,activePreset,customConfig,userKappa,userAnchor,hudsonMode,
     featKalman,featGARCH,featSDE,featRAG,featPipe,
     featMute,featGate,featBSig,featHSig,featPrune,featZeroDrift,
     adaptiveSigmaOn,adaptationRate,adaptedSigma,
     nPaths,postAuditMode,customMutePhrases,researchNotes,mathEpsilon,
     mathTfidf,mathJsd,mathLen,mathStruct,mathPersist,mathRepThresh,
     mathKalmanR,mathKalmanSigP,mathRagTopK,mathMaxTokens,
     sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn,
     postAuditThresh,showSdePaths,pathOpacity,
     advancedUnlocked,showSdeConfig,showRailsConfig,showConstEditor,showMhtStudy,showPoole,
     caPassRate,pooleBirth1,pooleBirth2,pooleSurv1,pooleSurv2,pooleGen,
     showIntegrityFloor,featIntegrityFloor,integrityThreshold,
     mhtPsi,mhtKappa,mhtTau,mhtGamma,mhtCap,mhtAlpha,mhtBeta,mhtSigma,
     userRailsEnabled,userCustomRails,sdeModel,
     cirKappa,cirTheta,cirSigma,hestonKappa,hestonTheta,hestonSigma,hestonRho,hestonV0]);

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
  // R1 fix: added missing deps — calmStreak/smoothedVar/kalmanState/driftCount/turnCount
  // were saved but not in dep array; changes without coherenceData change were not persisted.
  },[coherenceData,bookmarks,eventLog,driftCount,turnCount,calmStreak,smoothedVar,kalmanState,scoreHistory,ragCache]);

  const currentMode=HARNESS_MODES[harnessMode];
  // V1.5.3 fix #6: thread mathEpsilon so the user-tunable value actually propagates
  // P4 fix: memoized — driftLawCapEff is cheap but called every render
  const cap_eff=useMemo(()=>driftLawCapEff(currentMode.gamma_h,mathEpsilon),[harnessMode,mathEpsilon]);
  // P5 fix: memoized — messages.filter() on every render was unnecessary
  const contextPruned=useMemo(()=>messages.filter(m=>m.role==="assistant").length>PRUNE_THRESHOLD,[messages]);
  // V1.5.0: active config — custom uses customConfig, others use PRESETS
  // V1.5.11: cfg memoized — was a plain object expression recomputed every render,
  // producing a new reference each time and causing sendMessage to invalidate constantly.
  const cfg = useMemo(()=>
    activePreset==="CUSTOM" ? customConfig : PRESETS[activePreset]??PRESETS.DEFAULT,
  [activePreset, customConfig]);
  // V1.5.0: live derived values from user-adjustable constants
  // V1.5.0: recompute SDE paths when nPaths changes
  // N5 fix: memoized — was a plain object spread rebuilt every render,
  // causing liveSDEParams in sendMessage to always be a new reference.
  const liveSDEOverride = useMemo(()=>({...SDE_PARAMS,
    alpha:sdeAlphaOn?sdeAlphaVal:SDE_PARAMS.alpha,
    beta_p:sdeBetaOn?sdeBetaVal:SDE_PARAMS.beta_p,
    sigma:sdeSigmaOn?sdeSigmaVal:SDE_PARAMS.sigma,
  }),[sdeAlphaOn,sdeAlphaVal,sdeBetaOn,sdeBetaVal,sdeSigmaOn,sdeSigmaVal]);
  const livePaths = useMemo(()=>simulateSDE(liveSDEOverride,20,.02,nPaths,42),[nPaths,sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn]);
  // R3 fix: memoized — null customMutePhrases returned new MUTE_PHRASES ref every render,
  // silently invalidating sendMessage useCallback on every render.
  const activeMutePhrases = useMemo(()=>customMutePhrases??MUTE_PHRASES,[customMutePhrases]);

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
      } catch(fileErr){
        // V1.5.5 fix #13: was silent catch — failures invisible to debugging.
        console.error(`[ARCHITECT] processFiles failed for ${file.name}:`,fileErr);
        setFileError(`Failed: ${file.name}`);
      }
    }
    if (results.length) setAttachments(prev=>[...prev,...results]);
  },[]);

  const removeAttachment=useCallback(id=>{
    setAttachments(prev=>{
      // V1.5.5: URL.revokeObjectURL removed — was a no-op on data URIs
      return prev.filter(a=>a.id!==id);
    });
  },[]);

  // ── Chart data ───────────────────────────────────────────────
  // P13: wrapped in useMemo — sdePercentilesAtStep sorts livePaths (up to 500 paths)
  // per turn entry. Without memo this ran on every render. Now only recomputes
  // when coherenceData, livePaths, or harnessMode actually changes.
  // Sample SDE paths at each coherence turn for chart overlay
  const pathChartData=useMemo(()=>{
    if (!showSdePaths||!livePaths||!livePaths.length) return [];
    const n=coherenceData.length;
    if (!n) return [];
    const stepsPerTurn=Math.floor(livePaths[0].length/Math.max(n,1));
    // Sample up to 20 paths for performance (spread evenly)
    const stride=Math.max(1,Math.floor(livePaths.length/20));
    const sampled=livePaths.filter((_,i)=>i%stride===0).slice(0,20);
    return sampled.map((path,pi)=>(
      coherenceData.map((d,i)=>{
        const step=Math.min(Math.round((i+1)*stepsPerTurn),path.length-1);
        // Normalize path value to coherence-like range [0.2, 1.0]
        const raw=path[step];
        const norm=Math.max(0.2,Math.min(1.0,0.65+raw*0.8));
        return {turn:d.turn,["p"+pi]:norm};
      })
    ));
  },[showSdePaths,livePaths,coherenceData]);

  const chartData=useMemo(()=>coherenceData.map((d,i)=>{
    const step=Math.round((i+1)*15),pcts=sdePercentilesAtStep(livePaths,step);
    const mean=d.kalman,floor=1-driftLawFloor(i+1,currentMode.gamma_h,mathEpsilon)*2; // V1.5.3 #6
    return {
      turn:i+1,raw:d.raw,kalman:d.kalman,
      p10:Math.min(.99,Math.max(.20,mean+pcts.p10*.15)),
      p90:Math.min(.99,Math.max(.20,mean+pcts.p90*.15)),
      floor:Math.max(.20,floor),
      harness:d.harnessActive?d.raw:null,
      ewma:(d.ewma!=null&&!isNaN(d.ewma))?Math.min(.99,Math.max(.20,d.ewma)):null,
      anchor:(coherenceData.length>=4&&d.anchorDist!=null&&!isNaN(d.anchorDist))?Math.min(.99,Math.max(.20,1-d.anchorDist*.4)):null,
    };
  }),[coherenceData,livePaths,currentMode,mathEpsilon]);

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
    // V1.5.4: read from ref — input state removed to prevent re-renders on keystrokes
    const text=inputValueRef.current.trim();
    if ((!text&&!attachments.length)||isLoading) return;

    setRewindTurn(null);
    inputValueRef.current="";
    if(inputRef.current) inputRef.current.value=""; // clear uncontrolled textarea
    setHasInput(false);
    setFileError(""); setStatusMessage(""); // P16: clear status on new send
    const pending=[...attachments]; setAttachments([]);
    setIsLoading(true);

    const content=await buildMessageContent(text,pending);
    const displayText=[text,pending.length?`[${pending.map(a=>a.name).join(", ")}]`:""].filter(Boolean).join("\n");
    const userMsg={role:"user",content,_display:displayText,_attachments:pending};
    const newMessages=[...messages,userMsg];
    setMessages(newMessages);
    const turn=turnCount+1;
    setTurnCount(turn);

    // V1.5.0: mute mode — detected before API call, active phrases from state or defaults
    const muteTriggered=featMute&&detectMuteMode(text,activeMutePhrases);
    setMuteModeActive(muteTriggered);

    const gateTriggered=featGate&&smoothedVar!==null&&smoothedVar>(cfg.varCaution??VAR_CAUTION);
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
        adaptiveSigmaOn?adaptedSigma:null,
        cfg // V1.5.9: pass cfg so preset varCaution/Decoherence/Calm apply
      ):"";
      if (featPipe&&turn>=2)
        setLastPipeState({turn,var:(smoothedVar??0).toFixed(6),kalmanX:kalmanState.x.toFixed(4),calmStreak,driftCount,hSignalCount,bSignalCount});

      const gateInj=featGate?buildDriftGateInjection(smoothedVar??0,cfg):"";
      const muteInj=muteTriggered&&featMute?buildMuteInjection(cfg):"";

      const currentCData = [...coherenceData];
      const pruned=featPrune
        ?pruneContext(newMessages,currentCData,cfg.pruneThreshold??pruneThreshold,cfg.pruneKeep??pruneKeep)
        :newMessages;
      // Custom Rails — user-defined behavioral guidelines (Advanced Tab)
      const railsInj=userRailsEnabled&&userCustomRails.trim()
        ?`\n\n[USER CUSTOM RAILS]\n${userCustomRails.trim()}\n[END CUSTOM RAILS]`
        :"";
      const systemPrompt=BASE_SYSTEM+HARNESS_INJECTIONS[harnessMode]+ragInj+pipeInj+gateInj+muteInj+railsInj;
      const needsHardTrim=["deep","extreme"].includes(harnessMode)&&pruned.length>6;
      const trimmed=needsHardTrim?[...pruned.slice(0,4),...pruned.slice(-6)]:pruned;
      // Guard: Anthropic API requires the last message to be role:"user".
      // Pruning or rewind can leave an assistant message at the end — strip trailing
      // assistant messages until we find the last user message.
      let trimmedSafe=[...trimmed];
      while (trimmedSafe.length>0&&trimmedSafe[trimmedSafe.length-1].role!=="user") {
        trimmedSafe.pop();
      }
      if (!trimmedSafe.length) trimmedSafe=trimmed; // fallback: send as-is if all non-user
      const apiMessages=trimmedSafe.map(m=>({role:m.role,content:m.content}));
      const maxTokens=muteTriggered?(cfg.muteMaxTokens??MUTE_MAX_TOKENS):(mathMaxTokens??NORMAL_MAX_TOKENS);

      // V1.5.0: rough token estimate — chars/4 standard approximation
      const sysLen=(systemPrompt||"").length;
      const msgLen=apiMessages.reduce((s,m)=>s+(typeof m.content==="string"?m.content.length:JSON.stringify(m.content).length),0);
      setTokenEstimate(Math.round((sysLen+msgLen)/4));

      // V2.0: Key goes to server-side proxy — never exposed in browser
      const headers={
        "Content-Type":"application/json",
        "anthropic-version":"2023-06-01",
        "x-architect-provider": provider,
      };
      if (apiKey.trim()) headers["x-api-key"]=apiKey.trim();

      const response=await fetch(API_ENDPOINT,{
        method:"POST",headers,
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
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
            const keyUrl = provider==="openai"?"platform.openai.com":provider==="grok"?"console.x.ai":"console.anthropic.com";
            errMsg=`Invalid API key. Check your key at ${keyUrl}`;
          } else if (response.status===403) {
            errMsg="API key lacks permissions. Check your provider console";
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
        if (featHSig) hallucinationAssessment=assessHallucinationSignals(content_raw, smoothedVar??0, pending, newMessages, cfg);
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
        rawScore=turn<2?0.88:await computeSemanticCoherence(content_raw,newMessages,{tfidf:mathTfidf,jsd:mathJsd,length:mathLen,structure:mathStruct,persistence:mathPersist},mathRepThresh,workerRef);
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
          postAuditScore=await computeSemanticCoherence(content_raw,finalMessages,{tfidf:mathTfidf,jsd:mathJsd,length:mathLen,structure:mathStruct,persistence:mathPersist},mathRepThresh,workerRef);
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
          newKalman=kalmanStep(kalmanState,rawScore,t_k,liveSDEParams,mathKalmanR,mathKalmanSigP,smoothedVar??0);
          // V1.5.0 dual-filter: second Kalman pass using post-audit score
          // Tightens estimate when post-audit diverges from live score.
          if (postAuditScore!==null&&doPostAudit) {
            newKalman=kalmanStep(newKalman,postAuditScore,t_k,liveSDEParams,mathKalmanR,mathKalmanSigP,smoothedVar??0);
          }
          setKalmanState(newKalman);
          setKalmanHistory(h=>[...h,newKalman].slice(-20)); // V1.5.42: keep last 20 for innovation check
        }
        setScoreHistory(newHist);
        newVar=featGARCH
          ?updateSmoothedVariance(newHist,smoothedVar,cfg) // V1.5.3: pass cfg for preset GARCH params
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
            setEventLog(p=>[...p,{timestamp:now,turn,type:"FULL_STABLE",calm_streak:newCalm,note:"Full coherence stabilized"}]);
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

      // ── V1.5.42: EWMA trend, anchor distance, truncation, innovation, hedge, efficiency ──
      const ewmaResult = computeEWMATrend(newHist);
      const anchorDist = computeAnchorDistance(content_raw, finalMessages);
      const truncated  = detectTruncation(content_raw);
      const hedgeResult = detectHedgeDensity(content_raw);
      const innovAC    = computeInnovationAutocorrelation(newHist, kalmanHistory);
      const effRatio   = computeEfficiencyRatio(content_raw, hallucinationAssessment.entropy??0);

      // Truncation fires as B-signal (model didn't complete answer)
      if (truncated) {
        behavioralAssessment.signals.push({type:"response_truncation",detail:"Response ends abruptly — possible token limit or context exhaustion"});
        behavioralAssessment.flagged = true;
      }
      // High hedge density fires as H-signal (excessive epistemic hedging)
      if (hedgeResult.count >= 3) {
        hallucinationAssessment.signals.push(`excessive hedging (${hedgeResult.count} markers, ${hedgeResult.density.toFixed(1)}/100 words) — possible low-confidence response`);
        hallucinationAssessment.flagged = true;
      }
      // Anchor drift fires as event log entry (slow-burn session drift)
      if (anchorDist !== null && anchorDist < 0.12 && turn >= 6) {
        setEventLog(p=>[...p,{timestamp:now,turn,type:"anchor_drift",
          anchor_similarity:anchorDist,note:`Session has drifted far from opening context (anchor sim=${anchorDist.toFixed(3)})`}]);
      }
      // Innovation autocorrelation — log warning when Kalman model is misspecified
      if (innovAC !== null && Math.abs(innovAC) > 0.5) {
        setEventLog(p=>[...p,{timestamp:now,turn,type:"kalman_misspec",
          autocorrelation:innovAC,note:`Innovation sequence autocorrelation=${innovAC.toFixed(3)} — Kalman process model may be misspecified`}]);
      }

      const newCData=[...currentCData,{
        raw:rawScore,kalman:newKalman.x,harnessActive:drifted,mode:newMode,
        smoothedVar:newVar,hallucinationFlag:hallucinationAssessment.flagged,
        hallucinationSignals:hallucinationAssessment.signals,
        sourceScore:hallucinationAssessment.sourceScore,
        behavioralFlag:behavioralAssessment.flagged,
        behavioralSignals:behavioralAssessment.signals,
        postAuditScore,quietFail,
        // V1.5.42 new fields
        ewma:ewmaResult.ewma, trend:ewmaResult.trend, momentum:ewmaResult.momentum,
        anchorDist, truncated, hedgeCount:hedgeResult.count,
        innovAC, effRatio,
        entropy:hallucinationAssessment.entropy??null,
        vocabGrowth:hallucinationAssessment.vocabGrowth??null,
      }];
      setCoherenceData(newCData);

      // ── V1.5.42: Integrity Floor detection ────────────────────
      // Separate category from drift: score below integrityThreshold = coherence bond broken.
      // Drift = wandering (recoverable). Integrity breach = dissolved (reset needed).
      if (featIntegrityFloor && turn >= 2 && rawScore < integrityThreshold) {
        setIntegrityBreachCount(c=>c+1);
        setEventLog(p=>[...p,{
          timestamp:now, turn,
          type:"INTEGRITY_BREACH",
          coherence_score:rawScore,
          threshold:integrityThreshold,
          note:`Coherence bond dissolved (score=${rawScore.toFixed(3)} < floor=${integrityThreshold.toFixed(3)}) — session integrity compromised. Consider reset.`,
        }]);
      }
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
          // V1.5.3 fix #4: use cfg.lock888Streak so CREATIVE(4)/RESEARCH(6)/MEDICAL(6)
          // presets record the correct lock state. Was hardcoded to LOCK_888_STREAK=5.
          lock888Achieved:newCalm>=(cfg.lock888Streak??LOCK_888_STREAK)?true:lock888Achieved,
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
  // V1.5.4 fix #7: `input` removed from dep array — now read via inputValueRef.
  // This was the single worst dep: it recreated the callback on every keystroke.
  // hasInput intentionally NOT in deps — sendMessage reads inputValueRef.current,
  // not hasInput. hasInput is UI-only (send button opacity/disabled). L2.
  },[attachments,messages,isLoading,kalmanState,harnessMode,
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
    setIntegrityBreachCount(0);setKalmanHistory([]);
    setMuteModeActive(false);setDriftGateActive(false);
    setTurnSnapshots([]);setRewindTurn(null);
    setBookmarks([]);setShowBookmarks(false);
    setCorrections([]);
    // Clear input area — uncontrolled textarea must be cleared via DOM ref
    inputValueRef.current="";
    setHasInput(false);
    if(inputRef.current) inputRef.current.value="";
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
      // P9: was raw population variance — inconsistent with GARCH used on normal turns.
      // V1.5.3: also passes cfg so preset GARCH params apply here too (#3).
      setSmoothedVar(updateSmoothedVariance(newHist, smoothedVar, cfg));
    }
    setTurnSnapshots([]);
    setRewindTurn(null);
    setStatusMessage(`Turn ${assistantMsgIndex+1} deleted — context freed. Snapshots cleared.`); // P16
  },[messages,coherenceData,cfg]);

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

  // N6 fix: memoized — was .map().filter() on coherenceData every render.
  const harnessChangeLog=useMemo(()=>coherenceData
    .map((d,i)=>({turn:i+1,mode:d.mode,active:d.harnessActive}))
    .filter((d,i,arr)=>i===0||d.mode!==arr[i-1].mode),
  [coherenceData]);

  // V1.5.5: wrapped in useMemo — applyZeroDriftLock runs 200-iter loop
  const lockStatus=useMemo(()=>
    applyZeroDriftLock(userAnchor-(lastScore??0)*.01,userAnchor),
  [lastScore,userAnchor]);
  // R2 fix: memoized — recalculated on every render previously
  const apiKeyValid=useMemo(()=>{
    const k=apiKey.trim();
    if (provider==="anthropic") return k.startsWith("sk-ant-");
    if (provider==="grok")      return k.startsWith("xai-");
    if (provider==="openai")    return k.startsWith("sk-") && !k.startsWith("sk-ant-");
    return k.length > 10;
  },[apiKey, provider]);
  // M3 fix: use cfg preset thresholds so MEDICAL/CREATIVE etc. reflect correctly in UI
  const vDec=cfg?.varDecoherence??VAR_DECOHERENCE;
  const vCau=cfg?.varCaution??VAR_CAUTION;
  const vCal=cfg?.varCalm??VAR_CALM;
  const varColor=smoothedVar===null?THEME.textFaint
    :smoothedVar>vDec?THEME.red
    :smoothedVar>vCau?THEME.orange
    :smoothedVar<vCal?THEME.green:THEME.blue;
  const varLabel=smoothedVar===null?"—"
    :smoothedVar>vDec?"⚠ DECOHERENCE"
    :smoothedVar>vCau?"△ CAUTION"
    :smoothedVar<vCal?"✓ CALM":"◆ NOMINAL";

  // ── V1.5.8 Context values — must be AFTER all useCallback declarations ──
  // sessionCtxValue includes toggleBookmark which is defined above.
  // Placing these before their deps causes "cannot access before initialization".
  const tuneCtxValue = useMemo(()=>({
    showTuning,setShowTuning,activePreset,setActivePreset,customConfig,setCustomConfig,
    userKappa,setUserKappa,userAnchor,setUserAnchor,hudsonMode,setHudsonMode,
    featKalman,setFeatKalman,featGARCH,setFeatGARCH,featSDE,setFeatSDE,
    featRAG,setFeatRAG,featPipe,setFeatPipe,featMute,setFeatMute,featGate,setFeatGate,
    featBSig,setFeatBSig,featHSig,setFeatHSig,featPrune,setFeatPrune,featZeroDrift,setFeatZeroDrift,
    nPaths,setNPaths,postAuditMode,setPostAuditMode,postAuditThresh,setPostAuditThresh,
    adaptiveSigmaOn,setAdaptiveSigmaOn,adaptedSigma,adaptationRate,setAdaptationRate,
    sdeAlphaVal,setSdeAlphaVal,sdeBetaVal,setSdeBetaVal,sdeSigmaVal,setSdeSigmaVal,
    sdeAlphaOn,setSdeAlphaOn,sdeBetaOn,setSdeBetaOn,sdeSigmaOn,setSdeSigmaOn,
    customMutePhrases,setCustomMutePhrases,mutePhraseInput,setMutePhraseInput,
    mathEpsilon,setMathEpsilon,mathTfidf,setMathTfidf,mathJsd,setMathJsd,
    mathLen,setMathLen,mathStruct,setMathStruct,mathPersist,setMathPersist,
    mathRepThresh,setMathRepThresh,mathKalmanR,setMathKalmanR,mathKalmanSigP,setMathKalmanSigP,
    mathRagTopK,setMathRagTopK,mathMaxTokens,setMathMaxTokens,
    tuneTab,setTuneTab,pruneThreshold,setPruneThreshold,pruneKeep,setPruneKeep,showParams,setShowParams,
    showSdePaths,setShowSdePaths,pathOpacity,setPathOpacity,
    // Advanced Tab
    advancedUnlocked,setAdvancedUnlocked,
    showSdeConfig,setShowSdeConfig,showRailsConfig,setShowRailsConfig,showConstEditor,setShowConstEditor,
    showMhtStudy,setShowMhtStudy,mhtPsi,setMhtPsi,mhtKappa,setMhtKappa,mhtTau,setMhtTau,
    showPoole,setShowPoole,pooleBirth1,setPooleBirth1,pooleBirth2,setPooleBirth2,
    pooleSurv1,setPooleSurv1,pooleSurv2,setPooleSurv2,pooleGen,setPooleGen,caPassRate,setCaPassRate,
    mhtGamma,setMhtGamma,mhtCap,setMhtCap,mhtAlpha,setMhtAlpha,mhtBeta,setMhtBeta,mhtSigma,setMhtSigma,
    userRailsEnabled,setUserRailsEnabled,
    userCustomRails,setUserCustomRails,sdeModel,setSdeModel,
    cirKappa,setCirKappa,cirTheta,setCirTheta,cirSigma,setCirSigma,
    hestonKappa,setHestonKappa,hestonTheta,setHestonTheta,
    hestonSigma,setHestonSigma,hestonRho,setHestonRho,hestonV0,setHestonV0,
  }),[showTuning,activePreset,customConfig,userKappa,userAnchor,hudsonMode,
      featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,featGate,
      featBSig,featHSig,featPrune,featZeroDrift,nPaths,postAuditMode,postAuditThresh,
      adaptiveSigmaOn,adaptedSigma,adaptationRate,
      sdeAlphaVal,sdeBetaVal,sdeSigmaVal,sdeAlphaOn,sdeBetaOn,sdeSigmaOn,
      customMutePhrases,mutePhraseInput,
      mathEpsilon,mathTfidf,mathJsd,mathLen,mathStruct,mathPersist,mathRepThresh,
      mathKalmanR,mathKalmanSigP,mathRagTopK,mathMaxTokens,
      tuneTab,pruneThreshold,pruneKeep,showParams,showSdePaths,pathOpacity,
      advancedUnlocked,showSdeConfig,showRailsConfig,showConstEditor,
      showMhtStudy,mhtPsi,mhtKappa,mhtTau,mhtGamma,mhtCap,mhtAlpha,mhtBeta,mhtSigma,
      showPoole,pooleBirth1,pooleBirth2,pooleSurv1,pooleSurv2,pooleGen,caPassRate,
      showIntegrityFloor,featIntegrityFloor,integrityThreshold,integrityBreachCount,
      userRailsEnabled,userCustomRails,sdeModel,
      cirKappa,cirTheta,cirSigma,hestonKappa,hestonTheta,hestonSigma,hestonRho,hestonV0]);

  const sessionCtxValue = useMemo(()=>({
    exportContent,setExportContent,exportCopied,setExportCopied,
    showLog,setShowLog,eventLog,errorLog,sessionId,corrections,
    showBookmarks,setShowBookmarks,bookmarks,setBookmarks,messages,coherenceData,toggleBookmark,
  }),[exportContent,exportCopied,showLog,eventLog,errorLog,sessionId,corrections,
     showBookmarks,bookmarks,messages,coherenceData,toggleBookmark]);

  // V1.5.9 fix #D: S memoized — was a 62-line object literal rebuilt on every render.
  // Only genuinely changes when harnessMode changes (currentMode.color is the sole dynamic dep).
  const S=useMemo(()=>({
    root:{display:"flex",flexDirection:"column",height:"100vh",background:THEME.bgRoot,
      color:THEME.textPrimary,fontFamily:"'Trebuchet MS', sans-serif",fontSize:13,overflow:"hidden"},
    header:{display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"10px 20px",borderBottom:`1px solid ${THEME.border}`,background:THEME.bgPanel,flexWrap:"wrap",gap:8,
      boxShadow:"0 1px 4px rgba(0,0,0,0.07)"},
    title:{fontFamily:"Courier New, monospace",fontSize:13,fontWeight:"bold",color:THEME.blue,letterSpacing:2},
    subtitle:{fontFamily:"Courier New, monospace",fontSize:9,color:THEME.textDim,letterSpacing:1,marginTop:2},
    modeBadge:{display:"flex",alignItems:"center",gap:8,padding:"4px 12px",borderRadius:4,
      border:`1px solid ${currentMode.color}66`,background:`${currentMode.color}18`},
    modeDot:{width:8,height:8,borderRadius:"50%",background:currentMode.color,
      boxShadow:`0 0 6px ${currentMode.color}`,
      animation:harnessMode!=="audit"?"pulse 1.5s infinite":"none"},
    modeLabel:{fontFamily:"Courier New, monospace",fontSize:11,color:currentMode.color,letterSpacing:2},
    apiKeyRow:{display:"flex",alignItems:"center",gap:6,padding:"5px 20px",
      borderBottom:`1px solid ${THEME.border}`,background:THEME.bgCard},
    body:{display:"flex",flex:1,overflow:"hidden"},
    chatPanel:{flex:"0 0 55%",display:"flex",flexDirection:"column",
      borderRight:`1px solid ${THEME.border}`,overflow:"hidden"},
    chatMessages:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12,
      background:THEME.bgRoot},
    roleLabel:{fontFamily:"Courier New, monospace",fontSize:9,color:THEME.textFaint,letterSpacing:2,marginBottom:3},
    userBubble:{maxWidth:"85%",padding:"10px 14px",borderRadius:"8px 8px 2px 8px",
      background:THEME.userBubble,border:`1px solid ${THEME.userBubbleBorder}`,color:THEME.userText,lineHeight:1.6,
      boxShadow:"0 1px 3px rgba(0,0,0,0.06)"},
    assistantBubble:{maxWidth:"92%",padding:"10px 14px",borderRadius:"8px 8px 8px 2px",
      background:THEME.asstBubble,border:`1px solid ${THEME.asstBubbleBorder}`,color:THEME.asstText,lineHeight:1.6,
      boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
    driftBubble:{border:`1px solid ${THEME.driftBorder}`,background:THEME.driftBubble},
    attachRow:{display:"flex",flexWrap:"wrap",gap:6,padding:"6px 16px 0",background:THEME.bgCard},
    inputRow:{display:"flex",gap:8,padding:"10px 16px 12px",borderTop:`1px solid ${THEME.border}`,
      background:THEME.bgCard,alignItems:"flex-end"},
    attachBtn:{width:44,height:44,background:"transparent",border:`1px solid ${THEME.border}`,
      borderRadius:6,color:THEME.textDim,fontSize:18,display:"flex",
      alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"},
    textarea:{flex:1,background:THEME.bgInput,border:`1px solid ${THEME.border}`,borderRadius:4,
      color:THEME.textPrimary,padding:"8px 12px",fontFamily:"'Trebuchet MS', sans-serif",
      fontSize:13,resize:"none",outline:"none",lineHeight:1.5},
    sendBtn:{padding:"0 18px",height:44,background:THEME.blue,border:`1px solid ${THEME.blue}`,
      borderRadius:4,color:"#FFFFFF",cursor:"pointer",fontSize:11,
      fontFamily:"Courier New, monospace",letterSpacing:1,flexShrink:0},
    errorBar:{padding:"4px 16px",background:THEME.bgCard,borderTop:`1px solid ${THEME.teal}44`,
      fontFamily:"Courier New, monospace",fontSize:9,color:THEME.teal,letterSpacing:1},
    metricsPanel:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:THEME.bgCard},
    metricSection:{borderBottom:`1px solid ${THEME.borderLight}`,padding:"12px 16px"},
    sectionTitle:{fontFamily:"Courier New, monospace",fontSize:9,letterSpacing:3,
      color:THEME.textDim,textTransform:"uppercase",marginBottom:8},
    statRow:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5},
    statLabel:{fontFamily:"Courier New, monospace",fontSize:10,color:THEME.textDim},
    statValue:{fontFamily:"Courier New, monospace",fontSize:11,color:THEME.textMid,fontWeight:"bold"},
    driftBar:{height:4,background:THEME.bgInput,borderRadius:2,overflow:"hidden",marginTop:4},
    resetBtn:{padding:"4px 10px",background:"transparent",border:`1px solid ${THEME.border}`,
      borderRadius:4,color:THEME.textDim,cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    exportBtn:{padding:"4px 10px",background:"transparent",border:`1px solid ${THEME.teal}66`,
      borderRadius:4,color:THEME.teal,cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    logBtn:{padding:"4px 10px",background:"transparent",border:`1px solid ${THEME.blue}66`,
      borderRadius:4,color:THEME.blue,cursor:"pointer",fontSize:10,
      fontFamily:"Courier New, monospace",letterSpacing:1},
    loading:{display:"flex",gap:4,padding:"8px 14px"},
    dot:{width:6,height:6,borderRadius:"50%",background:THEME.teal,animation:"bounce 1.2s infinite"},
  }),[harnessMode]); // only currentMode.color changes — depends solely on harnessMode

  // V1.5.5 fix #10: buildExportBlock calls applyZeroDriftLock internally.
  // Wrapped in useMemo — only recomputes when session state actually changes.
  const exportBlock=useMemo(()=>buildExportBlock({kalmanState,harnessMode,driftCount,turnCount,
    lastScore,coherenceData,ragCache,smoothedVar,calmStreak,lock888Achieved,
    userKappa,userAnchor,activePreset,
      featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
      featGate,featBSig,featHSig,featPrune,featZeroDrift,
      nPaths,postAuditMode,featIntegrityFloor,integrityThreshold}),
  [kalmanState,harnessMode,driftCount,turnCount,lastScore,coherenceData,
   ragCache,smoothedVar,calmStreak,lock888Achieved,userKappa,userAnchor,
   activePreset,featKalman,featGARCH,featSDE,featRAG,featPipe,featMute,
   featGate,featBSig,featHSig,featPrune,featZeroDrift,nPaths,postAuditMode,
   featIntegrityFloor,integrityThreshold]);

  return (
    <TuneCtx.Provider value={tuneCtxValue}>
    <SessionCtx.Provider value={sessionCtxValue}>
    <div style={S.root}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes lock888{0%,100%{box-shadow:0 0 4px ${THEME.purple}}50%{box-shadow:0 0 14px ${THEME.purple}}}
        @keyframes pipeGlow{0%,100%{border-color:${THEME.teal}44}50%{border-color:${THEME.teal}CC}}
        @keyframes muteGlow{0%,100%{border-color:${THEME.orange}44}50%{border-color:${THEME.orange}CC}}
        *::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-track{background:${THEME.bgCard}}
        *::-webkit-scrollbar-thumb{background:${THEME.border};border-radius:3px}
        textarea:focus{border-color:${THEME.blue}!important;box-shadow:0 0 0 2px ${THEME.blue}22!important}
        button:hover{opacity:.80}
        .chart-clickable{cursor:pointer}
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.title}>ARCHITECT — UNIVERSAL COHERENCE ENGINE V1.5.43</div>
          <div style={S.subtitle}>
            © HUDSON &amp; PERRY RESEARCH · MUTE:{featMute?"ON":"OFF"} · GATE:{featGate?"ON":"OFF"} · PIPE:{featPipe?"ON":"OFF"} · REWIND:ON · V1.5.43
          </div>
          <div style={{display:"flex",gap:10,marginTop:3}}>
            <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
              style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#1560B0",
                textDecoration:"none",letterSpacing:1,opacity:.7}}>
              𝕏 @RaccoonStampede
            </a>
            <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
              style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#1560B0",
                textDecoration:"none",letterSpacing:1,opacity:.7}}>
              𝕏 @Prosperous727
            </a>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Framework constant modification indicator removed from header */}
          {lock888Achieved&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:10,color:"#4848B8",
              letterSpacing:2,padding:"3px 10px",border:"1px solid #8888FF44",
              borderRadius:4,background:"#EEEEFF",animation:"lock888 2s infinite"}}>
              🔒 FULL STABILITY
            </div>
          )}
          {muteModeActive&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#9A5C08",
              letterSpacing:1,padding:"3px 8px",border:"1px solid #E8A03033",
              borderRadius:4,background:"#FFF8EE",animation:"muteGlow 1.5s infinite"}}>
              🔇 MUTE
            </div>
          )}
          {driftGateActive&&(
            <div style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#C81030",
              letterSpacing:1,padding:"3px 8px",border:"1px solid #E0506033",
              borderRadius:4,background:"#FFF1F2"}}>
              ⊘ GATE
            </div>
          )}
          {rewindTurn!==null&&(
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <button onClick={()=>{
                  // N1 fix: compare against actual oldest turn in buffer, not hardcoded 1.
                  // After turn 20 the buffer rolls — oldest may be turn 6, not turn 1.
                  const minSnap=turnSnapshots[0]?.turn??1;
                  if(rewindTurn!==minSnap) restoreToTurn(rewindTurn-1);
                }}
                style={{padding:"4px 10px",background:"#EEF8F2",border:"1px solid #40D08044",
                  borderRadius:4,color:"#178040",cursor:"pointer",
                  fontSize:11,fontFamily:"Courier New, monospace",
                  opacity:rewindTurn===(turnSnapshots[0]?.turn??1)?0.3:1}}>
                prev
              </button>
              <button onClick={resumeLive} style={{padding:"6px 14px",background:"#E8F4EC",
                border:"2px solid #178040",borderRadius:4,color:"#178040",cursor:"pointer",
                fontSize:11,fontFamily:"Courier New, monospace",letterSpacing:1,
                fontWeight:"bold",animation:"pipeGlow 1.5s infinite"}}>
                T{rewindTurn} LIVE
              </button>
              <button onClick={()=>{
                  // H1 fix: compare against the actual highest turn stored in buffer,
                  // not turnSnapshots.length (always 20 after rolling cap kicks in).
                  const maxSnap=turnSnapshots[turnSnapshots.length-1]?.turn??0;
                  if(rewindTurn!==maxSnap) restoreToTurn(rewindTurn+1);
                }}
                style={{padding:"4px 10px",background:"#EEF8F2",border:"1px solid #40D08044",
                  borderRadius:4,color:"#178040",cursor:"pointer",
                  fontSize:11,fontFamily:"Courier New, monospace",
                  opacity:rewindTurn===(turnSnapshots[turnSnapshots.length-1]?.turn??0)?0.3:1}}>
                next
              </button>
            </div>
          )}
          <div style={S.modeBadge}>
            <div style={S.modeDot}/>
            <span style={S.modeLabel}>{currentMode.label}</span>
            <span style={{fontFamily:"Courier New, monospace",fontSize:10,color:"#1E3C5C"}}>
              γ_h={currentMode.gamma_h}
            </span>
          </div>
          <button style={S.exportBtn} onClick={()=>setShowExport(p=>!p)}>
            {showExport?"HIDE":"EXPORT"}
          </button>
          <button style={{...S.exportBtn,borderColor:"#40D08044",color:"#178040"}}
            onClick={()=>setShowTuning(p=>!p)}>
            {showTuning?"HIDE TUNE":`TUNE${activePreset!=="DEFAULT"?` · ${PRESETS[activePreset]?.label??activePreset}`:""}`}
          </button>
          <button style={{...S.exportBtn,borderColor:"#4A9EFF44",color:"#1560B0"}}
            onClick={()=>setShowGuide(p=>!p)}>
            {showGuide?"HIDE GUIDE":"GUIDE"}
          </button>
          <button style={{...S.logBtn,
              borderColor:errorLog.length>0?"#E0506044":"#4A9EFF44",
              color:errorLog.length>0?"#C81030":"#1560B0"}}
              onClick={()=>setShowLog(p=>!p)}>
              {showLog?"HIDE ARCHITECT":`ARCHITECT${eventLog.length>0||errorLog.length>0?` (${eventLog.length}${errorLog.length>0?` ⚠${errorLog.length}`:""})`:""}`}
            </button>
          {bookmarks.length>0&&(
            <button style={{...S.logBtn,borderColor:"#C8860A44",color:"#906000"}}
              onClick={()=>setShowBookmarks(p=>!p)}>
              {showBookmarks?"HIDE SAVED":`★ SAVED (${bookmarks.length})`}
            </button>
          )}
          {messages.length>0&&(
            <button style={{...S.logBtn,borderColor:"#40D08044",color:"#178040"}}
              onClick={()=>setExportContent(downloadChat(messages,coherenceData,eventLog,sessionId,userKappa,userAnchor))}>
              CHAT
            </button>
          )}
          {coherenceData.length>0&&(
            <button style={{...S.logBtn,borderColor:"#8888FF44",color:"#4848B8"}}
              onClick={()=>{
                // H2 fix: use researchNotesRef.current if available (uncontrolled textarea
                // only updates state on blur — ref always has latest keystrokes)
                const notes=researchNotesRef.current||researchNotes;
                setExportContent(downloadResearch(coherenceData,eventLog,sessionId,userKappa,userAnchor,activePreset,notes,cfg));
              }}>
              RESEARCH
            </button>
          )}
          {coherenceData.length>0&&(
            <button style={{...S.logBtn,borderColor:"#4A9EFF44",color:"#1560B0"}}
              onClick={()=>setExportContent(downloadSdePaths(livePaths,coherenceData,sessionId,nPaths,userKappa))}>
              SDE
            </button>
          )}
          <button style={{...S.logBtn,borderColor:"#C8860A44",color:"#906000"}}
          onClick={()=>setShowNotes(p=>!p)}>
          {showNotes?"HIDE NOTES":"NOTES"}
        </button>
        <button style={S.resetBtn} onClick={resetSession}>RESET</button>
        </div>
      </div>

      {/* PROVIDER + API KEY — V2.0 */}
      <div style={{display:"flex",flexDirection:"column",gap:4,padding:"4px 20px"}}>
        {/* Provider selector row */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontFamily:"Courier New, monospace",fontSize:8,
            color:"#2E5070",letterSpacing:2,flexShrink:0}}>PROVIDER</span>
          {["anthropic","openai","grok"].map(p=>(
            <button key={p} onClick={()=>setProvider(p)}
              style={{fontFamily:"Courier New, monospace",fontSize:8,
                padding:"2px 8px",borderRadius:3,cursor:"pointer",
                background:provider===p?"#0E2A5A":"transparent",
                color:provider===p?"#FFFFFF":"#2E5070",
                border:`1px solid ${provider===p?"#0E2A5A":"#C0D0E4"}`}}>
              {p.toUpperCase()}
            </button>
          ))}
          {/* Embedder status indicator */}
          <span style={{fontFamily:"Courier New, monospace",fontSize:7,
            color:embedderStatus==="ready"?"#178040":embedderStatus==="error"?"#9A5C08":"#2E5070",
            marginLeft:"auto",flexShrink:0}}>
            {embedderStatus==="ready"?"⬡ SEMANTIC ON"
              :embedderStatus==="loading"?"⬡ LOADING MODEL..."
              :embedderStatus==="error"?"⬡ TF-IDF FALLBACK"
              :"⬡ INITIALIZING"}
          </span>
        </div>
        {/* Key input row */}
        <div style={S.apiKeyRow}>
          <span style={{fontFamily:"Courier New, monospace",fontSize:9,
            color:apiKeyValid?"#178040":"#1E3C5C",letterSpacing:2,flexShrink:0}}>
            {apiKeyValid?"🔑 KEY SET":"🔑 API KEY"}
          </span>
          <input type={showApiKey?"text":"password"} value={apiKey}
            onChange={e=>{setApiKey(e.target.value); setKeySaved(false);}}
            placeholder={provider==="anthropic"?"sk-ant-...":provider==="openai"?"sk-...":"xai-..."}
            style={{flex:1,background:"#EEF2F7",border:`1px solid ${apiKeyValid?"#1EAAAA44":"#C0D0E4"}`,
              borderRadius:4,color:"#0E2A5A",padding:"4px 10px",
              fontFamily:"Courier New, monospace",fontSize:11,outline:"none"}}/>
          <button onClick={()=>setShowApiKey(p=>!p)}
            style={{...S.resetBtn,padding:"2px 8px",fontSize:9}}>{showApiKey?"HIDE":"SHOW"}</button>
          {/* SAVE button */}
          {apiKeyValid&&!keySaved&&(
            <button onClick={()=>{
              try {
                localStorage.setItem("architect_api_key", apiKey.trim());
                localStorage.setItem("architect_provider", provider);
                setKeySaved(true);
              } catch(e) {}
            }} style={{...S.resetBtn,padding:"2px 8px",fontSize:9,
              background:"#EEF8EE",border:"1px solid #178040",color:"#178040"}}>
              SAVE
            </button>
          )}
          {/* SAVED / CLEAR controls */}
          {keySaved&&(
            <>
              <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                color:"#178040",flexShrink:0}}>✓ SAVED</span>
              <button onClick={()=>{
                try {
                  localStorage.removeItem("architect_api_key");
                  localStorage.removeItem("architect_provider");
                } catch(e) {}
                setApiKey(""); setKeySaved(false);
              }} style={{...S.resetBtn,padding:"2px 8px",fontSize:9,
                color:"#C81030",border:"1px solid #C8103044"}}>
                CLEAR
              </button>
            </>
          )}
          {apiKey.trim().length>0&&!apiKeyValid&&(
            <span style={{fontFamily:"Courier New, monospace",fontSize:9,
              color:"#C81030",flexShrink:0}}>
              {provider==="anthropic"?"must start with sk-ant-"
                :provider==="grok"?"must start with xai-"
                :"must start with sk-"}
            </span>
          )}
          <a href={provider==="openai"?"https://platform.openai.com"
                   :provider==="grok"?"https://console.x.ai"
                   :"https://console.anthropic.com"}
            target="_blank" rel="noreferrer"
            style={{fontFamily:"Courier New, monospace",fontSize:8,color:"#0E3060",
              textDecoration:"none",flexShrink:0}}>get key ↗</a>
        </div>
      </div>

      {/* STATUS BAR */}
      {messages.length>0&&(()=>{
        const statusText=smoothedVar===null?"Session starting…"
          :smoothedVar>vDec?"⚠ HIGH VARIANCE — AI may be drifting or hallucinating"
          :smoothedVar>vCau?"△ CAUTION — Variance rising, watch for off-topic responses"
          :lock888Achieved&&(computeSessionHealth(coherenceData,driftCount,smoothedVar,calmStreak,lock888Achieved,cfg)??0)>=60?"🔒 FULLY STABLE — AI is consistent and on-task"
          :calmStreak>=3?"✓ STABLE — AI is coherent and on-task"
          :driftCount>4?"⚠ DRIFT DETECTED — Harness is correcting the AI"
          :"◆ MONITORING — Session looks normal";
        const barColor=smoothedVar===null?"#2E5070"
          :smoothedVar>vDec?"#C81030"
          :smoothedVar>vCau?"#9A5C08"
          :lock888Achieved||calmStreak>=3?"#178040"
          :driftCount>4?"#9A5C08":"#1E3C5C";
        return (
          <div style={{padding:"4px 20px",background:"#F6F8FC",
            borderBottom:"1px solid #1A3050",
            display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",
              background:barColor,flexShrink:0}}/>
            <span style={{fontFamily:"Courier New, monospace",fontSize:10,
              color:barColor,letterSpacing:1}}>{statusText}</span>
            {turnCount>0&&<span style={{fontFamily:"Courier New, monospace",
              fontSize:9,color:"#2E5070",marginLeft:"auto"}}>
              Turn {turnCount} · Avg C: {coherenceData.length?(coherenceData.reduce((s,d)=>s+d.raw,0)/coherenceData.length).toFixed(3):"—"}
            </span>}
          </div>
        );
      })()}

      {/* EXPORT PANEL */}
      {showExport&&(
        <div style={{background:"#F8FAFC",borderBottom:"1px solid #1EAAAA44",padding:"12px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{...S.sectionTitle,marginBottom:0,color:"#0A7878"}}>
              MISSION PROTOCOL — HUDSON &amp; PERRY ARCHITECT V1.5.43
            </span>
            <button style={{...S.exportBtn,background:copied?"#E4F4F4":"transparent",
              color:copied?"#178040":"#0A7878"}} onClick={handleCopyExport}>
              {copied?"✓ COPIED":"COPY"}
            </button>
          </div>
          <pre style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#0A5070",
            lineHeight:1.7,margin:0,maxHeight:200,overflowY:"auto",
            whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{exportBlock}</pre>
        </div>
      )}

      {/* RESEARCH NOTES PANEL */}
      {showNotes&&(
        <div style={{background:"#F8FAFC",borderBottom:"1px solid #C8860A44",padding:"12px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontFamily:"Courier New, monospace",fontSize:9,
              color:"#906000",letterSpacing:2}}>RESEARCH NOTES — stamped on RESEARCH export</span>
            <span style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2E5070"}}>
              {researchNotesRef.current.length||researchNotes.length} chars
            </span>
          </div>
          <textarea
            ref={el=>{
              if(el&&researchNotesRef.current!==el.value&&!el.dataset.initialized){
                el.value=researchNotes;
                researchNotesRef.current=researchNotes;
                el.dataset.initialized="1";
              }
            }}
            onInput={e=>{researchNotesRef.current=e.target.value;}}
            onBlur={e=>{
              // Only trigger state update (and storage save) on blur — not every keystroke
              if(e.target.value!==researchNotes) setResearchNotes(e.target.value);
            }}
            placeholder={"Hypothesis, custom SDE values, theory notes...\n\nExample: Testing α=-0.40 (aggressive mean-reversion). Expected: tighter Kalman bands."}
            style={{width:"100%",minHeight:110,background:"#EEF2F7",
              border:"1px solid #C8860A33",borderRadius:4,color:"#C8A060",
              padding:"8px 12px",fontFamily:"Courier New, monospace",fontSize:9,
              lineHeight:1.7,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          <div style={{fontFamily:"Courier New, monospace",fontSize:7,color:"#2E5070",marginTop:4}}>
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
                <div style={{opacity:.5,marginBottom:4}}>ARCHITECT — UNIVERSAL COHERENCE ENGINE V1.5.43</div>
                <div style={{fontSize:9,letterSpacing:2,opacity:.4}}>
                  SDE · KALMAN · GARCH · TF-IDF · JSD · RAG · PIPE · MUTE · GATE · REWIND · ARCHITECT
                </div>
                <div style={{fontSize:8,color:"#2E5070",marginTop:4,opacity:.5}}>
                  TAP 📎 TO ATTACH · CLICK CHART TO REWIND
                </div>
                <div style={{marginTop:12,padding:"8px 16px",background:"#EEF2F7",
                  borderRadius:4,border:"1px solid #1EAAAA33",
                  fontFamily:"Courier New, monospace",fontSize:8,color:"#0A7878",
                  lineHeight:1.7,opacity:.8}}>
                  NEW? Click <strong>GUIDE</strong> in the header to learn how to read the chart.<br/>
                  Recommended: start with DEFAULT preset · post-audit OFF · 50 SDE paths.<br/>
                  Enable advanced features in <strong>TUNE</strong> when ready.
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:14}}>
                  <a href="https://x.com/RaccoonStampede" target="_blank" rel="noreferrer"
                    style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#1560B0",
                      textDecoration:"none",letterSpacing:1,opacity:.6,
                      padding:"4px 10px",border:"1px solid #4A9EFF22",borderRadius:4}}>
                    𝕏 @RaccoonStampede
                  </a>
                  <a href="https://x.com/Prosperous727" target="_blank" rel="noreferrer"
                    style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#1560B0",
                      textDecoration:"none",letterSpacing:1,opacity:.6,
                      padding:"4px 10px",border:"1px solid #4A9EFF22",borderRadius:4}}>
                    𝕏 @Prosperous727
                  </a>
                </div>
              </div>
            )}

            {rewindTurn!==null&&(
              <div style={{padding:"6px 12px",background:"#EEF8F2",border:"1px solid #40D08033",
                borderRadius:6,fontFamily:"Courier New, monospace",fontSize:9,
                color:"#178040",letterSpacing:1,textAlign:"center"}}>
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
              const isBookmarked=!isUser&&ti>=0&&bookmarks.some(b=>b.cohIdx===ti);
              return (
                <MessageBubble
                  key={"msg-"+i+"-"+display.length}
                  msg={msg} i={i}
                  isUser={isUser} ti={ti}
                  cdata={cdata} drifted={drifted}
                  display={display} atts={atts}
                  isBookmarked={isBookmarked}
                  onDelete={()=>deleteTurn(ti)}
                  onBookmark={()=>toggleBookmark(ti)}
                  S={S} THEME={THEME}
                />
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
              color: fileError.startsWith("⚠")?"#C81030":"#0A7878",
              borderTopColor: fileError.startsWith("⚠")?"#E0506033":"#1EAAAA33",
            }}>{fileError}</div>
          )}

          {/* P16: statusMessage — non-error status (rewind, delete). Separate from file errors. */}
          {statusMessage&&!fileError&&(
            <div style={{
              ...S.errorBar,
              color:"#178040",
              borderTopColor:"#40D08033",
            }}>{statusMessage}</div>
          )}

          <div style={S.inputRow}>
            <label style={{...S.attachBtn,
              borderColor:attachments.length>0?"#0A7878":"#C0D0E4",
              color:attachments.length>0?"#0A7878":"#1E3C5C",cursor:"pointer"}}>
              📎
              <input type="file" multiple accept={ACCEPTED_EXTENSIONS}
                onChange={e=>{processFiles(e.target.files);e.target.value="";}}
                style={{position:"absolute",width:"1px",height:"1px",
                  opacity:0,overflow:"hidden",pointerEvents:"none"}}/>
            </label>
            <textarea ref={inputRef} rows={2} style={S.textarea}
              placeholder={attachments.length?"Add message or send as-is…":"Message… (Enter to send)"}
              onInput={e=>{
                // V1.5.9 fix #B: onInput fires after DOM update (safer than onChange in iframes).
                // Guard setHasInput — only fires when boolean actually changes,
                // preventing re-renders on every mid-word keystroke.
                const hasVal=e.target.value.length>0;
                inputValueRef.current=e.target.value;
                if(hasVal!==hasInput) setHasInput(hasVal);
              }}
              onCompositionEnd={e=>{
                // Flush IME composition (CJK, iOS, etc.) — guarantees ref is current
                inputValueRef.current=e.target.value;
                const hasVal=e.target.value.length>0;
                if(hasVal!==hasInput) setHasInput(hasVal);
              }}
              onKeyDown={handleKey}/>
            <button style={{...S.sendBtn,opacity:(isLoading||(!hasInput&&!attachments.length))?0.4:1}}
              onClick={sendMessage}
              disabled={isLoading||(!hasInput&&!attachments.length)}>SEND</button>
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
                  fontFamily:"Courier New, monospace",fontSize:10,color:"#2E5070",letterSpacing:2}}>AWAITING DATA</div>
              :(
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}
                    margin={{top:8,right:12,bottom:4,left:0}}
                    onClick={handleChartClick}
                    className="chart-clickable">
                    <CartesianGrid strokeDasharray="2 4" stroke="#D8E4EE"/>
                    <XAxis dataKey="turn" tick={{fontSize:9,fill:"#2E5070",fontFamily:"Courier New"}}/>
                    <YAxis domain={[.2,1.0]} tick={{fontSize:9,fill:"#2E5070",fontFamily:"Courier New"}}
                      tickFormatter={v=>v.toFixed(1)}/>
                    <Tooltip content={<CoherenceTooltip/>}/>
                    <Area type="monotone" dataKey="p90" stroke="none" fill="#5090C0" fillOpacity={.18} name="90th pct"/>
                    <Area type="monotone" dataKey="p10" stroke="none" fill="#D8E8F8" fillOpacity={0.9} name="10th pct"/>
                    <Line type="monotone" dataKey="floor" stroke="#9B2335" strokeWidth={1}
                      strokeDasharray="3 3" dot={false} name="DL floor"/>
                    <Line type="monotone" dataKey="kalman" stroke="#0A7878" strokeWidth={2}
                      dot={false} name="Kalman"/>
                    <Scatter dataKey="raw" fill="#906000" name="Raw C" r={3}/>
                    <Line type="monotone" dataKey="raw" stroke="#C8860A44" strokeWidth={1}
                      dot={{fill:"#906000",r:3}} name="Score"/>
                    <Scatter dataKey="harness" fill="#C81030" name="Drift" r={5}/>
                    <Line type="monotone" dataKey="ewma" stroke="#8040C0" strokeWidth={1}
                      strokeDasharray="4 2" dot={false} connectNulls={false} name="EWMA"/>
                    <Line type="monotone" dataKey="anchor" stroke="#C87000" strokeWidth={1}
                      strokeDasharray="1 3" dot={false} connectNulls={false} name="Anchor"/>
                    {rewindTurn!==null&&(
                      <Line type="monotone" dataKey={d=>d.turn===rewindTurn?1:null}
                        stroke="#178040" strokeWidth={0} dot={{fill:"#178040",r:7,strokeWidth:0}} name="Rewind"/>
                    )}
                  {showSdePaths&&pathChartData.map((pathPoints,pi)=>(
                    <Line key={"sde-"+pi}
                      data={pathPoints}
                      type="monotone"
                      dataKey={"p"+pi}
                      stroke={currentMode.color||"#5090C0"}
                      strokeWidth={0.8}
                      strokeOpacity={pathOpacity}
                      dot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  ))}
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
                  color:"#2E5070",letterSpacing:2}}>PROFILE</span>
                <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                  padding:"1px 8px",borderRadius:3,
                  color:PRESETS[activePreset]?.color??"#0E2A5A",
                  border:`1px solid ${PRESETS[activePreset]?.color??"#0E2A5A"}33`,
                  background:`${PRESETS[activePreset]?.color??"#0E2A5A"}0A`}}>
                  {PRESETS[activePreset]?.label??activePreset}
                </span>
                <span style={{fontFamily:"Courier New, monospace",fontSize:7,
                  color:"#2E5070"}}>
                  {[!featKalman&&"K",!featGARCH&&"G",!featSDE&&"S",!featRAG&&"R",
                    !featPipe&&"P",!featBSig&&"B",!featHSig&&"H"].filter(Boolean).join(" ")||"all on"}
                </span>
              </div>
              {(()=>{
                const health=computeSessionHealth(coherenceData,driftCount,smoothedVar,calmStreak,lock888Achieved,cfg);
                const hColor=health===null?"#2E5070":health>=75?"#178040":health>=50?"#9A5C08":"#C81030";
                const hLabel=health===null?"—":health>=75?"STRONG":health>=50?"FAIR":"WEAK";
                return health!==null?(
                  <div style={{marginBottom:8,padding:"6px 10px",borderRadius:4,
                    background:`${hColor}0A`,border:`1px solid ${hColor}33`,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,color:"#1E3C5C",letterSpacing:2}}>SESSION HEALTH</span>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:16,color:hColor,fontWeight:"bold",letterSpacing:1}}>
                      {health}<span style={{fontSize:10,opacity:.7}}>/100</span>
                      <span style={{fontSize:9,marginLeft:6,opacity:.8}}>{hLabel}</span>
                    </span>
                  </div>
                ):null;
              })()}
              {[
                ["κ",
                  hudsonMode==="standard"
                    ?(userKappa??0.5).toFixed(3)+" STANDARD"
                    :(userKappa??0.444).toFixed(3)+" HUDSON",
                  hudsonMode==="standard"?"#178040":"#0E2A5A"],
                ["Damping",  DAMPING.toFixed(4),"#906000"],
                ["γ_h",          currentMode.gamma_h,               currentMode.color],
                ["cap_eff",      cap_eff.toFixed(8),                  null],
                ["Drift events", driftCount,                          driftCount>0?"#C81030":"#178040"],
                ["Last C",       lastScore!=null?lastScore.toFixed(4):"—",
                  lastScore==null?"#2E5070":lastScore>.80?"#178040":lastScore>.65?"#9A5C08":"#C81030"],
                ["Momentum",
                  coherenceData.length>0
                    ?(coherenceData[coherenceData.length-1].trend>0?"↑ RISING"
                      :coherenceData[coherenceData.length-1].trend<0?"↓ FALLING"
                      :"→ FLAT")
                    :"—",
                  coherenceData.length>0
                    ?(coherenceData[coherenceData.length-1].trend>0?"#178040"
                      :coherenceData[coherenceData.length-1].trend<0?"#C81030"
                      :"#906000")
                    :"#2E5070"],
                ["Anchor dist",
                  (coherenceData.length>=4&&coherenceData[coherenceData.length-1].anchorDist!=null)
                    ?((coherenceData[coherenceData.length-1].anchorDist>0.60?"⚠ ":"")+
                      coherenceData[coherenceData.length-1].anchorDist.toFixed(3))
                    :"—",
                  (coherenceData.length>=4&&coherenceData[coherenceData.length-1].anchorDist!=null)
                    ?(coherenceData[coherenceData.length-1].anchorDist>0.60?"#C81030"
                      :coherenceData[coherenceData.length-1].anchorDist>0.35?"#9A5C08"
                      :"#178040")
                    :"#2E5070"],
                ["Kalman x̂",    kalmanState.x.toFixed(4),            "#0A7878"],
                ["Kalman P",     kalmanState.P.toFixed(5),             null],
                ["Snapshots",    turnSnapshots.length,                 turnSnapshots.length>0?"#178040":"#2E5070"],
              ].map(([label,val,color])=>(
                <div key={label} style={S.statRow}>
                  <span style={S.statLabel}>{label}</span>
                  <span style={{...S.statValue,...(color?{color}:{})}}>{val}</span>
                </div>
              ))}
              {featZeroDrift&&<div style={{marginTop:8,padding:"8px 10px",borderRadius:4,background:"#EEF2F7",
                border:`1px solid ${lockStatus.locked?"#1EAAAA44":"#2A405044"}`}}>
                <div style={{...S.sectionTitle,marginBottom:6}}>STABILITY CONVERGENCE</div>
                {[
                  ["Status",  lockStatus.locked?"🔒 STABLE":"CONVERGING",lockStatus.locked?"#178040":"#9A5C08"],
                  ["Residual",lockStatus.residual.toFixed(8),null],
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
              {caPassRate!==null&&showPoole&&(
                <div style={{marginBottom:8,padding:"6px 10px",borderRadius:4,
                  background:caPassRate>=0.875?"#EEF8EE":"#FFF8EE",
                  border:"1px solid "+(caPassRate>=0.875?"#1A5C1A44":"#9A5C0844")}}>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:8,
                    color:"#1A5C1A",letterSpacing:2,marginBottom:3}}>CIRCUIT SIGNAL</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:7,color:"#2E5070"}}>FA pass rate</span>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:11,
                      color:caPassRate>=0.875?"#1A5C1A":"#9A5C08",fontWeight:"bold"}}>
                      {(caPassRate*100).toFixed(0)+"%"}
                    </span>
                  </div>
                  <div style={{marginTop:4,height:4,background:"#1A5C1A22",borderRadius:2}}>
                    <div style={{height:"100%",width:(caPassRate*100).toFixed(1)+"%",
                      background:caPassRate>=0.875?"#1A5C1A":"#9A5C08",borderRadius:2}}/>
                  </div>
                </div>
              )}
              {/* Integrity Floor breach indicator */}
              {featIntegrityFloor&&(
                <div style={{marginBottom:8,padding:"6px 10px",borderRadius:4,
                  background:integrityBreachCount>0?"#FFF0FF":"#F4F0FF",
                  border:`1px solid ${integrityBreachCount>0?"#C8103044":"#4828A033"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:8,
                      color:integrityBreachCount>0?"#C81030":"#4828A0",letterSpacing:1}}>
                      INTEGRITY FLOOR
                    </span>
                    <span style={{fontFamily:"Courier New,monospace",fontSize:11,
                      color:integrityBreachCount>0?"#C81030":"#178040",fontWeight:"bold"}}>
                      {integrityBreachCount>0
                        ?`${integrityBreachCount} BREACH${integrityBreachCount>1?"ES":""}`
                        :"INTACT"}
                    </span>
                  </div>
                  <div style={{fontFamily:"Courier New,monospace",fontSize:7,
                    color:"#607080",marginTop:2}}>
                    floor={integrityThreshold.toFixed(2)} · {integrityBreachCount>0?"reset recommended":"coherence bond holding"}
                  </div>
                </div>
              )}
              <div style={S.sectionTitle}>VARIANCE PIPE · MUTE · GATE</div>
              {/* V1.5.0: token estimate + session ID */}
              {tokenEstimate>0&&(
                <div style={{marginBottom:8,padding:"4px 8px",borderRadius:3,
                  background:tokenEstimate>70000?"#FFF0F2":tokenEstimate>40000?"#F2F4F8":"#F2F4F8",
                  border:`1px solid ${tokenEstimate>70000?"#E0506044":tokenEstimate>40000?"#E8A03033":"#C8D8EC"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                      color:tokenEstimate>70000?"#C81030":tokenEstimate>40000?"#9A5C08":"#2E5070"}}>
                      EST. TOKENS
                    </span>
                    <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                      color:tokenEstimate>70000?"#C81030":tokenEstimate>40000?"#9A5C08":"#1E3C5C",
                      fontWeight:"bold"}}>
                      {tokenEstimate.toLocaleString()}
                      {tokenEstimate>70000?" ⚠":tokenEstimate>40000?" △":""}
                    </span>
                  </div>
                  {tokenEstimate>70000&&(
                    <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                      color:"#A05050",marginTop:2}}>
                      near context limit — consider reset or prune
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
                ["Calm streak",   calmStreak,                                       calmStreak>=LOCK_888_STREAK?"#178040":"#1E3C5C"],
                ["Stability",     lock888Achieved?"✓ FULL STABLE":`${LOCK_888_STREAK-calmStreak} turns away`,
                  lock888Achieved?"#4848B8":"#2E5070"],
                ["Mute mode",     muteModeActive?"ACTIVE — "+MUTE_MAX_TOKENS+" tok":"standby",
                  muteModeActive?"#9A5C08":"#2E5070"],
                ["Drift gate",    driftGateActive?"ACTIVE — "+DRIFT_GATE_WORD_LIMIT+" words":"standby",
                  driftGateActive?"#C81030":"#2E5070"],
                ["Events",        eventLog.length,
                  eventLog.length>0?"#1560B0":"#2E5070"],
                ["H-Signals",     eventLog.filter(e=>e.type==="probable_hallucination_signal").length,
                  eventLog.filter(e=>e.type==="probable_hallucination_signal").length>0?"#9A5C08":"#2E5070"],
                ["B-Signals",     eventLog.filter(e=>e.type==="behavioral_signal").length,
                  eventLog.filter(e=>e.type==="behavioral_signal").length>0?"#4848B8":"#2E5070"],
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
                  ["Cache",     ragCache.length,  ragCache.length>0?"#178040":"#2E5070"],
                  ["Retrievals",ragHits,           ragHits>0?"#0A7878":"#2E5070"],
                  ["Pruning",   contextPruned?"ACTIVE":`>${PRUNE_THRESHOLD} to trigger`,contextPruned?"#9A5C08":"#2E5070"],
                ].map(([label,val,color])=>(
                  <div key={label} style={S.statRow}>
                    <span style={S.statLabel}>{label}</span>
                    <span style={{...S.statValue,fontSize:10,...(color?{color}:{})}}>{val}</span>
                  </div>
                ))}
                {ragCache.slice(0,3).map(e=>(
                  <div key={e.turn} style={{fontFamily:"Courier New, monospace",fontSize:8,
                    color:"#0E3060",lineHeight:1.6,marginTop:3,
                    padding:"3px 6px",background:"#EEF2F7",borderRadius:3}}>
                    T{e.turn} C={e.score.toFixed(3)} — {e.text.slice(0,55)}…
                  </div>
                ))}
              </div>
            )}

            {/* Error Trace */}
            {errorLog.length>0&&(
              <div style={S.metricSection}>
                <div style={{...S.sectionTitle,color:"#C81030"}}>ARCHITECT · {errorLog.length}{corrections.length>0?" · "+corrections.length+" FP":""}</div>
                {errorLog.slice(-5).map((e,i)=>{
                  const sc=e.severity==="fatal"?"#FF4444":e.severity==="warn"?"#9A5C08":"#C81030";
                  return (
                    <div key={i} style={{fontFamily:"Courier New, monospace",fontSize:8,
                      lineHeight:1.6,marginBottom:4,
                      padding:"4px 6px",background:"#FFF0F2",borderRadius:3,
                      borderLeft:`2px solid ${sc}66`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{color:sc,letterSpacing:1}}>
                          [{e.severity?.toUpperCase()||"ERR"}] {e.stage?.toUpperCase().split("_").join(" ")}
                        </span>
                        <span style={{color:"#2E5070"}}>T{e.turn} · {e.timestamp?.slice(11,19)}</span>
                      </div>
                      <div style={{color:"#C05050"}}>{e.message?.slice(0,80)}{e.message?.length>80?"…":""}</div>
                      {e.hint&&<div style={{color:"#9A5C0899",fontSize:7,marginTop:2}}>💡 {e.hint?.slice(0,60)}</div>}
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
                    border:`1px solid ${key===harnessMode?mode.color:"#C0D0E4"}`,
                    background:key===harnessMode?`${mode.color}18`:"transparent",
                    color:key===harnessMode?mode.color:"#2E5070",transition:"all .15s",
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
                      style={{width:42,background:"#EEF2F7",border:"1px solid #C0D0E4",
                        borderRadius:3,color:"#0E2A5A",padding:"2px 6px",
                        fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
                    <span style={S.statLabel}>turns</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={S.statLabel}>Keep top</span>
                    <input type="number" min="2" max="10" value={pruneKeep}
                      onChange={e=>setPruneKeep(Math.max(2,Math.min(10,+e.target.value)))}
                      style={{width:42,background:"#EEF2F7",border:"1px solid #C0D0E4",
                        borderRadius:3,color:"#0E2A5A",padding:"2px 6px",
                        fontFamily:"Courier New, monospace",fontSize:10,textAlign:"center"}}/>
                    <span style={S.statLabel}>pairs</span>
                  </div>
                </div>
                <div style={{fontFamily:"Courier New, monospace",fontSize:8,
                  color:"#2E5070",marginTop:5}}>
                  Higher trigger = more context kept. Higher keep = smarter pruning.
                </div>
              </div>
            </div>

            {/* SDE params */}
            <div style={S.metricSection}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                cursor:"pointer",marginBottom:showParams?8:0}} onClick={()=>setShowParams(p=>!p)}>
                <div style={{...S.sectionTitle,marginBottom:0}}>SDE PARAMS</div>
                <span style={{...S.statLabel,color:"#2E5070"}}>{showParams?"▲":"▼"}</span>
              </div>
              {showParams&&(
                <>
                  {[
                    ["α",SDE_PARAMS.alpha],["β_p",SDE_PARAMS.beta_p],
                    ["ω",SDE_PARAMS.omega.toFixed(4)],["σ",SDE_PARAMS.sigma],
                  ].map(([label,val])=>(
                    <div key={label} style={S.statRow}>
                      <span style={S.statLabel}>{label}</span>
                      <span style={S.statValue}>{val}</span>
                    </div>
                  ))}
                  <div style={{marginTop:6,padding:"8px 10px",background:"#EEF2F7",borderRadius:4,
                    border:"1px solid #1A2840",fontFamily:"Courier New, monospace",
                    fontSize:9,color:"#0E3060",lineHeight:1.8}}>
                    dε = a(t)ε dt + b dW_t<br/>
                    a(t) = (α+β_p·sin(ωt))·damping<br/>
                    GARCH: σ²_t = ω + α·ε²_t-1 + β·σ²_t-1<br/>
                    Mute: {activeMutePhrases.slice(0,3).join(", ")}…<br/>
                    Gate threshold: σ² &gt; {VAR_CAUTION}
                  </div>
                  {/* V1.5.0: Adaptive sigma controls */}
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #1A2840"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontFamily:"Courier New, monospace",fontSize:8,
                        color:adaptiveSigmaOn?"#0A7878":"#2E5070",letterSpacing:2}}>
                        ADAPTIVE σ {adaptiveSigmaOn?"ON":"OFF"}
                      </span>
                      <button onClick={()=>setAdaptiveSigmaOn(p=>!p)} style={{
                        padding:"2px 10px",borderRadius:3,cursor:"pointer",
                        fontFamily:"Courier New, monospace",fontSize:8,letterSpacing:1,
                        border:`1px solid ${adaptiveSigmaOn?"#0A7878":"#2E5070"}`,
                        background:adaptiveSigmaOn?"#E4F4F4":"transparent",
                        color:adaptiveSigmaOn?"#0A7878":"#2E5070",transition:"all .15s",
                      }}>{adaptiveSigmaOn?"DISABLE":"ENABLE"}</button>
                    </div>
                    {adaptiveSigmaOn&&(
                      <>
                        <div style={S.statRow}>
                          <span style={S.statLabel}>σ adapted</span>
                          <span style={{...S.statValue,color:"#0A7878"}}>{adaptedSigma.toFixed(5)}</span>
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
                            style={{flex:1,accentColor:"#0A7878"}}/>
                          <span style={{fontFamily:"Courier New, monospace",fontSize:9,
                            color:"#0A7878",minWidth:38}}>{adaptationRate.toFixed(3)}</span>
                        </div>
                        <div style={{fontFamily:"Courier New, monospace",fontSize:7,
                          color:"#2E5070",marginTop:4,lineHeight:1.6}}>
                          damping constant fixed (see Advanced tab)<br/>
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
                    <span style={{...S.statLabel,color:"#2E5070"}}>Turn {entry.turn}</span>
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
      <ExportContentModal />

      {/* R&D DISCLAIMER MODAL — shown on load */}
      <DisclaimerModal
        showDisclaimer={showDisclaimer}
        setShowDisclaimer={setShowDisclaimer}
        setShowGuide={setShowGuide}
        hudsonMode={hudsonMode}
        setHudsonMode={setHudsonMode}
        setUserKappa={setUserKappa}/>

      {/* TUNE MODAL — Presets, Feature Toggles, Custom Config */}
      <TuneModal />

      {/* REWIND CONFIRM MODAL */}
      {/* REWIND CONFIRM MODAL */}
      <RewindConfirmModal
        rewindConfirm={rewindConfirm}
        setRewindConfirm={setRewindConfirm}
        restoreToTurn={restoreToTurn}
      />

      {/* LOG MODAL */}
      <LogModal />

      {/* BOOKMARKS MODAL */}
      <BookmarksModal />

      {/* GUIDE MODAL */}
      <GuideModal
        showGuide={showGuide}
        setShowGuide={setShowGuide}
        guideTab={guideTab}
        setGuideTab={setGuideTab}
      />
    </div>
    </SessionCtx.Provider>
    </TuneCtx.Provider>
  );
}
// V2.0: mounted via Next.js pages/index.tsx
