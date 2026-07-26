/* ============================================================
   v109 — Creator: Direkt Export (schnell + Ton) vs HQ Export
   ============================================================ */

function runCreatorQuickExport() {
  if (!creatorCanExport()) {
    showAppToast("Zuerst Track laden oder Demo starten.", 3500);
    return;
  }
  const recording = typeof recorder !== "undefined" && recorder && recorder.state === "recording";
  if (!recording && audioEl.src && !S.micMode && !S.playing) play();
  if (!recording) {
    showAppToast("● Direkt Export — du hörst den Track. Nochmal tippen = Stop + Fade.", 5500);
  }
  $("exportBtn")?.click();
}

function runCreatorHQExport() {
  if (typeof runCreatorExport === "function") {
    showAppToast("⤓ HQ Export — dauert länger, währenddessen kein Ton.", 4500);
    runCreatorExport();
    return;
  }
  $("hqExportBtn")?.click();
}

function wireCreatorExportButtons() {
  const quickIds = ["creatorExport", "creatorExportCTAQuick"];
  quickIds.forEach(id => {
    const btn = $(id);
    if (!btn || btn.dataset.v109) return;
    btn.dataset.v109 = "quick";
    const neo = btn.cloneNode(true);
    neo.dataset.v109 = "quick";
    btn.replaceWith(neo);
    neo.addEventListener("click", runCreatorQuickExport);
  });

  const hqIds = ["creatorExportHQ", "creatorExportCTAHQ"];
  hqIds.forEach(id => {
    const btn = $(id);
    if (!btn || btn.dataset.v109) return;
    btn.dataset.v109 = "hq";
    const neo = btn.cloneNode(true);
    neo.dataset.v109 = "hq";
    btn.replaceWith(neo);
    neo.addEventListener("click", runCreatorHQExport);
  });
}

function syncCreatorExportButtons() {
  const hasTrack = creatorCanExport();
  const hq = creatorCanHQ();
  const quick = $("creatorExport");
  const hqBtn = $("creatorExportHQ");
  const ctaQuick = $("creatorExportCTAQuick");
  const ctaHq = $("creatorExportCTAHQ");

  if (quick) {
    quick.disabled = !hasTrack;
    const rec = typeof recorder !== "undefined" && recorder && recorder.state === "recording";
    quick.textContent = rec ? "■ Stop + Fade" : "● Direkt Export";
    quick.title = "Schnelle Aufnahme mit Ton — ideal für Reels & Shorts";
  }
  if (hqBtn) {
    hqBtn.disabled = !hasTrack || (!hq && !S.micMode && supportsHQExport());
    hqBtn.textContent = hq && typeof hqExportLabel === "function"
      ? `⤓ HQ (${hqExportLabel()})`
      : "⤓ HQ Export";
    hqBtn.title = "Beste Qualität — frame-genau, dauert länger, währenddessen stumm";
  }
  if (ctaQuick) {
    ctaQuick.disabled = !hasTrack;
    const rec = typeof recorder !== "undefined" && recorder && recorder.state === "recording";
    ctaQuick.textContent = rec ? "■ Stop + Fade" : "● Direkt Export";
  }
  if (ctaHq) hqBtn && (ctaHq.disabled = hqBtn.disabled);
}

function patchCreatorQuickExportV109() {
  wireCreatorExportButtons();

  const _update = updateCreatorDock;
  updateCreatorDock = function () {
    _update();
    syncCreatorExportButtons();
    if (typeof syncCreatorExportCTA === "function") syncCreatorExportCTA();
  };

  const _triggerStep = typeof triggerCreatorStep === "function" ? triggerCreatorStep : null;
  if (_triggerStep) {
    triggerCreatorStep = function (step) {
      if (step === 3) {
        runCreatorQuickExport();
        return;
      }
      _triggerStep(step);
    };
  }

  updateCreatorDock();
}

function initCreatorQuickExportV109() {
  patchCreatorQuickExportV109();
}
