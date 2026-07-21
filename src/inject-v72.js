/* ============================================================
   v72 — Export quality restore: bitrate toast, pro default, no shader dup
   ============================================================ */

function exportQualityDefaults() {
  try {
    S.forceFreeTier = new URLSearchParams(location.search).get("free") === "1"
      || localStorage.getItem("elasticMorph.freeTier") === "1";
  } catch (e) {
    S.forceFreeTier = false;
  }
}

function patchExportQuality() {
  exportQualityDefaults();

  const _isProUnlocked = isProUnlocked;
  isProUnlocked = function () {
    if (S.forceFreeTier) return _isProUnlocked();
    if (S.proUnlocked) return true;
    try { if (localStorage.getItem(PRO_LS) === "1") { S.proUnlocked = true; return true; } } catch (e) { }
    return true;
  };
  syncTierBadge();

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    const draft = $("hqDraft") && $("hqDraft").checked;
    if (!draft && !S.batchExportActive) {
      const Hpx = draft ? 720 : (+($("hqRes")?.value || 1080) || 1080);
      const fps = +($("hqFps")?.value || 30) || 30;
      const [aw, ah] = S.aspect || [16, 9];
      const Wpx = Math.round(Hpx * aw / ah / 2) * 2;
      showAppToast(`HQ Export: ${Wpx}×${Hpx} @ ${fps}fps`, 3200);
    }
    return _exportHQ();
  };
}

function initExportQuality() {
  patchExportQuality();
}
