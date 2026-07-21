/* ============================================================
   v87 — Realtime export quality: full render fidelity + higher bitrate
   Root cause: MediaRecorder path never set S.exporting, so perfScale
   throttled particles/shaders → soft frames + small files (~90MB/90s).
   ============================================================ */

function realtimeRenderActive() {
  return typeof exportResActive === "function" && exportResActive() && !S.exporting;
}

function realtimeExportFps() {
  return +($("hqFps")?.value || 30) || 30;
}

function realtimeVideoBitrate(w, h, fps) {
  const px = Math.max(1, w * h);
  // Higher than HQ (0.2 bpp) — realtime encoders need headroom for glow/gradients.
  return Math.min(120_000_000, Math.max(32_000_000, Math.round(px * fps * 0.38)));
}

function patchRealtimeExportQuality() {
  const _drawScene = drawScene;
  drawScene = function (dt) {
    const rt = realtimeRenderActive();
    if (rt) { S.exporting = true; S.exportScale = 1; }
    try { _drawScene(dt); }
    finally { if (rt) S.exporting = false; }
  };

  const _applyPostFX2 = applyPostFX2;
  applyPostFX2 = function (W, H, dt) {
    const rt = realtimeRenderActive();
    if (rt) { S.exporting = true; S.exportScale = 1; }
    try { _applyPostFX2(W, H, dt); }
    finally { if (rt) S.exporting = false; }
  };
}

function initRealtimeExportQuality() {
  patchRealtimeExportQuality();
}
