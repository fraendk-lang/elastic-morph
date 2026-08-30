/* ============================================================
   v85 — Particle mode polish + P toggle (Shift+P = PNG)
   ============================================================ */

function pmPatternLabel(id) {
  const row = PM_PATTERNS.find(p => p[0] === id);
  return row ? row[1] : id;
}

function toggleParticleMode(force) {
  S.pmode.on = force != null ? !!force : !S.pmode.on;
  const el = $("pmOn");
  if (el) el.checked = S.pmode.on;
  if (S.pmode.on) initPM();
  showAppToast(
    S.pmode.on ? `Partikel · ${pmPatternLabel(S.pmode.pattern)} (P)` : "Partikel aus",
    2200
  );
}

function pmIntensity() {
  const amt = S.pmode.amount;
  const live = 0.55 + S.loudness * 0.45 + S.beat * 0.25;
  const pf = S.exporting ? 1 : Math.max(0.55, S.perfScale || 1);
  return amt * live * pf;
}

initPM = function () {
  const W = canvas.width || 1280, H = canvas.height || 720;
  const area = (W * H) / (1280 * 720);
  const pf = S.exporting ? 1 : Math.max(0.5, S.perfScale || 1);
  const n = Math.round((100 + S.pmode.amount * 480) * Math.sqrt(area) * pf);
  const cap = Math.round(720 * pf);
  const count = Math.max(60, Math.min(cap, n));
  pmParticles = [];
  for (let i = 0; i < count; i++) {
    pmParticles.push({
      x: Math.random() * W, y: Math.random() * H,
      a: Math.random() * Math.PI * 2, r: Math.random(), pr: 0,
      spd: 0.45 + Math.random() * 1.2, sz: 0.55 + Math.random() * 2.1,
      hue: Math.random() * 360, vx: 0, vy: 0, life: 0
    });
  }
};

pmColor = function (pt, baseHue, l, alpha) {
  const P = currentDNA();
  const span = (P.hueEnd != null ? P.hueEnd - P.hue : 50);
  const h = S.pmode.multicolor
    ? (pt.hue + S.time * 18 + S.beat * 40) % 360
    : (baseHue + (pt.hue * 0.08 + span * 0.12)) % 360;
  const sat = S.pmode.multicolor ? 88 : Math.min(92, P.sat || 72);
  const cap = 0.72 * pmIntensity();
  return `hsla(${((h % 360) + 360) % 360}, ${sat}%, ${l}%, ${Math.min(alpha, cap)})`;
};

/* v131: Kaleidoscope Mirror + Constellation lines — see docs/superpowers/specs/
   2026-08-29-particle-mode-mirror-constellation-design.md */
const PM_CONST_PATTERNS = new Set(["nebula", "swarm", "vortex", "fountain"]);

function pmMirrorRotPasses(n) {
  return Array.from({ length: n }, (_, i) => ({ rot: i * Math.PI * 2 / n, flip: i % 2 === 1 }));
}

function pmMirrorPasses(mode) {
  return mode === "quad" ? [{ sx: 1, sy: 1 }, { sx: -1, sy: 1 }, { sx: 1, sy: -1 }, { sx: -1, sy: -1 }]
    : mode === "h" ? [{ sx: 1, sy: 1 }, { sx: -1, sy: 1 }]
    : mode === "v" ? [{ sx: 1, sy: 1 }, { sx: 1, sy: -1 }]
    : mode === "diag" ? [{ sx: 1, sy: 1 }, { diag: true }]
    : mode === "hex" ? pmMirrorRotPasses(6)
    : mode === "oct" ? pmMirrorRotPasses(8)
    : [{ sx: 1, sy: 1 }];
}

function pmMirrorXY(x, y, cx, cy, mp) {
  let dx = x - cx, dy = y - cy;
  if (mp.rot != null) {
    /* Must match Layer B's actual canvas-transform order: translate(cx,cy); rotate(rot);
       scale(1,-1) [if flip]; translate(-cx,-cy) — composed, that applies flip FIRST, then
       rotate (the last-called transform acts on the point first). Flip-then-rotate is NOT
       the same as rotate-then-flip. */
    if (mp.flip) dy = -dy;
    const c = Math.cos(mp.rot), s = Math.sin(mp.rot);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return [cx + rx, cy + ry];
  }
  if (mp.diag) return [cx + dy, cy + dx];
  return [cx + dx * mp.sx, cy + dy * mp.sy];
}

drawParticleMode = function (W, H, baseHue, dt) {
  const pm = S.pmode;
  if (!pm.on) return;
  if (pmParticles.length === 0) initPM();

  const cx = W / 2, cy = H / 2, maxR = Math.hypot(W, H) / 2, sc = H / 720;
  const energy = 0.22 + S.loudness * 1.15 + S.transient * 0.35;
  const beat = S.beat, hi = S.highs, mid = S.mids;
  const inten = pmIntensity();
  const pf = S.exporting ? 1 : Math.max(0.55, S.perfScale || 1);
  const visN = Math.max(40, Math.round(pmParticles.length * Math.min(1, pf + 0.3)));
  /* v130: perf-gated glow + frequency-band coupling — see docs/superpowers/specs/
     2026-08-29-particle-mode-glow-bands-design.md. Reuses the S.geo2 threshold convention. */
  const glowOn = S.exporting || (S.perfScale || 1) > 0.5;

  const pf57 = S.exporting ? 1 : (S.perfScale || 1);
  let mmode = pm.mirror || "off";
  if (pf57 < 0.75 && mmode === "oct") mmode = "hex";
  if (pf57 < 0.65 && mmode === "hex") mmode = "quad";
  if (pf57 < 0.55 && mmode === "quad") mmode = "h";
  if (pf57 < 0.45 && mmode !== "off") mmode = "off";
  const mPasses = pmMirrorPasses(mmode);
  const pmConstOn = pm.constellation && PM_CONST_PATTERNS.has(pm.pattern);
  const pmConstPts = [];

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = Math.min(0.92, 0.42 + inten * 0.55);

  const pmPulse = 1 + (beat * 0.08 + S.bass * 0.06 + S.transient * 0.04);
  ctx.translate(cx, cy);
  ctx.scale(pmPulse, pmPulse);
  ctx.translate(-cx, -cy);

  if (pm.pattern === "fireworks") {
    pmFireTimer -= dt;
    if ((S.transient > 0.35 || beat > 0.55) && pmFireTimer <= 0) {
      pmFireTimer = 0.18 + (1 - beat) * 0.12;
      launchFirework(W, H);
    }
  }

  for (let pi = 0; pi < visN; pi++) {
    const pt = pmParticles[pi];
    switch (pm.pattern) {
      case "hyperspace": {
        pt.pr = pt.r;
        pt.r += dt * (0.1 + energy * 0.75 + beat * 0.55 + S.bands.air * 0.9) * pt.spd;
        if (pt.r >= 1) {
          pt.r = Math.random() * 0.05;
          pt.pr = pt.r;
          pt.a = Math.random() * Math.PI * 2;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        const x1 = cx + Math.cos(pt.a) * pt.pr * maxR, y1 = cy + Math.sin(pt.a) * pt.pr * maxR;
        const x2 = cx + Math.cos(pt.a) * pt.r * maxR, y2 = cy + Math.sin(pt.a) * pt.r * maxR;
        const al = 0.12 + pt.r * 0.55 * inten;
        ctx.strokeStyle = pmColor(pt, baseHue, 52 + pt.r * 32, al);
        ctx.lineWidth = pt.sz * (0.35 + pt.r * 1.8 + S.bass * 0.4) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 3 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(x1, y1, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(x2, y2, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        if (pt.r > 0.55 && beat > 0.4) {
          ctx.strokeStyle = pmColor(pt, baseHue, 78, al * 0.35);
          ctx.shadowColor = ctx.strokeStyle;
          ctx.lineWidth *= 0.45;
          for (const mp of mPasses) {
            const [mx1, my1] = pmMirrorXY(x1, y1, cx, cy, mp);
            const [mx2, my2] = pmMirrorXY(x2, y2, cx, cy, mp);
            ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
          }
        }
        break;
      }
      case "starfall": {
        pt.y += dt * (45 + energy * 210 + mid * 80 + S.bands.highMid * 180) * pt.spd * sc;
        pt.x += dt * (S.stereo * 36 + Math.sin(S.time * 0.4 + pt.hue) * 18) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        if (pt.x < -12) pt.x = W + 12;
        const tail = (8 + energy * 38 + beat * 22 + S.bands.air * 26) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 68, 0.18 + hi * 0.42);
        ctx.lineWidth = pt.sz * (0.75 + beat * 0.35) * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.5 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(pt.x - tail * 0.2, pt.y - tail, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        break;
      }
      case "rain": {
        pt.y += dt * (240 + energy * 380 + hi * 120 + S.kickOnset * 260) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const tail = (12 + energy * 24 + hi * 10) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 58, 0.14 + hi * 0.38);
        ctx.lineWidth = pt.sz * 0.45 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(pt.x, pt.y - tail, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        break;
      }
      case "vortex": {
        pt.a += dt * (0.45 + energy * 1.45 + beat * 0.35 + S.bands.bass * 1.3) * pt.spd * (1.15 - pt.r * 0.35);
        pt.r -= dt * (0.035 + energy * 0.18 + S.bass * 0.06 + S.bands.lowMid * 0.18);
        if (pt.r < 0.02) { pt.r = 0.5 + Math.random() * 0.45; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.55 + (1 - pt.r) * 1.4 + beat * 0.25) * sc;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x, y, hue: pt.hue });
        ctx.fillStyle = pmColor(pt, baseHue, 58 + (1 - pt.r) * 22, 0.22 + hi * 0.35);
        ctx.shadowBlur = glowOn ? s * 1.4 : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(x, y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, s, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.08 + S.stereo * W * 0.06;
          pt.y = H - 6 * sc;
          pt.vx = (Math.random() - 0.5) * 140 * sc;
          pt.vy = -(200 + Math.random() * 200 + energy * 240 + beat * 120 + (S.bands.subBass + S.kickOnset) * 180) * sc;
          pt.life = 1;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 300 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        const trail = 4 + beat * 6;
        const tx = pt.x - pt.vx * dt * trail, ty = pt.y - pt.vy * dt * trail;
        ctx.strokeStyle = pmColor(pt, baseHue, 62, 0.2 + hi * 0.28);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.shadowBlur = glowOn ? pt.sz * 2.6 * sc : 0; ctx.shadowColor = ctx.strokeStyle;
        for (const mp of mPasses) {
          const [mx1, my1] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const [mx2, my2] = pmMirrorXY(tx, ty, cx, cy, mp);
          ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        }
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.28 + hi * 0.32);
        ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * (1.1 + beat * 0.3) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 120 * sc; pt.vx *= 0.982; pt.vy *= 0.982;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * (0.65 + hi * 0.15);
          const a = Math.max(0, pt.life);
          const rad = pt.sz * (0.55 + a * 0.9 + S.snareOnset * 0.5) * sc;
          ctx.fillStyle = pmColor(pt, baseHue, 60, a * 0.85);
          ctx.shadowBlur = glowOn ? pt.sz * (0.55 + a * 0.9) * sc * 2 : 0; ctx.shadowColor = ctx.fillStyle;
          for (const mp of mPasses) {
            const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
            ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.002 + S.time * 0.045, pt.y * 0.002 - S.time * 0.028) * Math.PI * 2;
        const v = dt * (20 + energy * 62 + mid * 20 + S.bands.mid * 45) * sc;
        pt.x += Math.cos(ang) * v; pt.y += Math.sin(ang) * v;
        if (pt.x < -24) pt.x = W + 24; else if (pt.x > W + 24) pt.x = -24;
        if (pt.y < -24) pt.y = H + 24; else if (pt.y > H + 24) pt.y = -24;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        const rad = pt.sz * (7 + beat * 2.5) * sc;
        const col0 = pmColor(pt, baseHue, 58, 0.1 + S.loudness * 0.16);
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          const g = ctx.createRadialGradient(mx, my, 0, mx, my, rad);
          g.addColorStop(0, col0);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "swarm": {
        const ax = cx + Math.sin(S.time * 0.65 + pt.hue * 0.01) * W * (0.28 + S.bands.bass * 0.1) + S.stereo * W * 0.12;
        const ay = cy + Math.cos(S.time * 0.85) * H * (0.26 + S.bands.bass * 0.08) + S.bass * H * 0.04;
        pt.vx += (ax - pt.x) * dt * (1.6 + beat * 0.8);
        pt.vy += (ay - pt.y) * dt * (1.6 + beat * 0.8);
        pt.vx += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vy += (Math.random() - 0.5) * 180 * dt * (0.35 + beat + S.bands.mid * 0.6);
        pt.vx *= 0.93; pt.vy *= 0.93;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pmConstOn && pmConstPts.length < 70) pmConstPts.push({ x: pt.x, y: pt.y, hue: pt.hue });
        ctx.fillStyle = pmColor(pt, baseHue, 62, 0.24 + hi * 0.36);
        ctx.shadowBlur = glowOn ? pt.sz * 2.2 * sc : 0; ctx.shadowColor = ctx.fillStyle;
        for (const mp of mPasses) {
          const [mx, my] = pmMirrorXY(pt.x, pt.y, cx, cy, mp);
          ctx.beginPath(); ctx.arc(mx, my, pt.sz * (0.95 + beat * 0.35) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
  }
  if (pmConstOn && pmConstPts.length > 1) {
    const thr = Math.min(W, H) * 0.12, thr2 = thr * thr;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < pmConstPts.length; i++) {
      for (let j = i + 1; j < pmConstPts.length; j++) {
        const dx = pmConstPts[i].x - pmConstPts[j].x, dy = pmConstPts[i].y - pmConstPts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < thr2) {
          const al = (1 - Math.sqrt(d2) / thr) * 0.16 * (0.5 + hi + beat * 0.4);
          ctx.strokeStyle = pmColor(pmConstPts[i], baseHue, 68, al);
          ctx.beginPath();
          ctx.moveTo(pmConstPts[i].x, pmConstPts[i].y);
          ctx.lineTo(pmConstPts[j].x, pmConstPts[j].y);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};

function patchParticleModeV85() {
  const _resize = resize;
  let pmSizeKey = "";
  resize = function () {
    const prev = pmSizeKey;
    _resize();
    const key = canvas.width + "x" + canvas.height;
    if (S.pmode.on && key !== prev) {
      pmSizeKey = key;
      initPM();
    }
  };
}

function initParticleModeV85() {
  patchParticleModeV85();
}
