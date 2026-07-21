/* ============================================================
   v73 — Fix DNA invisible: auto-exposure must not run during/between exports
   ============================================================ */

function patchAutoExposureFix() {
  const _applyAutoExposure = applyAutoExposure;
  applyAutoExposure = function (W, H) {
    if (S.exporting) return;
    _applyAutoExposure(W, H);
  };

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    try {
      return await _exportHQ();
    } finally {
      S.lumAvg = 0;
      S._lumPrev = null;
    }
  };

  const _drawScene = drawScene;
  drawScene = function (dt) {
    _drawScene(dt);
    if (S.lumAvg > 0.55 && !S.exporting && !S.playing && !audioEl.src) {
      S.lumAvg += (0.12 - S.lumAvg) * 0.08;
    }
  };
}

function initAutoExposureFix() {
  patchAutoExposureFix();
}
