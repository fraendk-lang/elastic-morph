/* ============================================================
   v90 — Realtime export stability: no freeze on long recordings
   captureStream(0)+requestFrame can stall after ~2min under encoder load.
   ============================================================ */

let rtChunkMergeTimer = null;
let rtLastDrawTs = 0;
let rtStallWarned = false;
let rtChunkMime = "video/mp4";

function startRtChunkMerge(mimeType) {
  stopRtChunkMerge();
  rtChunkMime = (mimeType || "video/mp4").split(";")[0];
  rtLastDrawTs = performance.now();
  rtStallWarned = false;
  rtChunkMergeTimer = setInterval(() => {
    if (!isRealtimeRecording() || !chunks || chunks.length < 12) return;
    try {
      const merged = new Blob(chunks, { type: rtChunkMime });
      chunks.length = 0;
      chunks.push(merged);
    } catch (e) {
      console.warn("RT chunk merge failed:", e);
    }
  }, 30000);
}

function stopRtChunkMerge() {
  if (rtChunkMergeTimer) { clearInterval(rtChunkMergeTimer); rtChunkMergeTimer = null; }
  rtStallWarned = false;
}

function noteRtFrameDrawn() {
  rtLastDrawTs = performance.now();
}

function checkRtRenderStall() {
  if (!isRealtimeRecording() || !rtLastDrawTs) return;
  if (performance.now() - rtLastDrawTs > 3000) {
    if (!rtStallWarned) {
      rtStallWarned = true;
      showAppToast("Export: Bild-Render stockt — App im Vordergrund lassen.", 5500);
    }
  }
}

function patchRealtimeExportStability() {
  const _drawScene = drawScene;
  drawScene = function (dt) {
    const rt = isRealtimeRecording() && !S.exporting;
    if (rt) { S.exporting = true; S.exportScale = 1; S.perfScale = 1; }
    try { _drawScene(dt); }
    finally {
      if (rt) {
        S.exporting = false;
        noteRtFrameDrawn();
      }
    }
  };

  const _drawExportFade = drawExportFade;
  drawExportFade = function (W, H) {
    _drawExportFade(W, H);
  };

  const _trackFPS = trackFPS;
  trackFPS = function (now) {
    if (isRealtimeRecording()) S.perfScale = 1;
    _trackFPS(now);
    if (isRealtimeRecording()) {
      S.perfScale = 1;
      checkRtRenderStall();
    }
  };

  const _endRealtimeCapture = endRealtimeCapture;
  endRealtimeCapture = function () {
    stopRtChunkMerge();
    rtCaptureTrack = null;
    S.realtimeRecording = false;
  };

  const _onRealtimeExportSaved = onRealtimeExportSaved;
  onRealtimeExportSaved = function (blob, rw, rh, mime, vbps, durS) {
    stopRtChunkMerge();
    return _onRealtimeExportSaved(blob, rw, rh, mime, vbps, durS);
  };
}

function initRealtimeExportStability() {
  patchRealtimeExportStability();
}
