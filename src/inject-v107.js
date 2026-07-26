/* ============================================================
   v107 — Social pipeline + Showcase Reel preset
   Morph export → Post-Ready (9:16 · 60s) · Launch showcase helper
   ============================================================ */

const POST_READY_BASE = "https://elasticuniverse.app/tools/post-ready";
const SHOWCASE_REEL_SEC = 60;

function postReadyShortUrl(opts) {
  opts = opts || {};
  const p = new URLSearchParams();
  p.set("ratio", opts.ratio || "9:16");
  p.set("mode", opts.mode || "clip");
  p.set("duration", String(opts.duration || SHOWCASE_REEL_SEC));
  p.set("source", "morph");
  return `${POST_READY_BASE}?${p.toString()}`;
}

function syncExportRangeUI() {
  const rs = $("rangeStart"), re = $("rangeEnd"), ro = $("rangeOn");
  if (rs && S.exportRange) rs.value = S.exportRange.start.toFixed(1);
  if (re && S.exportRange) re.value = S.exportRange.end.toFixed(1);
  if (ro) ro.checked = !!(S.exportRange && S.exportRange.on);
}

function applyShowcaseReelPreset() {
  if (!S.audioBuffer && !S.micMode && !audioEl.src) {
    showAppToast("Showcase Reel — zuerst Demo oder Track laden.", 3200);
    return;
  }

  if (typeof setCreatorFormat === "function") setCreatorFormat(9, 16);
  else {
    S.aspect = [9, 16];
    if (typeof resize === "function") resize();
  }

  const dur = typeof setDuration === "function" ? setDuration() : (S.audioBuffer?.duration || 48);
  const clipLen = Math.min(SHOWCASE_REEL_SEC, Math.max(8, dur));
  let start = 0;
  if (typeof findBestLoopPoint === "function" && dur > clipLen) {
    const hook = findBestLoopPoint(dur, Math.min(clipLen, 16));
    start = Math.max(0, Math.min(hook, dur - clipLen));
  }
  S.exportRange = {
    on: true,
    start: start,
    end: Math.min(dur, start + clipLen)
  };
  syncExportRangeUI();

  if (S.demoMode && typeof applyDemoShowcaseLook === "function") applyDemoShowcaseLook();
  else if (typeof applyLaunchDefaultLook === "function") applyLaunchDefaultLook();

  if (typeof updateCreatorDock === "function") updateCreatorDock();
  showAppToast(`Showcase Reel — 9:16 · ${Math.round(S.exportRange.end - S.exportRange.start)}s · HQ Export starten`, 4500);
}

function injectExportSuccessPostReady() {
  const actions = document.querySelector("#exportSuccessCard .es-actions");
  if (!actions || document.getElementById("exportSuccessPostReady")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn primary";
  btn.id = "exportSuccessPostReady";
  btn.textContent = "In Post-Ready optimieren";
  btn.title = "9:16 · 60s Short — Datei dort hochladen und konvertieren";
  btn.addEventListener("click", () => {
    window.open(postReadyShortUrl(), "_blank", "noopener,noreferrer");
    closeExportSuccess();
    showAppToast("Post-Ready geöffnet — exportiertes MP4 dort hochladen.", 5000);
  });
  actions.insertBefore(btn, actions.firstChild);
}

function injectShowcaseReelUI() {
  if (document.getElementById("showcaseReelBtn")) return;

  const dockActs = document.querySelector("#creatorDock .cr-actions");
  if (dockActs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn cr-sm";
    b.id = "showcaseReelBtn";
    b.style.fontSize = "10px";
    b.textContent = "Showcase · 60s Reel";
    b.title = "9:16 · 60 Sekunden · Look + Export-Bereich";
    b.addEventListener("click", applyShowcaseReelPreset);
    dockActs.insertAdjacentElement("afterbegin", b);
  }
}

function patchExportSuccessForPipeline() {
  const _showExportSuccess = showExportSuccess;
  showExportSuccess = function (kind) {
    _showExportSuccess(kind);
    const sub = $("exportSuccessSub");
    if (sub && kind !== "realtime") {
      sub.textContent = "MP4 heruntergeladen — optional in Post-Ready für Short/Reel trimmen & normalisieren.";
    }
  };
}

function initSocialPipelineV107() {
  injectExportSuccessPostReady();
  injectShowcaseReelUI();
  patchExportSuccessForPipeline();
}
