/* ============================================================
   v70 — Phase C: Freemium preparation (no payment yet)
   Free tier: 1080p cap + export watermark · Pro unlock via localStorage / ?pro=1
   ============================================================ */

const PRO_LS = "elasticMorph.pro";
const FREE_MAX_H = 1080;

function isProUnlocked() {
  if (S.proUnlocked) return true;
  try {
    if (localStorage.getItem(PRO_LS) === "1") { S.proUnlocked = true; return true; }
  } catch (e) { }
  try {
    if (new URLSearchParams(location.search).get("pro") === "1") {
      S.proUnlocked = true;
      try { localStorage.setItem(PRO_LS, "1"); } catch (x) { }
      return true;
    }
  } catch (e) { }
  return false;
}

function drawFreeTierWatermark(W, H) {
  if (isProUnlocked()) return;
  if (!S.exporting && !S.freePreviewWatermark) return;
  const fs = Math.max(14, Math.round(Math.min(W, H) * 0.028));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = S.exporting ? 0.38 : 0.22;
  ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 6;
  ctx.fillText("Elastic Morph", W - W * 0.035, H - H * 0.03);
  ctx.restore();
}

function capFreeExportHeight(hpx) {
  if (isProUnlocked()) return hpx;
  return Math.min(hpx, FREE_MAX_H);
}

function syncTierBadge() {
  const el = $("tierBadge");
  if (!el) return;
  const pro = isProUnlocked();
  el.textContent = pro ? "Pro" : "Free · 1080p";
  el.classList.toggle("pro", pro);
  el.title = pro
    ? "Pro aktiv — 4K Export ohne Wasserzeichen"
    : "Free: max. 1080p + Wasserzeichen im Export. ?pro=1 zum Testen.";
}

function patchFreemium() {
  isProUnlocked();
  syncTierBadge();

  const _drawScene = drawScene;
  drawScene = function (dt) {
    _drawScene(dt);
    drawFreeTierWatermark(canvas.width, canvas.height);
  };

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    const resSel = $("hqRes");
    let saved = null;
    if (!isProUnlocked() && resSel) {
      saved = resSel.value;
      if (+saved > FREE_MAX_H) resSel.value = String(FREE_MAX_H);
    }
    try {
      return await _exportHQ();
    } finally {
      if (saved != null && resSel) resSel.value = saved;
    }
  };

  const hqRes = $("hqRes");
  if (hqRes && !isProUnlocked()) {
    Array.from(hqRes.options).forEach(o => {
      if (+o.value > FREE_MAX_H) o.disabled = true;
    });
  }

  $("tierUnlockBtn")?.addEventListener("click", () => {
    try { localStorage.setItem(PRO_LS, "1"); } catch (e) { }
    S.proUnlocked = true;
    syncTierBadge();
    if (hqRes) Array.from(hqRes.options).forEach(o => { o.disabled = false; });
    showAppToast("Pro freigeschaltet (Demo) — 4K + kein Wasserzeichen.", 4500);
  });

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    syncTierBadge();
  };
}

function initFreemium() {
  S.proUnlocked = false;
  S.freePreviewWatermark = false;
  patchFreemium();
}
