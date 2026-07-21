/* ============================================================
   v86 — Visual polish: depth, balance, softer exposure (no new features)
   ============================================================ */

function applyToneDimPolished(W, H, lum) {
  if (!S.autoExposure && !S.reduceFlash) return;
  let dim = 0;
  if (S.autoExposure) {
    S.lumAvg += (lum - S.lumAvg) * (lum > S.lumAvg ? 0.36 : 0.18);
    const hot = Math.max(lum, S.lumAvg);
    dim = Math.max(0, Math.min(0.62, (hot - 0.42) * 1.48));
    if (hot > 0.72) dim = Math.max(dim, Math.min(0.76, (hot - 0.72) * 2.6));
    if (brightFxActive() && hot > 0.5) dim = Math.max(dim, (hot - 0.5) * 0.72);
    if (!dnaIsLive() && hot > 0.52) dim = Math.max(dim, Math.min(0.16, (hot - 0.52) * 0.62));
  }
  if (S.reduceFlash) {
    const prev = S._lumPrev != null ? S._lumPrev : lum;
    const maxJump = 0.1;
    if (lum - prev > maxJump) dim = Math.max(dim, Math.min(0.78, (lum - prev - maxJump) * 2.2));
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

function patchVisualPolishV86() {
  applyToneDim = applyToneDimPolished;

  const _applyMasterFinish = applyMasterFinish;
  applyMasterFinish = function (W, H, dt) {
    _applyMasterFinish(W, H, dt);
    if (!S.master.on || S.exporting) return;
    const cx = W / 2, cy = H / 2, diag = Math.max(W, H);
    ctx.save();
    const lift = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.48);
    lift.addColorStop(0, `rgba(255,255,255,${0.012 + S.loudness * 0.022})`);
    lift.addColorStop(0.65, "rgba(255,255,255,0)");
    lift.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  };

  const _rebuildVignette = rebuildVignette;
  rebuildVignette = function (W, H) {
    const v = S.master.vignette;
    if (v <= 0.01) { vigGrad = null; return; }
    const vv = v * 0.92;
    vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.4 - vv * 0.06), W / 2, H / 2, Math.max(W, H) * (0.64 + vv * 0.16));
    vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    vigGrad.addColorStop(0.72, "rgba(0,0,0,0)");
    vigGrad.addColorStop(1, `rgba(0,0,0,${vv})`);
  };

  const _renderShader = renderShader;
  renderShader = function (W, H, hue) {
    if (!S.shader.on) return;
    const live = dnaIsLive();
    const hero = typeof heroScreenActive === "function" && heroScreenActive();
    const opMul = live ? 1 : (hero ? 0.72 : 0.58);
    const prevOp = S.shader.opacity;
    S.shader.opacity = prevOp * opMul;
    _renderShader(W, H, hue);
    S.shader.opacity = prevOp;
  };
}

function initVisualPolishV86() {
  patchVisualPolishV86();
  if (canvas.width > 0) rebuildVignette(canvas.width, canvas.height);
}
