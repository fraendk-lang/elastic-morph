/* ============================================================
   v74 — Export fidelity: HQ by default, no silent realtime fallback
   ============================================================ */

function waitForAnalysis(maxMs) {
  maxMs = maxMs || 120000;
  return new Promise(resolve => {
    const t0 = Date.now();
    (function tick() {
      if (analysisReady() || S.analyzeState === "error" || Date.now() - t0 >= maxMs) return resolve();
      setTimeout(tick, 250);
    })();
  });
}

function resolveExportPixels() {
  const fmt = document.querySelector("#fmtRow .fmt.active:not([data-loop])");
  if (fmt && fmt.dataset.res) {
    const p = fmt.dataset.res.split("x").map(Number);
    if (p.length === 2 && p[0] > 0 && p[1] > 0) return p;
  }
  const [aw, ah] = S.aspect || [16, 9];
  const hqSel = $("hqRes");
  let H = 1080;
  if (hqSel) {
    const v = +hqSel.value || 1080;
    H = (typeof isProUnlocked === "function" && isProUnlocked()) ? v : Math.min(v, 1080);
  }
  return [Math.round(H * aw / ah / 2) * 2, H];
}

function hqExportLabel() {
  const draft = $("hqDraft") && $("hqDraft").checked;
  if (draft) return "720p Draft";
  const H = +($("hqRes")?.value || 1080) || 1080;
  const [W] = resolveExportPixels();
  const Wpx = Math.round(H * (S.aspect?.[0] || 16) / (S.aspect?.[1] || 9) / 2) * 2;
  return `${Wpx || W}×${H} HQ`;
}

async function runCreatorExport() {
  if (!creatorCanExport()) {
    alert("Bitte zuerst einen Track laden oder Live Input aktivieren.");
    return;
  }
  if (S.micMode || !supportsHQExport()) {
    showAppToast("Live/Safari: Echtzeit-Aufnahme — Chrome/Edge empfohlen für HQ.", 5500);
    startRealtimeExport();
    return;
  }
  if (!analysisReady()) {
    showAppToast("Analyse läuft — HQ-Export startet automatisch…", 4000);
    await waitForAnalysis();
  }
  if (!analysisReady()) {
    alert("HQ-Export nicht verfügbar. Bitte Track neu laden (Chrome/Edge) oder Analyse abwarten.");
    return;
  }
  await exportHQ();
}

function startRealtimeExport() {
  const res = resolveExportPixels();
  showAppToast(`Echtzeit-Aufnahme ${res[0]}×${res[1]} — für beste Qualität: HQ Export (Chrome).`, 4800);
  $("exportBtn")?.click();
}

function patchExportFidelity() {
  triggerRealtimeExportFallback = function (reason) {
    showAppToast(
      (reason ? reason + " " : "") + "Echtzeit-Aufnahme ist qualitativ schwächer als HQ Export.",
      6000
    );
    setTimeout(() => startRealtimeExport(), 700);
  };

  const expBtn = $("creatorExport");
  if (expBtn && !expBtn.dataset.v74) {
    expBtn.dataset.v74 = "1";
    const neo = expBtn.cloneNode(true);
    expBtn.replaceWith(neo);
    neo.addEventListener("click", () => { runCreatorExport(); });
  }

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    if (S.analyzeState === "analyzing") {
      showAppToast("Analyse läuft…");
      await waitForAnalysis();
    }
    if (!S.audioBuffer) {
      if (audioEl.src && !S.micMode) {
        showAppToast("HQ-Export noch nicht bereit — bitte kurz warten.");
        await waitForAnalysis(60000);
      }
      if (!S.audioBuffer) {
        alert("HQ-Export braucht eine analysierte Audiodatei. Bitte Track laden und warten.");
        return;
      }
    }
    if (!supportsHQExport()) {
      showAppToast("WebCodecs nicht verfügbar — nutze Chrome/Edge für HQ Export.");
      return;
    }
    return _exportHQ();
  };

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    const exp = $("creatorExport");
    if (!exp) return;
    const hq = creatorCanHQ();
    exp.textContent = hq ? `⤓ HQ Export (${hqExportLabel()})` : (S.micMode ? "● Live Export" : "● Warte auf Analyse…");
    exp.disabled = !creatorCanExport() || (!hq && !S.micMode && supportsHQExport());
    exp.title = hq
      ? "Frame-genauer MP4 — gleiche Qualität wie 500MB+ Exports"
      : "HQ startet sobald Analyse fertig (Chrome/Edge)";
  };

  const expBtnTop = $("exportBtn");
  if (expBtnTop && !expBtnTop.dataset.v74) {
    expBtnTop.dataset.v74 = "1";
    expBtnTop.title = "Echtzeit-Aufnahme — für 1080p/4K: HQ Export in Creator Cuts oder Creator-Dock.";
  }
}

function initExportFidelity() {
  patchExportFidelity();
}
