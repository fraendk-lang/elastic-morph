/* ============================================================
   v96 — Realtime export: graceful stop with audio + video fade-out
   Fixes abrupt cut when stopping Reel / ● Export mid-track or at end.
   ============================================================ */

let exportAudioTap = null;

function wireRealtimeExportAudio(audioSrc, exportDest) {
  teardownRealtimeExportAudio();
  if (!audioCtx || !audioSrc || !exportDest) return;
  const gain = audioCtx.createGain();
  gain.gain.value = 1;
  try {
    audioSrc.connect(gain);
    gain.connect(exportDest);
    exportAudioTap = { gain, dest: exportDest, src: audioSrc };
  } catch (e) {
    try { audioSrc.connect(exportDest); } catch (x) { }
  }
}

function teardownRealtimeExportAudio() {
  if (!exportAudioTap) return;
  const { gain, dest, src } = exportAudioTap;
  try { src.disconnect(gain); } catch (e) { }
  try { gain.disconnect(dest); } catch (e) { }
  exportAudioTap = null;
}

function realtimeExportFadeOutSec() {
  if (typeof exportFadeOutMs === "function") return exportFadeOutMs() / 1000;
  const fo = (S.exportTrans || {}).fadeOut;
  if (fo && fo.on) return Math.max(0.35, fo.dur || 2);
  return 0.35;
}

function rampRealtimeExportAudioOut(sec) {
  if (!exportAudioTap || !audioCtx) return;
  if (S.exportTrans && S.exportTrans.audioFade === false) return;
  const g = exportAudioTap.gain.gain;
  sec = Math.max(0.08, sec);
  const t0 = audioCtx.currentTime;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(Math.max(0, g.value), t0);
  g.linearRampToValueAtTime(0, t0 + sec);
}

function gracefulStopRealtimeExport() {
  if (typeof recorder === "undefined" || !recorder || recorder.state !== "recording") return false;
  if (typeof fadeStopTimer !== "undefined" && fadeStopTimer) return true;

  const foSec = realtimeExportFadeOutSec();
  const foMs = Math.round(foSec * 1000);

  if (typeof exportFade !== "undefined" && exportFade) {
    exportFade.endAt = performance.now() + foMs;
  }

  rampRealtimeExportAudioOut(foSec);

  if (typeof loopTimer !== "undefined" && loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  fadeStopTimer = setTimeout(() => {
    fadeStopTimer = null;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, foMs + 120);

  const btn = $("exportBtn");
  if (btn) btn.textContent = "■ Fading out…";
  return true;
}

function patchExportTransFadeEdge() {
  if (typeof exportTransAlpha !== "function") return;
  const _alpha = exportTransAlpha;
  exportTransAlpha = function (t, dur, trans) {
    trans = trans || S.exportTrans || defaultExportTrans();
    if (!dur || dur <= 0) return 0;
    let alpha = 0;
    const fi = trans.fadeIn, fo = trans.fadeOut;
    if (fi && fi.on && fi.dur > 0 && t < fi.dur) {
      alpha = Math.max(alpha, 1 - exportTransCurve(t / fi.dur, fi.curve || "smooth"));
    }
    if (fo && fo.on && fo.dur > 0 && t >= dur - fo.dur) {
      alpha = Math.max(alpha, exportTransCurve((t - (dur - fo.dur)) / fo.dur, fo.curve || "smooth"));
    }
    return Math.max(0, Math.min(1, alpha));
  };
  exportTransGain = function (t, dur, trans) {
    trans = trans || S.exportTrans || defaultExportTrans();
    if (!trans.audioFade) return 1;
    return 1 - exportTransAlpha(t, dur, trans);
  };
}

function initRealtimeExportGracefulStop() {
  patchExportTransFadeEdge();
}
