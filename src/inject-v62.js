/* ============================================================
   v62 — Creator look swipe + portrait Pro hint (iPad)
   ============================================================ */

const PORTRAIT_DISMISS_SS = "elasticMorph.portraitProDismiss";

function getCreatorLookPicks() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  if (!hasTrack) return [];
  return PRESETS.slice();
}

function hapticLookPulse() {
  if (navigator.vibrate) navigator.vibrate(12);
}

function flashLookSwipe(name, dir, index, total) {
  const el = $("lookSwipeToast");
  if (!el) return;
  const pos = total > 1 ? ` (${index}/${total})` : "";
  el.textContent = (dir > 0 ? "→ " : "← ") + name + pos;
  el.classList.add("show");
  clearTimeout(flashLookSwipe._t);
  flashLookSwipe._t = setTimeout(() => el.classList.remove("show"), 950);
}

function cycleCreatorLook(delta) {
  const picks = getCreatorLookPicks();
  if (!picks.length) return;
  let idx = picks.indexOf(S.preset);
  if (idx < 0) idx = 0;
  idx = (idx + delta + picks.length) % picks.length;
  applyPreset(picks[idx]);
  hapticLookPulse();
  flashLookSwipe(picks[idx].name, delta, idx + 1, picks.length);
}

function updateLookSwipeHint() {
  const hint = $("lookSwipeHint");
  if (!hint) return;
  const show = S.uiMode === "creator"
    && document.body.classList.contains("is-touch")
    && !!(S.audioBuffer || audioEl.src || S.micMode);
  hint.classList.toggle("show", show);
}

function isPortraitTablet() {
  return matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
}

function updatePortraitProHint() {
  const el = $("portraitProHint");
  if (!el) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(PORTRAIT_DISMISS_SS) === "1"; } catch (e) { }
  const show = S.uiMode === "pro" && isPortraitTablet() && !dismissed;
  el.classList.toggle("show", show);
  document.body.classList.toggle("pro-portrait-hint", show);
}

function initCreatorLookSwipe() {
  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    updateLookSwipeHint();
  };
  updateLookSwipeHint();

  const zone = $("canvasArea");
  if (!zone) return;
  let sx = 0, sy = 0, tracking = false;

  zone.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  zone.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    if (S.uiMode !== "creator") return;
    if (!getCreatorLookPicks().length) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    cycleCreatorLook(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function initPortraitProHint() {
  $("portraitProDismiss")?.addEventListener("click", () => {
    try { sessionStorage.setItem(PORTRAIT_DISMISS_SS, "1"); } catch (e) { }
    updatePortraitProHint();
  });
  $("portraitProCreator")?.addEventListener("click", () => {
    setUiMode("creator");
    updatePortraitProHint();
  });

  const _setUiMode = setUiMode;
  setUiMode = function (mode) {
    _setUiMode(mode);
    updatePortraitProHint();
  };

  matchMedia("(orientation: portrait) and (max-width: 900px)").addEventListener("change", updatePortraitProHint);
  window.addEventListener("resize", updatePortraitProHint);
  updatePortraitProHint();
}
