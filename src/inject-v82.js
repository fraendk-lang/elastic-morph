/* ============================================================
   v82 — Hero screen: subtle backdrop (v82.1 — fix all-black regression)
   ============================================================ */

function heroScreenActive() {
  const dh = $("dropHint");
  if (!dh) return false;
  return window.getComputedStyle(dh).display !== "none";
}

function patchHeroScreen() {
  /* v82.1: no extra canvas dim — CSS overlay is enough */
}

function initHeroScreen() {
  patchHeroScreen();
}
