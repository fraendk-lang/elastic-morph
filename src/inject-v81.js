/* ============================================================
   v81 — Vinyl DNA: richer disc, no tonearm
   ============================================================ */

drawVinyl = function (base, hue, growthF, energySize, seed) {
  const P = currentDNA(), mn = Math.min(canvas.width, canvas.height);
  const R = Math.min(mn * 0.44, base * 1.55 * growthF * energySize) * (1 + S.bass * 0.025);
  const span = (P.hueEnd != null ? P.hueEnd - P.hue : 60);
  const rpm = S.bpm > 0 ? (S.bpm / 120) * 0.55 : 0.65;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const shadow = ctx.createRadialGradient(0, 0, R * 0.82, 0, 0, R * 1.1);
  shadow.addColorStop(0, "rgba(0,0,0,0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.rotate(S.time * rpm + S.beat * 0.08);

  const body = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, R);
  body.addColorStop(0, "#26262c");
  body.addColorStop(0.5, "#14141a");
  body.addColorStop(0.9, "#09090e");
  body.addColorStop(1, "#030305");
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();

  const grooveA = 0.022 + S.highs * 0.055 + S.mids * 0.018;
  ctx.lineWidth = Math.max(0.45, R * 0.0016);
  for (let r = R * 0.43; r < R * 0.988; r += Math.max(1.1, R * 0.0075)) {
    const shimmer = noise2(r * 0.018 + seed * 0.1, S.time * 0.35) * 0.12;
    ctx.strokeStyle = `rgba(210,218,228,${grooveA * (0.65 + shimmer)})`;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.strokeStyle = `rgba(255,255,255,${0.035 + S.highs * 0.045})`;
  ctx.lineWidth = Math.max(0.8, R * 0.0035);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.975, 0, Math.PI * 2); ctx.stroke();

  const labelR = R * 0.385;
  const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, labelR);
  lg.addColorStop(0, `hsl(${hue % 360},${P.sat}%,${56 + S.loudness * 12}%)`);
  lg.addColorStop(0.65, `hsl(${(hue + span * 0.45) % 360},${P.sat}%,${42 + S.bass * 10}%)`);
  lg.addColorStop(1, `hsl(${(hue + span) % 360},${Math.max(38, P.sat - 12)}%,30%)`);
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(0, 0, labelR, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.38)"; ctx.lineWidth = Math.max(0.8, R * 0.0028);
  ctx.beginPath(); ctx.arc(0, 0, labelR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(0, 0, labelR * 0.86, 0, Math.PI * 2); ctx.stroke();

  const rng = seededRand(Math.floor(seed * 100) + Math.floor(S.time * 8));
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 28; i++) {
    const a = rng() * Math.PI * 2, lr = rng() * labelR * 0.75;
    ctx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(Math.cos(a) * lr - 0.5, Math.sin(a) * lr - 0.5, 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#08080c";
  ctx.beginPath(); ctx.arc(0, 0, R * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(175,182,195,0.55)";
  ctx.beginPath(); ctx.arc(0, 0, R * 0.013, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  ctx.globalCompositeOperation = "screen";
  const sA = S.time * 0.22 + S.stereo * 0.18;
  const dx = Math.cos(sA), dy = Math.sin(sA);
  const sg = ctx.createLinearGradient(-dx * R, -dy * R, dx * R, dy * R);
  sg.addColorStop(0, "rgba(255,255,255,0)");
  sg.addColorStop(0.42, `hsla(${(hue + 35) % 360},45%,72%,${0.035 + S.highs * 0.09})`);
  sg.addColorStop(0.52, `hsla(${(hue + 15) % 360},35%,88%,${0.05 + S.highs * 0.1 + S.beat * 0.03})`);
  sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();

  if (S.beat > 0.12) {
    ctx.strokeStyle = `hsla(${hue % 360},${P.sat}%,62%,${S.beat * 0.22})`;
    ctx.lineWidth = Math.max(1.5, R * 0.01);
    ctx.beginPath(); ctx.arc(0, 0, R * (0.91 + S.beat * 0.025), 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
};

function initVinylVisual() {}
