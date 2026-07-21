/* ============================================================
   v61 — iPad / touch UX (pinch helpers, touch class, hints)
   ============================================================ */

function initTabletUX() {
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (touch) document.body.classList.add("is-touch");

  $("zoomInBtn")?.addEventListener("click", () => nudgeZoom(0.06));
  $("zoomOutBtn")?.addEventListener("click", () => nudgeZoom(-0.06));
  $("zoomResetBtn")?.addEventListener("click", () => setCtrlZoom(0.5));

  /* iOS Safari: unlock audio on first tap anywhere */
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    document.removeEventListener("touchstart", unlockAudio, true);
    document.removeEventListener("click", unlockAudio, true);
  };
  document.addEventListener("touchstart", unlockAudio, { capture: true, passive: true });
  document.addEventListener("click", unlockAudio, { capture: true, passive: true });
}
