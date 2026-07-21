/* ============================================================
   v75 — DNA visibility: guard exportRes, tame auto-exposure, recover lumAvg
   ============================================================ */

function resetVisualExposure() {
  S.lumAvg = 0;
  S._lumPrev = null;
}

function exportResActive() {
  return !!(S.exporting || (typeof recorder !== "undefined" && recorder && recorder.state === "recording"));
}

function patchVisualRecovery() {
  const _resize = resize;
  resize = function () {
    if (S.exportRes && !exportResActive()) {
      S.exportRes = null;
    }
    return _resize();
  };

  const _applyAutoExposure = applyAutoExposure;
  applyAutoExposure = function (W, H) {
    if (S.exporting) return;
    _applyAutoExposure(W, H);
  };

  const _drawScene = drawScene;
  drawScene = function (dt) {
    if (S.exportRes && !exportResActive()) S.exportRes = null;
    _drawScene(dt);
  };

  const _loadFile = loadFile;
  loadFile = function (file) {
    resetVisualExposure();
    if (S.exportRes && !exportResActive()) S.exportRes = null;
    return _loadFile(file);
  };

  const _startRealtimeExport = startRealtimeExport;
  startRealtimeExport = function () {
    showAppToast("Echtzeit-Aufnahme startet — für HQ: Chrome + ⤓ HQ Export.", 4800);
    $("exportBtn")?.click();
  };

  resetVisualExposure();
}

function initVisualRecovery() {
  patchVisualRecovery();
}
