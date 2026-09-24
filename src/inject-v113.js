/* ============================================================
   v113 — Sculpture audio/time contract (Obsidian Bloom foundation)
   One feature source for live file playback, realtime capture and HQ/range export:
   a per-track timeline on a fixed 60 Hz grid, sampled by ABSOLUTE song time.
   No random or clock sources in here — same audio + same time => same numbers.
   ============================================================ */

function sculptureTaus() {
  return { form: [0.25, 0.6], surf: [0.10, 0.25], gloss: [0.06, 0.30], loud: [0.08, 0.4] };
}

function sculptureTimelineInit(buf) {
  const fps = 60, FFT = 2048, half = FFT >> 1, frames = Math.max(1, Math.round(buf.duration * fps));
  const hann = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT - 1));
  const mk = () => new Float32Array(frames);
  return {
    buf, fps, FFT, half, frames, hann, re: new Float32Array(FFT), im: new Float32Array(FFT), next: 0,
    tl: { fps, frames, srcBuffer: buf, subBass: mk(), bass: mk(), lowMid: mk(), mid: mk(), highMid: mk(), air: mk(),
          form: mk(), surf: mk(), gloss: mk(), kick: mk(), snare: mk(), loud: mk() }
  };
}

/* processes up to `count` grid frames; returns true once every frame is done */
function sculptureTimelineStep(st, count) {
  const edges = [[20, 60, "subBass"], [60, 160, "bass"], [160, 500, "lowMid"], [500, 2000, "mid"], [2000, 6000, "highMid"], [6000, 16000, "air"]];
  const ch = st.buf.getChannelData(0), sr = st.buf.sampleRate, binHz = sr / st.FFT, half = st.half, tl = st.tl;
  const end = Math.min(st.frames, st.next + count);
  for (let f = st.next; f < end; f++) {
    const start = Math.floor((f / st.fps) * sr) - half;
    for (let i = 0; i < st.FFT; i++) { const s = start + i; st.re[i] = (s >= 0 && s < ch.length ? ch[s] : 0) * st.hann[i]; st.im[i] = 0; }
    fftRadix2(st.re, st.im);
    for (let b = 0; b < edges.length; b++) {
      const lo = Math.max(1, Math.floor(edges[b][0] / binHz)), hi = Math.max(lo, Math.min(half - 1, Math.ceil(edges[b][1] / binHz)));
      let sum = 0;
      for (let i = lo; i <= hi; i++) {
        const mag = Math.sqrt(st.re[i] * st.re[i] + st.im[i] * st.im[i]) / st.FFT;
        const db = 20 * Math.log10(mag + 1e-12);
        sum += Math.max(0, Math.min(1, (db + 100) / 70));
      }
      tl[edges[b][2]][f] = sum / (hi - lo + 1);
    }
  }
  st.next = end;
  return st.next >= st.frames;
}

/* bakes onsets + envelope followers (stepped once per grid frame => frame-rate independent) */
function sculptureTimelineFinish(st) {
  const tl = st.tl, dt = 1 / st.fps, T = sculptureTaus();
  const rise = tau => 1 - Math.exp(-dt / tau);
  const aF = rise(T.form[0]), rF = rise(T.form[1]), aS = rise(T.surf[0]), rS = rise(T.surf[1]);
  const aG = rise(T.gloss[0]), rG = rise(T.gloss[1]), aL = rise(T.loud[0]), rL = rise(T.loud[1]);
  let form = 0, surf = 0, gloss = 0, loud = 0, kick = 0, snare = 0, prevKick = 0, prevSnare = 0;
  const follow = (v, x, a, r) => v + (x - v) * (x > v ? a : r);
  for (let f = 0; f < st.frames; f++) {
    const kE = (tl.subBass[f] + tl.bass[f]) * 0.5, mE = (tl.lowMid[f] + tl.mid[f]) * 0.5, hE = (tl.highMid[f] + tl.air[f]) * 0.5;
    form = follow(form, kE, aF, rF); surf = follow(surf, mE, aS, rS); gloss = follow(gloss, hE, aG, rG);
    loud = follow(loud, Math.min(1, kE * 0.5 + mE * 0.35 + hE * 0.15), aL, rL);
    const kJ = Math.max(0, kE - prevKick);
    kick = Math.max(kick * 0.88, kJ > 0.04 ? Math.min(1, kJ * 8) : 0);
    prevKick = prevKick * 0.7 + kE * 0.3;
    const sE = (tl.mid[f] + tl.highMid[f]) * 0.5, sJ = Math.max(0, sE - prevSnare);
    snare = Math.max(snare * 0.88, sJ > 0.04 ? Math.min(1, sJ * 8) : 0);
    prevSnare = prevSnare * 0.7 + sE * 0.3;
    tl.form[f] = form; tl.surf[f] = surf; tl.gloss[f] = gloss; tl.loud[f] = loud; tl.kick[f] = kick; tl.snare[f] = snare;
  }
  return tl;
}

function buildSculptureTimeline(buf) {
  const st = sculptureTimelineInit(buf);
  sculptureTimelineStep(st, st.frames);
  return sculptureTimelineFinish(st);
}

/* chunked (240 frames per slice, then yield) so a 4-minute track never freezes the UI */
function sculptureTimelineBuildAsync(buf, yieldFn) {
  const st = sculptureTimelineInit(buf);
  const y = yieldFn || (() => new Promise(r => setTimeout(r, 0)));
  const loop = () => sculptureTimelineStep(st, 240) ? Promise.resolve(sculptureTimelineFinish(st)) : y().then(loop);
  return loop();
}

function sampleSculptureTimeline(tl, t, out) {
  out = out || {};
  const last = tl.frames - 1, x = Math.max(0, Math.min(last, (t > 0 ? t : 0) * tl.fps));
  const i0 = Math.floor(x), i1 = Math.min(last, i0 + 1), k = x - i0;
  const keys = ["subBass", "bass", "lowMid", "mid", "highMid", "air", "form", "surf", "gloss", "kick", "snare", "loud"];
  for (let n = 0; n < keys.length; n++) { const a = tl[keys[n]]; out[keys[n]] = a[i0] + (a[i1] - a[i0]) * k; }
  return out;
}

/* mic / tab audio: causal followers with the same time constants; NOT reproducible by design */
function sculptureLiveStep(st, bands, kickOnset, snareOnset, dt, out) {
  out = out || {};
  dt = dt > 0 ? dt : 0;
  const T = sculptureTaus();
  const follow = (v, x, tau) => v + (x - v) * (1 - Math.exp(-dt / (x > v ? tau[0] : tau[1])));
  const kE = (bands.subBass + bands.bass) * 0.5, mE = (bands.lowMid + bands.mid) * 0.5, hE = (bands.highMid + bands.air) * 0.5;
  st.form = follow(st.form, kE, T.form); st.surf = follow(st.surf, mE, T.surf); st.gloss = follow(st.gloss, hE, T.gloss);
  st.loud = follow(st.loud, Math.min(1, kE * 0.5 + mE * 0.35 + hE * 0.15), T.loud);
  out.subBass = bands.subBass; out.bass = bands.bass; out.lowMid = bands.lowMid; out.mid = bands.mid; out.highMid = bands.highMid; out.air = bands.air;
  out.form = st.form; out.surf = st.surf; out.gloss = st.gloss; out.loud = st.loud;
  out.kick = kickOnset; out.snare = snareOnset;
  return out;
}

function sculptureSongTime(hqT, mediaT) {
  return hqT != null ? hqT : (mediaT > 0 ? mediaT : 0);
}

function sculptureNeeded(preset) {
  return !!(preset && preset.engine === "sculpture");
}

/* cached per decoded buffer; concurrent callers share one build */
function ensureSculptureTimeline(yieldFn) {
  const buf = S.audioBuffer;
  if (!buf) return Promise.resolve(null);
  if (S._sculptTL && S._sculptTL.srcBuffer === buf) return Promise.resolve(S._sculptTL);
  if (S._sculptTLP && S._sculptTLB === buf) return S._sculptTLP;
  S._sculptTLB = buf;
  S._sculptTLP = sculptureTimelineBuildAsync(buf, yieldFn).then(tl => { if (S._sculptTLB === buf) S._sculptTL = tl; return tl; });
  return S._sculptTLP;
}
