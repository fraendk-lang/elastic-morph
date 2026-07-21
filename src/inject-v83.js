/* ============================================================
   v83 — Hero/fullscreen balance + exposure reset on resize
   ============================================================ */

function visualBackdropActive() {
  const dh = $("dropHint");
  if (!dh || window.getComputedStyle(dh).display === "none") return false;
  if (document.fullscreenElement) return false;
  const stage = $("stage");
  if (!stage) return true;
  const sr = stage.getBoundingClientRect();
  const hr = dh.getBoundingClientRect();
  return hr.width > 0 && hr.height > 0 && sr.width > 0 &&
    hr.left < sr.right && hr.right > sr.left && hr.top < sr.bottom && hr.bottom > sr.top;
}

function patchHeroFullscreen() {
  heroScreenActive = visualBackdropActive;

  let lastCanvasKey = "";
  const _resize = resize;
  resize = function () {
    const prevKey = lastCanvasKey;
    _resize();
    const key = canvas.width + "x" + canvas.height + (document.fullscreenElement ? ":fs" : "");
    if (key !== prevKey) {
      lastCanvasKey = key;
      S.lumAvg = Math.min(S.lumAvg, 0.28);
      S._lumPrev = null;
      if (GL) { GL.w = 0; GL.h = 0; }
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    #dropHint {
      background:
        radial-gradient(ellipse 92% 82% at 50% 44%, rgba(7,7,11,0.38) 0%, rgba(7,7,11,0.62) 52%, rgba(7,7,11,0.78) 100%) !important;
    }
    #stage:fullscreen {
      display: flex; align-items: center; justify-content: center;
      background: #000;
    }
  `;
  document.head.appendChild(style);
}

function initChromaSplitFix() {
  patchHeroFullscreen();
}
