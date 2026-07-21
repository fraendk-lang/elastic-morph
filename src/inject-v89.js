/* ============================================================
   v89 — Realtime export v2: requestFrame capture, locked fidelity, HQ bitrate
   ============================================================ */

let rtCaptureTrack = null;

function isRealtimeRecording() {
  return typeof recorder !== "undefined" && recorder && recorder.state === "recording";
}

function realtimeVideoBitrateV89(w, h, fps) {
  const px = Math.max(1, w * h);
  // Glow-heavy visuals need high bpp; Chrome often undershoots requested rate.
  return Math.min(150_000_000, Math.max(50_000_000, Math.round(px * fps * 0.58)));
}

function pickRealtimeMime() {
  const cands = [
    "video/mp4;codecs=avc1.640033,mp4a.40.2",
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm"
  ];
  for (const m of cands) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { }
  }
  return "video/webm";
}

function realtimeExportMime(alpha) {
  return alpha ? "video/webm;codecs=vp9" : pickRealtimeMime();
}

function beginRealtimeCapture(stream) {
  rtCaptureTrack = stream && stream.getVideoTracks ? (stream.getVideoTracks()[0] || null) : null;
}

function endRealtimeCapture() {
  rtCaptureTrack = null;
  S.realtimeRecording = false;
}

function markRealtimeRecording(on) {
  S.realtimeRecording = !!on;
  if (on) { S.perfScale = 1; S.exportScale = 1; }
}

function buildRealtimeRecorderOptions(mime, vbps, abps) {
  return {
    mimeType: mime,
    videoBitsPerSecond: vbps,
    audioBitsPerSecond: abps,
    bitsPerSecond: vbps + abps
  };
}

function onRealtimeExportSaved(blob, rw, rh, mime, vbps, durS) {
  endRealtimeCapture();
  const mb = (blob.size / 1048576).toFixed(1);
  const codec = mime.includes("mp4") ? "H.264 MP4" : "WebM";
  const effMbps = durS > 0 ? ((blob.size * 8) / durS / 1e6).toFixed(1) : "?";
  showAppToast(`Export: ${mb} MB · ${rw}×${rh} · ${codec} · ~${effMbps} Mbit/s effektiv`, 6000);
  if (!mime.includes("mp4") || (durS > 10 && blob.size < durS * 1.5e6)) {
    setTimeout(() => showAppToast("Für 500MB+ Qualität: Chrome + ⤓ HQ Export (frame-genau).", 6500), 700);
  }
}

function patchRealtimeExportV89() {
  realtimeVideoBitrate = realtimeVideoBitrateV89;

  const _trackFPS = trackFPS;
  trackFPS = function (now) {
    if (isRealtimeRecording()) S.perfScale = 1;
    _trackFPS(now);
    if (isRealtimeRecording()) S.perfScale = 1;
  };

  const _resize = resize;
  resize = function () {
    _resize();
    if (isRealtimeRecording() && typeof bloomC !== "undefined" && bloomC) {
      bloomC.width = Math.max(2, Math.round(canvas.width / 4));
      bloomC.height = Math.max(2, Math.round(canvas.height / 4));
    }
  };

  const _drawScene = drawScene;
  drawScene = function (dt) {
    const rt = isRealtimeRecording() && !S.exporting;
    if (rt) { S.exporting = true; S.exportScale = 1; S.perfScale = 1; }
    try { _drawScene(dt); }
    finally {
      if (rt) S.exporting = false;
      if (rtCaptureTrack && typeof rtCaptureTrack.requestFrame === "function") {
        try { rtCaptureTrack.requestFrame(); } catch (e) { }
      }
    }
  };

  const _drawExportFade = drawExportFade;
  drawExportFade = function (W, H) {
    if (isRealtimeRecording() && S.exportPolish && S.exportPolish.on) {
      const shim = !S.exporting;
      if (shim) S.exporting = true;
      try { drawExportPolish(W, H); } catch (e) { }
      if (shim) S.exporting = false;
    }
    _drawExportFade(W, H);
  };
}

function initRealtimeExportV89() {
  patchRealtimeExportV89();
}
