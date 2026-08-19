/* ============================================================
   v79 — Whiteout fix + improved Droste Zoom
   ============================================================ */

// v-letterbox-lum: shared by applyPostFX3's letterbox bars and sampleFrameLum below, so
// the exposure guard always crops the exact same region the bars actually cover.
function letterboxBarH(H) {
  return H * (0.06 + Math.min(0.10, S.beat * 0.08 + S.loudness * 0.05));
}

function sampleFrameLum(W, H) {
  const sw = 32, sh = 18;
  chctx.globalCompositeOperation = "copy";
  chctx.globalAlpha = 1;
  chctx.imageSmoothingEnabled = true;
  // v-letterbox-lum: exclude the black letterbox bars from the sample — otherwise up to
  // ~32% of the measured area is pure black and the guard under-reacts to how bright the
  // actual visible content is.
  if (S.fx3 && S.fx3.letterbox) {
    const barH = letterboxBarH(H);
    chctx.drawImage(canvas, 0, barH, W, H - 2 * barH, 0, 0, sw, sh);
  } else {
    chctx.drawImage(canvas, 0, 0, sw, sh);
  }
  const d = chctx.getImageData(0, 0, sw, sh).data;
  let lum = 0;
  for (let i = 0; i < d.length; i += 4) {
    lum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }
  return lum / 255 / (d.length / 4);
}

function brightFxActive() {
  const f = S.fx, f2 = S.fx2, f3 = S.fx3;
  return !!(f.feedback || f.strobe || f.kaleido || f2.droste || f2.echospin || f2.radialblur || f2.hexkaleido ||
    f3.anamorphflare || f3.bleachpulse || f3.doubleexposure || f3.dustscratches || f3.lensflare || f3.lightleak ||
    S.shader.on);
}

function applyToneDim(W, H, lum) {
  if (!S.autoExposure && !S.reduceFlash) return;
  let dim = 0;
  if (S.autoExposure) {
    S.lumAvg += (lum - S.lumAvg) * (lum > S.lumAvg ? 0.42 : 0.16);
    const hot = Math.max(lum, S.lumAvg);
    dim = Math.max(0, Math.min(0.72, (hot - 0.38) * 1.75));
    if (hot > 0.68) dim = Math.max(dim, Math.min(0.85, (hot - 0.68) * 3.2));
    if (brightFxActive() && hot > 0.45) dim = Math.max(dim, (hot - 0.45) * 0.9);
  }
  if (S.reduceFlash) {
    const prev = S._lumPrev != null ? S._lumPrev : lum;
    const maxJump = 0.1;
    if (lum - prev > maxJump) dim = Math.max(dim, Math.min(0.82, (lum - prev - maxJump) * 2.4));
    S._lumPrev = Math.min(lum, prev + maxJump);
  }
  if (dim > 0.004) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  S._lastFrameLum = lum;
}

function drawDrosteZoom(W, H, cx, cy, diag) {
  snapshot(W, H);
  const rings = 7;
  const zoomBase = 0.56 + S.loudness * 0.04;
  const twist = S.time * 0.11 + S.bass * 0.25 + S.stereo * 0.12;
  const pulse = 1 + S.beat * 0.08;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1 || 1);
    const s = Math.pow(zoomBase, i + 1) * pulse;
    const a = 0.2 * (1 - t) * (1 - t);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy);
    ctx.rotate(twist * (1 + i * 0.18));
    ctx.scale(s, s);
    ctx.drawImage(fxC, -cx, -cy, W, H);
    ctx.restore();
  }

  const hole = Math.min(W, H) * (0.14 + S.beat * 0.05);
  const vig = ctx.createRadialGradient(cx, cy, hole * 0.2, cx, cy, diag * 0.42);
  vig.addColorStop(0, "rgba(0,0,0,0.88)");
  vig.addColorStop(0.55, "rgba(0,0,0,0.35)");
  vig.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function patchWhiteoutFix() {
  applyAutoExposure = function (W, H) {
    try {
      applyToneDim(W, H, sampleFrameLum(W, H));
    } catch (e) { /* tainted canvas */ }
  };

  const _drawScene = drawScene;
  drawScene = function (dt) {
    // v-export-exposure: the old bug (v73, "DNA invisible in export") was a stale
    // lumAvg inherited from the live preview dimming export frames on arrival — not
    // the guard itself. Reset on the export-start transition instead of disabling
    // exposure protection for the whole export (that left export frames unprotected
    // from whiteout clipping, since bright FX/blend accumulation is guard-only).
    if (S.exporting && !S._wasExporting) {
      S.lumAvg = 0;
      S._lumPrev = null;
    }
    S._wasExporting = S.exporting;
    _drawScene(dt);
    if (!S.exporting && S._lastFrameLum != null && S._lastFrameLum < 0.28) {
      S.lumAvg *= 0.992;
    }
  };
}

function initWhiteoutFix() {
  patchWhiteoutFix();
}
