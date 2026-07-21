/* ============================================================
   v65 — Phase C: UX coherence
   ============================================================ */

const AUTO_LOOK_LS = "elasticMorph.autoLook";
const SWIPE_MODE_LS = "elasticMorph.swipeLooks";

function loadPhaseCPrefs() {
  try { S.autoLook = localStorage.getItem(AUTO_LOOK_LS) !== "0"; } catch (e) { S.autoLook = true; }
  try { S.swipeLookMode = localStorage.getItem(SWIPE_MODE_LS) || "smart"; } catch (e) { S.swipeLookMode = "smart"; }
  S.lookSwipeLocked = false;
  S.demoMode = false;
}

function saveAutoLook(v) {
  S.autoLook = !!v;
  try { localStorage.setItem(AUTO_LOOK_LS, S.autoLook ? "1" : "0"); } catch (e) { }
}

function saveSwipeMode(mode) {
  S.swipeLookMode = mode === "all" ? "all" : "smart";
  try { localStorage.setItem(SWIPE_MODE_LS, S.swipeLookMode); } catch (e) { }
  syncSwipeModeUI();
  updateLookSwipeHint();
}

function getCreatorLookPicks() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  if (!hasTrack) return [];
  if (S.swipeLookMode === "smart" && S.energyCurve && S.energyCurve.length) return suggestSmartLooks();
  return PRESETS.slice();
}

function syncSwipeModeUI() {
  document.querySelectorAll("[data-swipe]").forEach(b =>
    b.classList.toggle("active", b.dataset.swipe === S.swipeLookMode));
  const lock = $("lookLockBtn");
  if (lock) {
    lock.classList.toggle("on", S.lookSwipeLocked);
    lock.textContent = S.lookSwipeLocked ? "🔒 Gesperrt" : "🔓 Swipe";
  }
}

function updateLookSwipeHint() {
  const hint = $("lookSwipeHint");
  if (!hint) return;
  const show = S.uiMode === "creator"
    && document.body.classList.contains("is-touch")
    && !!(S.audioBuffer || audioEl.src || S.micMode);
  hint.classList.toggle("show", show);
  if (!show) return;
  if (S.lookSwipeLocked) hint.textContent = "Look-Wischen gesperrt — 🔒 antippen zum Freigeben";
  else if (S.swipeLookMode === "smart") hint.textContent = "← Wischen: 3 empfohlene Looks →";
  else hint.textContent = "← Wischen: alle DNA-Looks →";
}

function updateDockToggleLabel() {
  const t = $("creatorDockToggle");
  if (!t) return;
  const collapsed = $("app")?.classList.contains("creator-dock-collapsed");
  t.textContent = collapsed ? "▴ Steuerung einblenden" : "▾ Ausblenden";
}

function updateDemoBanner() {
  const el = $("demoBanner");
  if (!el) return;
  const show = S.demoMode && !audioEl.src && !S.micMode;
  el.classList.toggle("show", show);
}

function buildProPortraitSheet() {
  const host = $("proSheetSliders");
  if (!host || host.dataset.built) return;
  ["morph", "pulse", "density", "zoom"].forEach(key => {
    const def = CONTROL_DEFS.find(c => c[0] === key);
    if (def) host.appendChild(makeSlider(key, def[1], "slider-row"));
  });
  host.dataset.built = "1";
}

function syncProPortraitSheet() {
  const sheet = $("proPortraitSheet");
  if (!sheet) return;
  const show = S.uiMode === "pro" && isPortraitTablet();
  sheet.classList.toggle("show", show);
}

function patchPhaseC() {
  const _applyFirstSmartLook = applyFirstSmartLook;
  applyFirstSmartLook = function () {
    if (S.autoLook === false) return;
    _applyFirstSmartLook();
  };

  const _cycleCreatorLook = cycleCreatorLook;
  cycleCreatorLook = function (delta) {
    if (S.lookSwipeLocked) {
      showAppToast("Look-Wischen gesperrt.");
      return;
    }
    _cycleCreatorLook(delta);
  };

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    updateLookSwipeHint();
    updateDockToggleLabel();
  };

  const _setUiMode = setUiMode;
  setUiMode = function (mode) {
    _setUiMode(mode);
    syncProPortraitSheet();
    updateDemoBanner();
  };

  $("autoLookChk")?.addEventListener("change", e => saveAutoLook(e.target.checked));
  document.querySelectorAll("[data-swipe]").forEach(b => {
    b.addEventListener("click", () => saveSwipeMode(b.dataset.swipe));
  });
  $("lookLockBtn")?.addEventListener("click", () => {
    S.lookSwipeLocked = !S.lookSwipeLocked;
    syncSwipeModeUI();
    updateLookSwipeHint();
  });

  const dockToggle = $("creatorDockToggle");
  if (dockToggle) {
    dockToggle.replaceWith(dockToggle.cloneNode(true));
    $("creatorDockToggle")?.addEventListener("click", () => {
      $("app")?.classList.toggle("creator-dock-collapsed");
      updateDockToggleLabel();
    });
  }

  $("proSheetToggle")?.addEventListener("click", () => {
    const panel = $("proSheetPanel");
    const btn = $("proSheetToggle");
    if (!panel || !btn) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.textContent = open ? "▾ Regler schließen" : "⚙ Live-Regler";
  });

  $("demoLoadBtn")?.addEventListener("click", () => $("fileInput")?.click());

  const _heroDemo = $("heroDemoBtn");
  if (_heroDemo) {
    _heroDemo.addEventListener("click", () => {
      S.demoMode = true;
      updateDemoBanner();
      showAppToast("Demo-Modus — lade einen Track für Playback & Export.", 5000);
    }, { capture: true });
  }

  const _loadFile = loadFile;
  loadFile = function (file) {
    S.demoMode = false;
    updateDemoBanner();
    return _loadFile(file);
  };

  if ($("autoLookChk")) $("autoLookChk").checked = S.autoLook !== false;
  syncSwipeModeUI();
  buildProPortraitSheet();
  syncProPortraitSheet();
  updateDockToggleLabel();
  updateLookSwipeHint();
  updateDemoBanner();

  matchMedia("(orientation: portrait) and (max-width: 900px)").addEventListener("change", syncProPortraitSheet);
  window.addEventListener("resize", syncProPortraitSheet);
}

function initPhaseC() {
  loadPhaseCPrefs();
  patchPhaseC();
}
