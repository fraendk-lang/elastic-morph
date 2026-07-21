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
        pt.r += dt * (0.1 + energy * 0.75 + beat * 0.55) * pt.spd;
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
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (pt.r > 0.55 && beat > 0.4) {
          ctx.strokeStyle = pmColor(pt, baseHue, 78, al * 0.35);
          ctx.lineWidth *= 0.45;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        break;
      }
      case "starfall": {
        pt.y += dt * (45 + energy * 210 + mid * 80) * pt.spd * sc;
        pt.x += dt * (S.stereo * 36 + Math.sin(S.time * 0.4 + pt.hue) * 18) * sc;
        if (pt.y > H + 12) { pt.y = -12; pt.x = Math.random() * W; }
        if (pt.x > W + 12) pt.x = -12;
        if (pt.x < -12) pt.x = W + 12;
        const tail = (8 + energy * 38 + beat * 22) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 68, 0.18 + hi * 0.42);
        ctx.lineWidth = pt.sz * (0.75 + beat * 0.35) * sc;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - tail * 0.2, pt.y - tail); ctx.stroke();
        break;
      }
      case "rain": {
        pt.y += dt * (240 + energy * 380 + hi * 120) * pt.spd * sc;
        if (pt.y > H + 14) { pt.y = -14; pt.x = Math.random() * W; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const tail = (12 + energy * 24 + hi * 10) * sc;
        ctx.strokeStyle = pmColor(pt, baseHue, 58, 0.14 + hi * 0.38);
        ctx.lineWidth = pt.sz * 0.45 * sc;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - tail); ctx.stroke();
        break;
      }
      case "vortex": {
        pt.a += dt * (0.45 + energy * 1.45 + beat * 0.35) * pt.spd * (1.15 - pt.r * 0.35);
        pt.r -= dt * (0.035 + energy * 0.18 + S.bass * 0.06);
        if (pt.r < 0.02) { pt.r = 0.5 + Math.random() * 0.45; if (S.pmode.multicolor) pt.hue = Math.random() * 360; }
        const x = cx + Math.cos(pt.a) * pt.r * maxR, y = cy + Math.sin(pt.a) * pt.r * maxR * 0.82;
        const s = pt.sz * (0.55 + (1 - pt.r) * 1.4 + beat * 0.25) * sc;
        ctx.fillStyle = pmColor(pt, baseHue, 58 + (1 - pt.r) * 22, 0.22 + hi * 0.35);
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fountain": {
        if (pt.life <= 0) {
          pt.x = cx + (Math.random() - 0.5) * W * 0.08 + S.stereo * W * 0.06;
          pt.y = H - 6 * sc;
          pt.vx = (Math.random() - 0.5) * 140 * sc;
          pt.vy = -(200 + Math.random() * 200 + energy * 240 + beat * 120) * sc;
          pt.life = 1;
          if (S.pmode.multicolor) pt.hue = Math.random() * 360;
        }
        pt.vy += dt * 300 * sc;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.y > H + 10) pt.life = 0;
        const trail = 4 + beat * 6;
        ctx.strokeStyle = pmColor(pt, baseHue, 62, 0.2 + hi * 0.28);
        ctx.lineWidth = pt.sz * 0.9 * sc;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * dt * trail, pt.y - pt.vy * dt * trail); ctx.stroke();
        ctx.fillStyle = pmColor(pt, baseHue, 64, 0.28 + hi * 0.32);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (1.1 + beat * 0.3) * sc, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "fireworks": {
        if (pt.life > 0) {
          pt.vy += dt * 120 * sc; pt.vx *= 0.982; pt.vy *= 0.982;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt * (0.65 + hi * 0.15);
          const a = Math.max(0, pt.life);
          ctx.fillStyle = pmColor(pt, baseHue, 60, a * 0.85);
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.55 + a * 0.9) * sc, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "nebula": {
        const ang = noise2(pt.x * 0.002 + S.time * 0.045, pt.y * 0.002 - S.time * 0.028) * Math.PI * 2;
        const v = dt * (20 + energy * 62 + mid * 20) * sc;
        pt.x += Math.cos(ang) * v; pt.y += Math.sin(ang) * v;
        if (pt.x < -24) pt.x = W + 24; else if (pt.x > W + 24) pt.x = -24;
        if (pt.y < -24) pt.y = H + 24; else if (pt.y > H + 24) pt.y = -24;
        const rad = pt.sz * (7 + beat * 2.5) * sc;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        g.addColorStop(0, pmColor(pt, baseHue, 58, 0.1 + S.loudness * 0.16));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "swarm": {
        const ax = cx + Math.sin(S.time * 0.65 + pt.hue * 0.01) * W * 0.28 + S.stereo * W * 0.12;
        const ay = cy + Math.cos(S.time * 0.85) * H * 0.26 + S.bass * H * 0.04;
        pt.vx += (ax - pt.x) * dt * (1.6 + beat * 0.8);
        pt.vy += (ay - pt.y) * dt * (1.6 + beat * 0.8);
        pt.vx += (Math.random() - 0.5) * 180 * dt * (0.35 + beat);
        pt.vy += (Math.random() - 0.5) * 180 * dt * (0.35 + beat);
        pt.vx *= 0.93; pt.vy *= 0.93;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        ctx.fillStyle = pmColor(pt, baseHue, 62, 0.24 + hi * 0.36);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.sz * (0.95 + beat * 0.35) * sc, 0, Math.PI * 2); ctx.fill();
        break;
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
