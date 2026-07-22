/* ============================================================
   v98 — Keyboard: T toggles canvas text (Tap-Sync keeps priority)
   ============================================================ */

function toggleCanvasTextLive() {
  S.textLiveHidden = !S.textLiveHidden;
  const on = !S.textLiveHidden;
  if (typeof showAppToast === "function") {
    showAppToast(on ? "Text ein" : "Text aus", 1600);
  }
}

function patchCanvasTextLiveToggle() {
  if (S.textLiveHidden == null) S.textLiveHidden = false;

  if (typeof drawTextLayer === "function" && !drawTextLayer._v98) {
    const _drawTextLayer = drawTextLayer;
    drawTextLayer = function (W, H, hue, P) {
      if (S.textLiveHidden) return;
      return _drawTextLayer(W, H, hue, P);
    };
    drawTextLayer._v98 = true;
  }

  document.addEventListener("keydown", e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key !== "t" && e.key !== "T") return;
    if (S.lyrics && S.lyrics.tap && S.lyrics.tap.active) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    toggleCanvasTextLive();
  });

  const textShow = $("textShow");
  if (textShow && !textShow.dataset.v98) {
    textShow.dataset.v98 = "1";
    const label = textShow.closest("label");
    if (label && !/key:\s*T/i.test(label.textContent)) {
      label.appendChild(document.createTextNode(" (live: T)"));
    }
  }

  const helpKeys = document.querySelector("#helpCard .keys span");
  if (helpKeys && !helpKeys.dataset.v98) {
    helpKeys.dataset.v98 = "1";
    helpKeys.innerHTML = helpKeys.innerHTML.replace(
      "<b>V</b> Visual Ebene 2",
      "<b>V</b> Visual Ebene 2 · <b>T</b> Text ein/aus"
    );
  }
}

function initCanvasTextLiveToggle() {
  patchCanvasTextLiveToggle();
}
