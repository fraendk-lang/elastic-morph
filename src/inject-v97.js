/* ============================================================
   v97 — Keyboard: V toggles Visual Layer B (Layer B overlay)
   ============================================================ */

function toggleLayerB() {
  const el = $("lbOn");
  if (!el) return;
  el.click();
  if (S.layerB.on && S.layerB.type === "starfield" && typeof initStars === "function") initStars();
}

function patchLayerBShortcut() {
  document.addEventListener("keydown", e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key !== "v" && e.key !== "V") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    toggleLayerB();
  });

  const lb = $("lbOn");
  if (lb && !lb.dataset.v97) {
    lb.dataset.v97 = "1";
    const label = lb.closest("label");
    if (label && !/key:\s*V/i.test(label.textContent)) {
      label.appendChild(document.createTextNode(" (key: V)"));
    }
  }

  const helpKeys = document.querySelector("#helpCard .keys span");
  if (helpKeys && !helpKeys.dataset.v97) {
    helpKeys.dataset.v97 = "1";
    helpKeys.innerHTML = helpKeys.innerHTML.replace(
      "<b>P</b> Partikel",
      "<b>P</b> Partikel · <b>V</b> Visual Ebene 2"
    );
  }
}

function initLayerBShortcut() {
  patchLayerBShortcut();
}
