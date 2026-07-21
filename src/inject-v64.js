/* ============================================================
   v64 — Phase B: export fidelity & analysis gates
   ============================================================ */

const HEAVY_ENGINES = new Set(["flame", "hyperspace", "reaction", "attractor"]);
const HEAVY_SHADER = new Set(["gyroid", "raymarch", "feedback"]);

function analysisReady() {
  return S.analyzeState === "done" && !!S.audioBuffer;
}

function isHeavyExportPreset() {
  const eng = (S.preset && S.preset.engine) || "blob";
  if (HEAVY_ENGINES.has(eng)) return true;
  return !!(S.shader && S.shader.on && HEAVY_SHADER.has(S.shader.style));
}

function syncExportGates() {
  const analyzing = S.analyzeState === "analyzing";
  const ready = analysisReady();
  const hq = $("hqExportBtn");
  const batch = $("batchExportBtn");
  if (hq) {
    hq.disabled = analyzing || !ready || !!S.exporting;
    hq.title = analyzing ? "Analyse läuft…" : (!ready && audioEl.src ? "Warte auf Analyse" : "");
  }
  if (batch) {
    batch.disabled = analyzing || !ready || !!S.exporting;
    batch.title = analyzing ? "Analyse läuft…" : "";
  }
  const note = $("hqGateNote");
  if (note) {
    if (analyzing) note.textContent = "Analyse läuft — HQ-Export startet gleich.";
    else if (S.analyzeState === "error") note.textContent = "Analyse fehlgeschlagen — Echtzeit-Export geht, HQ braucht erneuten Upload.";
    else if (!ready && audioEl.src) note.textContent = "HQ-Export verfügbar sobald Analyse fertig.";
    else note.textContent = "";
  }
}

function creatorCanHQ() {
  return analysisReady() && !S.micMode && supportsHQExport();
}

function patchPhaseB() {
  const _exportHQ = exportHQ;
  exportHQ = async function () {
    if (S.analyzeState === "analyzing") {
      showAppToast("Analyse läuft noch — bitte kurz warten.");
      return;
    }
    if (!S.audioBuffer) {
      if (audioEl.src && !S.micMode) {
        triggerRealtimeExportFallback("Analyse läuft noch — starte Echtzeit-Aufnahme.");
        return;
      }
      alert("Bitte zuerst einen Track laden.");
      return;
    }
    if (!supportsHQExport()) {
      triggerRealtimeExportFallback("Safari/iPad: Echtzeit-Aufnahme statt HQ. Chrome/Edge für frame-genaues MP4.");
      return;
    }
    const draft = $("hqDraft") && $("hqDraft").checked;
    if (isHeavyExportPreset() && !draft) {
      if (!confirm("Schweres Preset oder Shader aktiv — HQ-Export kann lange dauern.\nTipp: Draft-Modus für schnellen Test.\n\nFortfahren?")) return;
    }
    S.exportShaderCap = draft ? 0.55 : 1;
    try {
      return await _exportHQ();
    } finally {
      S.exportShaderCap = null;
      syncExportGates();
    }
  };

  const _exportBatchHQ = exportBatchHQ;
  exportBatchHQ = async function () {
    if (S.analyzeState === "analyzing") {
      showAppToast("Analyse läuft noch…");
      return;
    }
    if (!analysisReady()) {
      alert("Bitte warten bis die Analyse fertig ist.");
      return;
    }
    if (!confirm("Batch-Export lädt 3 MP4s nacheinander herunter.\nSafari/iPad blockiert oft mehrere Downloads — am besten Chrome/Edge.\n\nFortfahren?")) return;
    await _exportBatchHQ();
  };

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    syncExportGates();
  };

  syncExportGates();
}

function initPhaseB() {
  patchPhaseB();
}
