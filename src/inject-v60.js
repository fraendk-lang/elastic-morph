/* ============================================================
   v60 — stronger live parameter response + manual zoom
   ============================================================ */

/* Exponential curve: even mid-slider values feel clearly audible/visible */
function liveMul(key) {
  const v = ctrl[key] != null ? ctrl[key] : 0;
  return 0.28 + v * 1.72;
}

function camUserZoom() {
  const z = ctrl.zoom != null ? ctrl.zoom : 0.5;
  return 0.42 + z * 1.78;   /* ~0.42× .. 2.2× */
}

function zoomLabel() {
  return camUserZoom().toFixed(2) + "×";
}

function updateZoomLabels() {
  const lab = zoomLabel();
  document.querySelectorAll('[data-ctrl="zoom"]').forEach(input => {
    const val = input.closest("div")?.querySelector(".val");
    if (val) val.textContent = lab;
  });
  const cz = $("creatorZoomVal");
  if (cz) cz.textContent = lab;
  const zb = $("zoomBadge");
  if (zb) zb.textContent = lab;
}

function setCtrlZoom(v) {
  ctrl.zoom = Math.max(0, Math.min(1, v));
  document.querySelectorAll('[data-ctrl="zoom"]').forEach(input => {
    input.value = Math.round(ctrl.zoom * 100);
  });
  const cz = $("creatorZoom");
  if (cz) cz.value = Math.round(ctrl.zoom * 100);
  updateZoomLabels();
}

function nudgeZoom(d) {
  setCtrlZoom((ctrl.zoom != null ? ctrl.zoom : 0.5) + d);
}

function initLiveCamera() {
  if (ctrl.zoom == null) ctrl.zoom = 0.5;
  updateZoomLabels();

  document.querySelectorAll('[data-ctrl="zoom"]').forEach(input => {
    input.addEventListener("input", () => updateZoomLabels());
  });

  $("creatorZoom")?.addEventListener("input", e => {
    setCtrlZoom(e.target.value / 100);
  });

  const area = $("stage") || $("canvas");
  if (area) {
    area.addEventListener("wheel", e => {
      nudgeZoom(e.deltaY > 0 ? -0.035 : 0.035);
      e.preventDefault();
    }, { passive: false });

    let pinchDist0 = 0, pinchZoom0 = 0.5;
    const pinchDist = ts => {
      const dx = ts[0].clientX - ts[1].clientX, dy = ts[0].clientY - ts[1].clientY;
      return Math.hypot(dx, dy);
    };
    area.addEventListener("touchstart", e => {
      if (e.touches.length === 2) {
        pinchDist0 = pinchDist(e.touches);
        pinchZoom0 = ctrl.zoom != null ? ctrl.zoom : 0.5;
        e.preventDefault();
      }
    }, { passive: false });
    area.addEventListener("touchmove", e => {
      if (e.touches.length === 2 && pinchDist0 > 0) {
        const ratio = pinchDist(e.touches) / pinchDist0;
        setCtrlZoom(pinchZoom0 + (ratio - 1) * 0.55);
        e.preventDefault();
      }
    }, { passive: false });
    area.addEventListener("touchend", e => {
      if (e.touches.length < 2) { pinchDist0 = 0; }
    });
  }

  document.addEventListener("keydown", e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "+" || e.key === "=") { nudgeZoom(0.05); e.preventDefault(); }
    if (e.key === "-" || e.key === "_") { nudgeZoom(-0.05); e.preventDefault(); }
    if (e.key === "0") { setCtrlZoom(0.5); e.preventDefault(); }
  });
}
