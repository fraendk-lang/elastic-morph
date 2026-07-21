/* ============================================================
   v58 — Master Finish, Cue Transitions, DNA Story, New Engines,
         Smart Look, Spotify Canvas, Batch Export, FX Rack III
   ============================================================ */

/* ---- deterministic pseudo-random (export-safe grain) ---- */
function seededRand(seed) {
  let s = seed | 0;
  return () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
}

/* ---- Master Post-Processing ---- */
const MASTER_GRADES = {
  none: "",
  cinematic: "contrast(1.12) saturate(1.15) brightness(0.95)",
  neon: "saturate(1.45) contrast(1.08) brightness(1.05)",
  warm: "sepia(0.22) saturate(1.2) contrast(1.05)",
  cold: "hue-rotate(18deg) saturate(0.9) contrast(1.1)",
  bw: "grayscale(1) contrast(1.15) brightness(1.02)"
};

function rebuildVignette(W, H) {
  const v = S.master.vignette;
  if (v <= 0.01) { vigGrad = null; return; }
  vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.38 - v * 0.08), W / 2, H / 2, Math.max(W, H) * (0.62 + v * 0.18));
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(1, `rgba(0,0,0,${v})`);
}

function applyMasterFinish(W, H, dt) {
  const M = S.master;
  if (!M.on) {
    if (vigGrad) { ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, W, H); }
    if ((currentDNA().grain || 0) > 0) drawPresetGrain(W, H);
    return;
  }
  snapshot(W, H);
  const grade = MASTER_GRADES[M.grade] || "";
  if (grade) { ctx.filter = grade; ctx.drawImage(fxC, 0, 0, W, H); ctx.filter = "none"; }
  else ctx.drawImage(fxC, 0, 0, W, H);

  if (M.chroma > 0.01) {
    const d = Math.max(0.5, W * 0.0014 * M.chroma * (1 + S.beat * 0.2));
    chctx.globalCompositeOperation = "copy";
    chctx.drawImage(canvas, 0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.14 * M.chroma;
    ctx.drawImage(chC, 0, 0, W, H, -d, 0, W, H);
    ctx.globalAlpha = 0.1 * M.chroma;
    ctx.drawImage(chC, 0, 0, W, H, d, 0, W, H);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  if (M.grain > 0.01) {
    const rng = seededRand(Math.floor(S.time * 60) + Math.floor(S.seed * 100));
    ctx.globalAlpha = M.grain * 0.14;
    const n = Math.round(80 + M.grain * 220);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rng() > 0.5 ? "#fff" : "#000";
      ctx.fillRect(rng() * W, rng() * H, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  if (M.vignette > 0.01 && vigGrad) {
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPresetGrain(W, H) {
  const g = currentDNA().grain || 0;
  if (g <= 0) return;
  const rng = seededRand(Math.floor(S.time * 60) + 7);
  ctx.globalAlpha = g * 0.12;
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = rng() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(rng() * W, rng() * H, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
}

/* ---- Cue Transitions ---- */
function applyCueImmediate(cue) {
  if (cue.scene >= 0) recallScene(cue.scene);
  if (cue.fx) {
    Object.keys(S.fx).forEach(k => S.fx[k] = cue.fx.a.includes(k));
    Object.keys(S.fx2).forEach(k => S.fx2[k] = cue.fx.b.includes(k));
    if (!S.fx.feedback) fbctx.clearRect(0, 0, fbC.width, fbC.height);
    syncFXUI(); syncFX2UI();
  }
}

function startCueTransition(cue) {
  const type = cue.trans || S.setTransDefault.type || "cut";
  const dur = cue.transDur || S.setTransDefault.dur || 2;
  if (type === "cut" || dur <= 0.05) { applyCueImmediate(cue); S.cueTrans.active = false; return; }
  /* v59: true DNA morph — blend presets over the full duration (no fade-to-black) */
  if (type === "morph" && cue.scene >= 0) {
    const snap = loadScenes()[cue.scene];
    const toPreset = snap ? (PRESETS.find(p => p.id === snap.preset) || PRESETS[0]) : null;
    if (toPreset) {
      S.cueTrans = {
        active: true, t: 0, dur, type: "morph", pending: cue, overlay: 0, applied: false,
        morphFrom: { preset: S.preset, blendWith: S.blendWith, blendAmt: S.blendAmt },
        morphTo: { preset: toPreset }
      };
      return;
    }
  }
  S.cueTrans = { active: true, t: 0, dur, type, pending: cue, overlay: 0, applied: false };
}

function syncBlendUI() {
  if ($("blendSelect")) $("blendSelect").value = S.blendWith ? S.blendWith.id : "";
  if ($("blendAmt")) {
    $("blendAmt").value = Math.round(S.blendAmt * 100);
    if ($("blendVal")) $("blendVal").textContent = Math.round(S.blendAmt * 100) + "%";
  }
  updateBadge();
}

function tickCueTransition(dt) {
  const T = S.cueTrans;
  if (!T.active) return;
  T.t += dt;
  const p = Math.min(1, T.t / T.dur);
  if (T.type === "morph" && T.morphTo) {
    const e = p * p * (3 - 2 * p);
    S.preset = T.morphFrom.preset;
    S.blendWith = T.morphTo.preset;
    S.blendAmt = e;
    syncBlendUI();
    if (p >= 1) {
      applyCueImmediate(T.pending);
      T.active = false; T.applied = false; T.overlay = 0;
    }
    return;
  }
  if (T.type === "fade") {
    T.overlay = p < 0.5 ? p * 2 : (1 - p) * 2;
    if (p >= 0.5 && !T.applied) { applyCueImmediate(T.pending); T.applied = true; }
  } else if (T.type === "blur") {
    T.overlay = Math.sin(p * Math.PI);
    if (p >= 0.5 && !T.applied) { applyCueImmediate(T.pending); T.applied = true; }
  } else if (T.type === "beat") {
    if (S.beat > 0.85 && !T.applied) { applyCueImmediate(T.pending); T.applied = true; T.active = false; }
    return;
  }
  if (p >= 1) { T.active = false; T.overlay = 0; T.applied = false; }
}

function drawCueTransitionOverlay(W, H) {
  const T = S.cueTrans;
  if (!T.active || !T.overlay) return;
  if (T.type === "morph") return;
  if (T.type === "blur" && T.overlay > 0.02) {
    snapshot(W, H);
    ctx.filter = `blur(${T.overlay * 12}px)`;
    ctx.drawImage(fxC, 0, 0, W, H);
    ctx.filter = "none";
    return;
  }
  if (T.type === "fade") {
    ctx.fillStyle = `rgba(0,0,0,${T.overlay * 0.85})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function applyCue(cue) { startCueTransition(cue); }

/* ---- DNA Story ---- */
function fpDisplayHash() {
  const h = S.fpHash || Math.abs(Math.imul(Math.floor(S.seed * 100), 2654435761));
  return ("00000000" + (h >>> 0).toString(16)).slice(-8).toUpperCase();
}

function drawDnaFingerprintPreview() {
  const cv = $("dnaFpCanvas"); if (!cv) return;
  const c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.fillStyle = "#050508"; c.fillRect(0, 0, W, H);
  const seed = S.seed, cx = W / 2, cy = H / 2, base = Math.min(W, H) * 0.28;
  const hue = (S.preset.hue + S.fpHue) % 360;
  c.save(); c.translate(cx, cy); c.globalCompositeOperation = "lighter";
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const n = noise2(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + seed * 0.7);
    const r = base * (0.75 + n * 0.35);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.strokeStyle = `hsla(${hue}, 70%, 60%, 0.85)`; c.lineWidth = 1.5; c.stroke();
  c.restore();
  const el = $("dnaFpHash"); if (el) el.textContent = fpDisplayHash();
  const el2 = $("dnaFpSeed"); if (el2) el2.textContent = S.seed.toFixed(2);
}

function exportDnaShareCard() {
  const W = 1200, H = 630;
  const t = document.createElement("canvas"); t.width = W; t.height = H;
  const c = t.getContext("2d");
  c.fillStyle = "#050507"; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1a0a2e"); g.addColorStop(1, "#0a1520");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.font = "700 48px -apple-system, sans-serif"; c.fillStyle = "#e8e8f0";
  c.fillText(S.textTitle || "Elastic Morph", 60, 100);
  c.font = "400 28px -apple-system, sans-serif"; c.fillStyle = "#8a8aa0";
  c.fillText(S.textArtist || "Visual DNA", 60, 145);
  c.font = "600 22px -apple-system, sans-serif"; c.fillStyle = "#b14bff";
  c.fillText("DNA " + fpDisplayHash(), 60, 560);
  c.font = "400 18px -apple-system, sans-serif"; c.fillStyle = "#1fe08a";
  c.fillText(S.preset.name, 60, 590);
  const seed = S.seed, cx = W * 0.72, cy = H * 0.48, base = 140;
  const hue = (S.preset.hue + S.fpHue) % 360;
  c.save(); c.translate(cx, cy); c.globalCompositeOperation = "lighter";
  c.beginPath();
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    const n = noise2(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + seed);
    const r = base * (0.7 + n * 0.45);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath(); c.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`; c.lineWidth = 2; c.stroke();
  c.restore();
  const a = document.createElement("a");
  a.download = "elastic-morph-dna.png"; a.href = t.toDataURL("image/png"); a.click();
}

/* ---- Smart Look ---- */
function scorePresetForTrack(p) {
  if (!S.energyCurve || !S.energyCurve.length) return Math.random();
  const avg = S.energyCurve.reduce((a, b) => a + b, 0) / S.energyCurve.length;
  const peak = Math.max(...S.energyCurve);
  const bpm = S.bpm || 120;
  let s = 0;
  const eng = p.engine || "blob";
  if (eng === "dance" && bpm >= 115) s += 4;
  if (eng === "flame" || eng === "filament") s += avg < 0.45 ? 3 : 1;
  if (eng === "attractor" || eng === "hyperspace") s += 2;
  if (eng === "sacred") s += avg < 0.55 ? 2.5 : 0.5;
  if (eng === "oscilloscope" || eng === "lissajous") s += avg < 0.5 ? 2 : 1;
  if (eng === "spectrogram") s += peak > 0.65 ? 3 : 1;
  if (eng === "flocking") s += bpm >= 100 && bpm <= 140 ? 2.5 : 1;
  if (eng === "fluid") s += avg < 0.6 ? 2 : 0.5;
  if (p.id === "signal" || p.id === "neontide") s += peak > 0.6 ? 2 : 0;
  if (p.id === "liquid" || p.id === "dust") s += avg < 0.4 ? 2.5 : 0;
  if (p.id === "danceClub" || p.id === "danceDisco") s += bpm >= 120 ? 3 : 0;
  s += ((S.seed * 0.01 + p.hue) % 10) * 0.05;
  return s;
}

function suggestSmartLooks() {
  return PRESETS.map(p => ({ p, score: scorePresetForTrack(p) }))
    .sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.p);
}

function renderSmartLooks() {
  const host = $("smartLookRow"); if (!host) return;
  host.innerHTML = "";
  if (!S.energyCurve) {
    host.innerHTML = '<p class="note">Track laden — dann erscheinen Empfehlungen.</p>';
    return;
  }
  suggestSmartLooks().forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "btn" + (i === 0 ? " primary" : "");
    btn.textContent = (i + 1) + ". " + p.name;
    btn.addEventListener("click", () => {
      S.preset = p;
      document.querySelectorAll("#presetGrid .preset-card").forEach((c, j) =>
        c.classList.toggle("active", PRESETS[j] === p));
      updateBadge(); spawnParticles(); drawDnaFingerprintPreview();
    });
    host.appendChild(btn);
  });
}

/* ---- New DNA Engines ---- */
const SPEC_BUF = { data: null, w: 0, h: 0, head: 0 };
const FLOCK = { boids: null, seed: null };
const FLUID = { w: 0, h: 0, vx: null, vy: null, dens: null, seed: null };

function drawOscilloscope(base, hue, growthF, energySize, seed) {
  const W = canvas.width, H = canvas.height, cx = 0, cy = 0;
  const R = base * growthF * energySize * 1.1;
  const n = Math.round(120 + 80 * (S.exporting ? S.exportScale : S.perfScale));
  ctx.lineWidth = 1.2 + S.beat * 2;
  ctx.strokeStyle = `hsla(${hue}, ${currentDNA().sat}%, 65%, ${0.35 + S.loudness * 0.4})`;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bx = Math.sin(a * 2 + S.time * 0.8 + seed) * S.bass;
    const by = Math.cos(a * 3 + S.time * 0.6 + seed * 0.3) * S.mids;
    const hz = Math.sin(a * 5 - S.time * 2) * S.highs * 0.5;
    const r = R * (1 + bx * 0.35 + by * 0.25 + hz * 0.15);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * currentDNA().verticalStretch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 0.25 + S.beat * 0.3;
  ctx.strokeStyle = `hsla(${(hue + 40) % 360}, 90%, 75%, 0.6)`;
  ctx.stroke(); ctx.globalAlpha = 1;
}

function drawSpectrogram(base, hue, growthF, energySize, seed) {
  const W = canvas.width, H = canvas.height;
  const cols = Math.round(48 * (S.exporting ? 1 : Math.max(0.5, S.perfScale)));
  const rows = Math.round(24 * (S.exporting ? 1 : Math.max(0.5, S.perfScale)));
  if (!SPEC_BUF.data || SPEC_BUF.w !== cols || SPEC_BUF.h !== rows) {
    SPEC_BUF.w = cols; SPEC_BUF.h = rows; SPEC_BUF.data = new Float32Array(cols * rows); SPEC_BUF.head = 0;
  }
  const col = SPEC_BUF.head % cols;
  for (let r = 0; r < rows; r++) {
    const f = r / rows;
    const v = f < 0.33 ? S.bass * (1 - f * 2) : f < 0.66 ? S.mids : S.highs;
    SPEC_BUF.data[col * rows + r] = v * (0.6 + noise2(col * 0.1 + seed, r * 0.2 + S.time) * 0.4);
  }
  SPEC_BUF.head++;
  const cellW = W / cols, cellH = H * 0.55 / rows;
  const y0 = H * 0.2;
  for (let c = 0; c < cols; c++) {
    const ci = (SPEC_BUF.head - cols + c + cols * 999) % cols;
    for (let r = 0; r < rows; r++) {
      const v = SPEC_BUF.data[ci * rows + r] || 0;
      if (v < 0.04) continue;
      const lh = (hue + r * 4 + v * 40) % 360;
      ctx.fillStyle = `hsla(${lh}, ${currentDNA().sat}%, ${35 + v * 45}%, ${v * 0.55})`;
      ctx.fillRect(c * cellW, y0 + (rows - 1 - r) * cellH, cellW + 0.5, cellH + 0.5);
    }
  }
  ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${0.15 + S.beat * 0.2})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c < cols; c++) {
    const ci = (SPEC_BUF.head - cols + c + cols * 999) % cols;
    let sum = 0; for (let r = 0; r < rows; r++) sum += SPEC_BUF.data[ci * rows + r];
    const v = sum / rows, x = c * cellW + cellW / 2, y = y0 + (1 - v) * rows * cellH;
    if (c === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function initFlock(seed) {
  if (FLOCK.seed === seed && FLOCK.boids) return;
  FLOCK.seed = seed; FLOCK.boids = [];
  const n = 90;
  const rng = seededRand(Math.floor(seed * 1000));
  for (let i = 0; i < n; i++) FLOCK.boids.push({ x: rng() * 2 - 1, y: rng() * 2 - 1, vx: 0, vy: 0, hue: rng() });
}

function drawFlocking(base, hue, growthF, energySize, seed) {
  initFlock(seed);
  const W = canvas.width, H = canvas.height, scale = base * growthF * energySize * 1.8;
  const dt = 0.016;
  const boids = FLOCK.boids;
  for (const b of boids) {
    let ax = 0, ay = 0, cx = 0, cy = 0, nx = 0, ny = 0, sepX = 0, sepY = 0, cnt = 0, sep = 0;
    for (const o of boids) {
      if (o === b) continue;
      const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.25) { sepX -= dx; sepY -= dy; sep++; }
      if (d2 < 0.6) { cx += o.x; cy += o.y; nx += o.vx; ny += o.vy; cnt++; }
    }
    if (sep) { ax += sepX / sep * 0.8; ay += sepY / sep * 0.8; }
    if (cnt) { ax += (cx / cnt - b.x) * 0.4; ay += (cy / cnt - b.y) * 0.4; ax += (nx / cnt - b.vx) * 0.3; ay += (ny / cnt - b.vy) * 0.3; }
    ax += noise2(b.x + seed, S.time * 0.2) * S.mids * 0.5;
    ay += noise2(b.y + seed, S.time * 0.15) * S.bass * 0.5;
    b.vx = (b.vx + ax * dt) * 0.92; b.vy = (b.vy + ay * dt) * 0.92;
    const sp = 0.35 + S.loudness * 0.4 + S.beat * 0.3;
    b.vx *= sp; b.vy *= sp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > 1.2) b.x = -1.2; if (b.x < -1.2) b.x = 1.2;
    if (b.y > 1.2) b.y = -1.2; if (b.y < -1.2) b.y = 1.2;
    const ph = (hue + b.hue * 60) % 360;
    const sz = 2 + S.beat * 2;
    ctx.fillStyle = `hsla(${ph}, ${currentDNA().sat}%, 65%, ${0.35 + S.loudness * 0.3})`;
    ctx.beginPath(); ctx.arc(b.x * scale, b.y * scale * currentDNA().verticalStretch, sz, 0, Math.PI * 2); ctx.fill();
  }
}

function drawTypography(base, hue, growthF, energySize, seed) {
  const title = (S.textTitle || "MORPH").slice(0, 12).toUpperCase();
  const R = base * growthF * energySize * 0.85;
  const n = title.length;
  ctx.font = `700 ${Math.max(10, R * 0.22)}px -apple-system, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + S.time * 0.15;
    const wob = noise2(i + seed, S.time * 0.5) * R * 0.15 * S.bass;
    const r = R + wob + S.beat * 12;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * currentDNA().verticalStretch;
    const lh = (hue + i * (360 / n)) % 360;
    ctx.fillStyle = `hsla(${lh}, ${currentDNA().sat}%, 68%, ${0.45 + S.loudness * 0.35})`;
    ctx.fillText(title[i], x, y);
  }
}

function initFluid(seed) {
  const gw = 64, gh = 36;
  if (FLUID.seed === seed && FLUID.w === gw) return;
  FLUID.w = gw; FLUID.h = gh; FLUID.seed = seed;
  const n = gw * gh;
  FLUID.vx = new Float32Array(n); FLUID.vy = new Float32Array(n); FLUID.dens = new Float32Array(n);
  const rng = seededRand(Math.floor(seed * 777));
  for (let i = 0; i < n; i++) FLUID.dens[i] = rng() * 0.2;
}

function drawFluidLite(base, hue, growthF, energySize, seed) {
  initFluid(seed);
  const { w: gw, h: gh, vx, vy, dens } = FLUID;
  const dt = 0.12;
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const i = y * gw + x;
    vx[i] += (noise2(x * 0.08 + S.time * 0.3, y * 0.08 + seed) * S.mids - vx[i]) * dt;
    vy[i] += (noise2(x * 0.08, y * 0.08 + S.time * 0.25 + seed) * S.bass - vy[i]) * dt;
    dens[i] = dens[i] * 0.985 + (S.loudness * 0.08 + S.beat * 0.05);
  }
  if (S.beat > 0.7) {
    const cx = Math.floor(gw / 2 + noise2(S.time, seed) * gw * 0.3);
    const cy = Math.floor(gh / 2);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = (cy + dy) * gw + (cx + dx);
      if (i >= 0 && i < dens.length) dens[i] += 0.4;
    }
  }
  const W = canvas.width, H = canvas.height, cellW = W / gw, cellH = H / gh;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, v = Math.min(1, dens[i]);
    if (v < 0.03) continue;
    const lh = (hue + v * 50 + x * 2) % 360;
    ctx.fillStyle = `hsla(${lh}, ${currentDNA().sat}%, ${40 + v * 35}%, ${v * 0.45})`;
    ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
  }
}

/* ---- FX Rack III — Cinematic ---- */
const FX3_DEFS = [
  ["lensflare", "Lens Flare", "beat-triggered light streak"],
  ["lightleak", "Light Leak", "warm edge bleed"],
  ["scanlines", "Scanlines", "CRT line texture"],
  ["motionblur", "Motion Blur", "directional smear on hits"]
];

function buildFX3() {
  const chips = $("fx3Chips"); if (!chips) return;
  FX3_DEFS.forEach(([key, label, desc]) => {
    const chip = document.createElement("div");
    chip.className = "fxchip"; chip.textContent = label; chip.dataset.fx3 = key;
    chip.title = desc;
    chip.addEventListener("click", () => { S.fx3[key] = !S.fx3[key]; syncFX3UI(); });
    chips.appendChild(chip);
  });
}

function syncFX3UI() {
  document.querySelectorAll("[data-fx3]").forEach(el =>
    el.classList.toggle("on", !!S.fx3[el.dataset.fx3]));
}

function applyPostFX3(W, H, dt) {
  const f3 = S.fx3;
  let any = false;
  for (const k in f3) if (f3[k]) { any = true; break; }
  if (!any) return;
  if (f3.lensflare && S.beat > 0.5) {
    const g = ctx.createRadialGradient(W * 0.75, H * 0.25, 0, W * 0.75, H * 0.25, W * 0.35);
    g.addColorStop(0, `rgba(255,240,200,${S.beat * 0.25})`);
    g.addColorStop(0.4, `rgba(255,180,100,${S.beat * 0.08})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }
  if (f3.lightleak) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `rgba(255,120,60,${0.06 + S.mids * 0.08})`);
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(255,80,180,${0.04 + S.highs * 0.06})`);
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }
  if (f3.scanlines) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
  if (f3.motionblur && (S.beat > 0.6 || S.transient > 0.3)) {
    snapshot(W, H);
    ctx.globalAlpha = 0.35 + S.beat * 0.25;
    ctx.drawImage(fxC, 3 + S.stereo * 8, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/* ---- Spotify Canvas / loop ---- */
function findBestLoopPoint(dur, len) {
  len = len || 8;
  if (!S.energyCurve || !S.energyCurve.length || dur <= len) return 0;
  const n = S.energyCurve.length;
  const win = Math.max(3, Math.round(n * (len / dur)));
  let best = 0, bestVar = 1e9;
  for (let i = 0; i <= n - win; i++) {
    let sum = 0, sum2 = 0;
    for (let j = 0; j < win; j++) { const v = S.energyCurve[i + j]; sum += v; sum2 += v * v; }
    const mean = sum / win, vari = sum2 / win - mean * mean;
    if (vari < bestVar) { bestVar = vari; best = i / n * dur; }
  }
  if (S.bpm > 0) {
    const beat = 60 / S.bpm, t0 = S.beatTime0 || 0;
    best = Math.round((best - t0) / beat) * beat + t0;
    best = Math.max(0, Math.min(dur - len, best));
  }
  return best;
}

function applySpotifyCanvasMode() {
  S.spotifyCanvas = true;
  S.aspect = [1, 1];
  S.exportRange = { on: true, start: findBestLoopPoint(setDuration(), 8), end: findBestLoopPoint(setDuration(), 8) + 8 };
  if (S.exportRange.end > setDuration()) S.exportRange.end = Math.min(8, setDuration());
  S.exportRange.start = Math.max(0, S.exportRange.end - 8);
  resize();
  const rs = $("rangeStart"), re = $("rangeEnd"), ro = $("rangeOn");
  if (rs) rs.value = S.exportRange.start.toFixed(1);
  if (re) re.value = S.exportRange.end.toFixed(1);
  if (ro) ro.checked = true;
}

/* ---- Batch Export ---- */
async function exportBatchHQ() {
  if (S.exporting) return;
  if (!S.audioBuffer) { alert("Bitte zuerst einen Track laden."); return; }
  const formats = [[16, 9], [9, 16], [1, 1]];
  const names = ["16x9", "9x16", "1x1"];
  const saved = S.aspect.slice();
  S.batchExportActive = true;
  try {
    for (let i = 0; i < formats.length; i++) {
      S.aspect = formats[i];
      document.querySelectorAll("#fmtRow .fmt").forEach(f => {
        f.classList.toggle("active", +f.dataset.w === formats[i][0] && +f.dataset.h === formats[i][1] && !f.dataset.canvas && !f.dataset.loop);
      });
      resize();
      await exportHQ();
      if (S.exportCancel) break;
      const blob = window.__lastExportBlob;
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "elastic-morph-" + names[i] + ".mp4";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    }
  } finally {
    S.batchExportActive = false;
    S.aspect = saved;
    resize();
  }
}

function wireMasterUI() {
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener("input", fn); };
  bind("masterVig", e => { S.master.vignette = e.target.value / 100; $("masterVigVal").textContent = e.target.value; rebuildVignette(canvas.width, canvas.height); });
  bind("masterGrain", e => { S.master.grain = e.target.value / 100; $("masterGrainVal").textContent = e.target.value; });
  const mg = $("masterGrade"); if (mg) mg.addEventListener("change", e => S.master.grade = e.target.value);
  bind("masterChroma", e => { S.master.chroma = e.target.value / 100; $("masterChromaVal").textContent = e.target.value; });
  const mo = $("masterOn"); if (mo) mo.addEventListener("change", e => S.master.on = e.target.checked);
  const ds = $("dnaShareBtn"); if (ds) ds.addEventListener("click", exportDnaShareCard);
  const be = $("batchExportBtn"); if (be) be.addEventListener("click", exportBatchHQ);
  const st = $("setTransType"); if (st) st.addEventListener("change", e => S.setTransDefault.type = e.target.value);
  bind("setTransDur", e => { S.setTransDefault.dur = e.target.value / 10; $("setTransDurVal").textContent = (e.target.value / 10).toFixed(1) + "s"; });
}
