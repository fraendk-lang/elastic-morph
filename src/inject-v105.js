/* ============================================================
   v105 — Music Objects: Cassette + Waveform Monitor
   ============================================================ */

const MUSIC_OBJECT_PRESETS = [
  {
    id: "cassette", name: "Cassette",
    desc: "Kompakt-Kassette mit sichtbaren Spulen & Label — 80er, Indie, Lo-Fi, Bedroom Pop.",
    hue: 18, hueEnd: 42, sat: 74, bgFade: 0.48,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.38,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0.09, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.42, waveRing: false,
    engine: "tape",
    gradient: ["#120c06", "#5a3818", "#e8a040"]
  },
  {
    id: "waveformMonitor", name: "Waveform Monitor",
    desc: "Klassisches Wellenform-Display — minimal, modern, Studio. Ambient, Electronica, Podcast.",
    hue: 175, hueEnd: 220, sat: 78, bgFade: 0.42,
    layers: 1, points: 0, noiseAmp: 0, speed: 0.45,
    particles: 0, particleStyle: "soft", symmetry: 1,
    verticalStretch: 1.0, grain: 0.04, lineMode: false, petals: 0, glass: false,
    motion: "orbit", flowBias: 0, constellation: false, bloom: 0.48, waveRing: false,
    engine: "oscilloscope",
    gradient: ["#040810", "#0c2840", "#40c8e8"]
  }
];

function drawCassette(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const w = mn * 0.68 * growthF, h = mn * 0.4 * (0.92 + growthF * 0.08), y0 = -mn * 0.04;
  const rot = S.time * 1.05 + S.beat * 0.09;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#14110c";
  ctx.fillRect(-w / 2 - mn * 0.02, y0 - h / 2 - mn * 0.02, w + mn * 0.04, h + mn * 0.04);
  ctx.fillStyle = "#221c14";
  ctx.fillRect(-w / 2, y0 - h / 2, w, h);
  ctx.strokeStyle = "rgba(90,75,55,0.55)";
  ctx.lineWidth = Math.max(1, mn * 0.0025);
  ctx.strokeRect(-w / 2, y0 - h / 2, w, h);
  const lw = w * 0.52, lh = h * 0.42;
  const lg = ctx.createLinearGradient(0, y0 - lh / 2, 0, y0 + lh / 2);
  lg.addColorStop(0, `hsl(${hue % 360},${P.sat}%,${54 + S.loudness * 10}%)`);
  lg.addColorStop(1, `hsl(${(hue + 28) % 360},${Math.max(40, P.sat - 8)}%,38%)`);
  ctx.fillStyle = lg;
  ctx.fillRect(-lw / 2, y0 - lh / 2, lw, lh);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(-lw / 2, y0 - lh / 2, lw, lh);
  [[-lw * 0.24, 1], [lw * 0.24, -1]].forEach(([rx, dir]) => {
    const reelR = lh * 0.34;
    ctx.save();
    ctx.translate(rx, y0);
    ctx.rotate(rot * dir);
    ctx.fillStyle = "#0c0c10";
    ctx.beginPath(); ctx.arc(0, 0, reelR, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "rgba(210,200,180,0.45)";
    ctx.lineWidth = Math.max(1.2, reelR * 0.14);
    ctx.beginPath(); ctx.arc(0, 0, reelR * 0.72, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = `hsl(${(hue + 40) % 360},${P.sat}%,52%)`;
    ctx.beginPath(); ctx.arc(0, 0, reelR * 0.16, 0, 6.2832); ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = "rgba(20,16,12,0.85)";
  ctx.fillRect(-w * 0.12, y0 + h * 0.08, w * 0.24, h * 0.14);
  ctx.globalCompositeOperation = "lighter";
  const v = 0.35 + S.loudness * 0.55;
  ctx.fillStyle = `hsla(${(hue + 60) % 360},70%,58%,${v * 0.35})`;
  ctx.fillRect(-w * 0.04, y0 + h * 0.1, w * 0.08 * v, h * 0.08);
  ctx.restore();
}

function drawWaveformMonitor(base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const W = mn * 0.82, H = mn * 0.34 * growthF, y0 = -mn * 0.02;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#06080c";
  ctx.fillRect(-W / 2 - 4, y0 - H / 2 - 4, W + 8, H + 8);
  ctx.strokeStyle = "rgba(100,120,150,0.4)";
  ctx.lineWidth = Math.max(1, mn * 0.002);
  ctx.strokeRect(-W / 2, y0 - H / 2, W, H);
  for (let g = -2; g <= 2; g++) {
    ctx.strokeStyle = "rgba(80,95,120,0.12)";
    ctx.beginPath();
    ctx.moveTo(-W / 2, y0 + (g / 2) * H * 0.85);
    ctx.lineTo(W / 2, y0 + (g / 2) * H * 0.85);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "lighter";
  const n = Math.round(100 + 60 * (S.exporting ? S.exportScale : S.perfScale));
  const drawWave = (yOff, amp, col, alpha) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (i / n) * W;
      const t = S.time * 1.6 + i * 0.11 + seed + yOff;
      const y = y0 + yOff + Math.sin(t) * amp * S.bass * H * 0.42
        + Math.sin(t * 2.4 + 1) * amp * S.mids * H * 0.28
        + Math.sin(t * 5.2) * amp * S.highs * H * 0.14;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${col % 360}, ${P.sat}%, 62%, ${alpha})`;
    ctx.lineWidth = Math.max(1.2, mn * 0.0035);
    ctx.stroke();
  };
  drawWave(0, 1, hue, 0.55 + S.loudness * 0.35);
  drawWave(H * 0.06, 0.55, (hue + 40) % 360, 0.22 + S.beat * 0.12);
  ctx.fillStyle = `hsla(${hue % 360},50%,55%,${0.08 + S.loudness * 0.12})`;
  ctx.fillRect(-W / 2, y0 - H / 2, W * S.progress, H);
  ctx.restore();
}

function renderMusicObjectCardPreview(pv, t) {
  const c = pv.c, W = pv.cv.width, H = pv.cv.height, p = pv.p;
  c.fillStyle = "rgba(3,3,6,0.28)";
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, H / 2);
  const hue = p.hue + (Math.sin(t * 0.3 + pv.seed) * 0.5 + 0.5) * (p.hueEnd - p.hue) * 0.5;
  if (p.id === "cassette") {
    const ww = W * 0.74, hh = H * 0.64;
    c.fillStyle = "#1a1510";
    c.fillRect(-ww / 2 - 1, -hh / 2 - 1, ww + 2, hh + 2);
    c.fillStyle = "#221c14";
    c.fillRect(-ww / 2, -hh / 2, ww, hh);
    c.fillStyle = `hsl(${hue % 360},${p.sat}%,46%)`;
    c.fillRect(-ww * 0.27, -hh * 0.24, ww * 0.54, hh * 0.48);
    [[-ww * 0.13, 1], [ww * 0.13, -1]].forEach(([rx, dir]) => {
      c.save(); c.translate(rx, 0); c.rotate(t * 1.15 * dir);
      c.fillStyle = "#0c0c10"; c.beginPath(); c.arc(0, 0, hh * 0.19, 0, 6.2832); c.fill();
      c.strokeStyle = "rgba(210,200,180,0.5)"; c.lineWidth = 0.9;
      c.beginPath(); c.arc(0, 0, hh * 0.19, 0, 6.2832); c.stroke();
      c.fillStyle = `hsl(${(hue + 35) % 360},${p.sat}%,52%)`;
      c.beginPath(); c.arc(0, 0, hh * 0.05, 0, 6.2832); c.fill();
      c.restore();
    });
  } else {
    const ww = W * 0.84, hh = H * 0.58;
    c.fillStyle = "#06080c";
    c.fillRect(-ww / 2, -hh / 2, ww, hh);
    c.strokeStyle = "rgba(100,120,150,0.45)"; c.lineWidth = 0.7;
    c.strokeRect(-ww / 2, -hh / 2, ww, hh);
    c.globalCompositeOperation = "lighter";
    c.beginPath();
    for (let i = 0; i <= 52; i++) {
      const x = -ww / 2 + (i / 52) * ww;
      const tt = t * 1.7 + i * 0.13 + pv.seed;
      const y = Math.sin(tt) * hh * 0.24 + Math.sin(tt * 2.5 + 0.4) * hh * 0.13;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = `hsla(${hue % 360},${p.sat}%,62%,0.82)`;
    c.lineWidth = 1.15;
    c.stroke();
  }
  c.restore();
  c.globalCompositeOperation = "source-over";
}

function chainMusicObjectDraw() {
  const prevTape = drawTape;
  drawTape = function (base, hue, growthF, energySize, seed) {
    if (S.preset && S.preset.id === "cassette") return drawCassette(base, hue, growthF, energySize, seed);
    return prevTape(base, hue, growthF, energySize, seed);
  };
  const prevOsc = drawOscilloscope;
  drawOscilloscope = function (base, hue, growthF, energySize, seed) {
    if (S.preset && S.preset.id === "waveformMonitor") return drawWaveformMonitor(base, hue, growthF, energySize, seed);
    return prevOsc(base, hue, growthF, energySize, seed);
  };
}

function registerMusicObjectPresets() {
  const tapeIdx = PRESETS.findIndex(p => p.id === "tape");
  const insertAt = tapeIdx >= 0 ? tapeIdx + 1 : PRESETS.length;
  let offset = 0;
  MUSIC_OBJECT_PRESETS.forEach(p => {
    if (PRESETS.find(x => x.id === p.id)) return;
    PRESETS.splice(insertAt + offset, 0, p);
    offset++;
  });
}

function patchRenderPreviewsMusicObjects() {
  const _rp = renderPreviews;
  const special = new Set(["cassette", "waveformMonitor"]);
  renderPreviews = function () {
    if (!$("page-dna").classList.contains("open")) return;
    const t = performance.now() / 1000;
    for (const pv of previews) {
      if (special.has(pv.p.id)) renderMusicObjectCardPreview(pv, t);
    }
    const bak = previews.slice();
    previews.length = 0;
    previews.push(...bak.filter(pv => !special.has(pv.p.id)));
    _rp();
    previews.length = 0;
    previews.push(...bak);
  };
}

function patchCalmScoringMusicObjects() {
  if (typeof scorePresetForTrack !== "function") return;
  const _score = scorePresetForTrack;
  scorePresetForTrack = function (p) {
    let s = _score(p);
    const prof = typeof trackCalmProfile === "function" ? trackCalmProfile() : { isCalm: false, calm: 0 };
    if (!prof.isCalm) return s;
    if (p.id === "cassette" || p.id === "waveformMonitor") s += 3.5 + prof.calm * 1.5;
    return s;
  };
}

function initMusicObjectsV105() {
  chainMusicObjectDraw();
  patchRenderPreviewsMusicObjects();
  patchCalmScoringMusicObjects();
}

function registerMusicObjectPresetsAfterBuild() {
  registerMusicObjectPresets();
}
