/* ============================================================
   v80 — DNA visibility: stop preset color explosion, tame idle blowout
   ============================================================ */

function dnaIsLive() {
  return !!(S.playing || S.micMode || audioEl.src);
}

function patchDnaVisibility() {
  const _updateAudioFeatures = updateAudioFeatures;
  updateAudioFeatures = function (dt) {
    _updateAudioFeatures(dt);
    if (!dnaIsLive()) {
      S.bass = Math.min(S.bass, 0.13);
      S.mids = Math.min(S.mids, 0.09);
      S.highs = Math.min(S.highs, 0.07);
      S.loudness = S.bass * 0.5 + S.mids * 0.35 + S.highs * 0.15;
      S.beat *= 0.9;
      S.transient *= 0.9;
    }
  };
}

function initDnaVisibility() {
  patchDnaVisibility();
}
