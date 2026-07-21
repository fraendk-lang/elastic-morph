/* ============================================================
   v63 — Phase A blindspot fixes (iPad Creator path)
   ============================================================ */

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|opus|aiff|aif|caf|wma|webm)$/i;

function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("audio")) return true;
  return AUDIO_EXT.test(file.name || "");
}

function supportsHQExport() {
  return typeof VideoEncoder !== "undefined"
    && typeof AudioEncoder !== "undefined"
    && typeof VideoFrame !== "undefined";
}

function showAppToast(msg, ms) {
  let el = $("appToast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showAppToast._t);
  showAppToast._t = setTimeout(() => el.classList.remove("show"), ms || 4200);
}

function triggerRealtimeExportFallback(reason) {
  if (reason) showAppToast(reason);
  setTimeout(() => $("exportBtn")?.click(), reason ? 480 : 0);
}

function syncCreatorAspectClass() {
  const app = $("app");
  if (!app) return;
  const [w, h] = S.aspect || [16, 9];
  app.classList.toggle("creator-aspect-portrait", S.uiMode === "creator" && h > w);
}

function creatorCanHQ() {
  return !!(S.audioBuffer && !S.micMode && supportsHQExport());
}

function creatorCanExport() {
  return !!(S.audioBuffer || audioEl.src || S.micMode);
}

function patchPhaseA() {
  const _loadFile = loadFile;
  loadFile = function (file) {
    if (!isAudioFile(file)) {
      showAppToast("Keine Audio-Datei erkannt — bitte MP3, WAV, M4A, FLAC, … wählen.");
      return;
    }
    return _loadFile(file);
  };

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    if (S.exporting) return;
    if (!S.audioBuffer) {
      if (audioEl.src && !S.micMode) {
        triggerRealtimeExportFallback("Analyse läuft noch — starte Echtzeit-Aufnahme (● Export).");
        return;
      }
      alert("Bitte zuerst einen Track laden.");
      return;
    }
    if (!supportsHQExport()) {
      triggerRealtimeExportFallback("Safari/iPad: Echtzeit-Aufnahme statt HQ. Chrome/Edge für frame-genaues MP4.");
      return;
    }
    return _exportHQ();
  };

  const _setCreatorFormat = setCreatorFormat;
  setCreatorFormat = function (w, h) {
    _setCreatorFormat(w, h);
    syncCreatorAspectClass();
  };

  const _setUiMode = setUiMode;
  setUiMode = function (mode) {
    _setUiMode(mode);
    syncCreatorAspectClass();
  };

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    const exp = $("creatorExport");
    if (!exp) return;
    const hasTrack = creatorCanExport();
    const hq = creatorCanHQ();
    exp.disabled = !hasTrack;
    exp.textContent = hq ? "⤓ HQ Export" : (S.micMode ? "● Live Export" : "● Echtzeit Export");
    exp.title = hq
      ? "Frame-genauer MP4-Export (Chrome/Edge)"
      : "Echtzeit-Aufnahme — läuft mit Playback mit (Safari/iPad/Mic)";
    syncCreatorAspectClass();
  };

  const expBtn = $("creatorExport");
  if (expBtn) {
    const neo = expBtn.cloneNode(true);
    expBtn.replaceWith(neo);
    neo.addEventListener("click", () => {
      if (!creatorCanExport()) {
        alert("Bitte zuerst einen Track laden oder Live Input aktivieren.");
        return;
      }
      if (creatorCanHQ()) $("hqExportBtn")?.click();
      else triggerRealtimeExportFallback(null);
    });
  }

  syncCreatorAspectClass();
  updateCreatorDock();
}

function initPhaseA() {
  patchPhaseA();
}
