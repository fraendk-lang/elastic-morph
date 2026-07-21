/* ============================================================
   v95 — Demo fast start: stream audio URL, analyze in background
   Fixes ~16s wait from downloading full 49MB WAV before play.
   ============================================================ */

async function demoUrlReachable(url) {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "force-cache" });
    if (head.ok) return true;
  } catch (e) { /* fall through */ }
  try {
    const probe = await fetch(url, { headers: { Range: "bytes=0-4095" }, cache: "force-cache" });
    return probe.ok || probe.status === 206;
  } catch (e) {
    return false;
  }
}

function resetDemoTrackState() {
  if (S.micMode && typeof toggleMic === "function") toggleMic();
  initAudio();
  if (audioEl.src && audioEl.src.startsWith("blob:")) URL.revokeObjectURL(audioEl.src);
  S.snapshots = [];
  S.lastSnapTime = -10;
  S.memoryBlend = null;
  S.manualMemory = null;
  S.time = 0;
  S.growth = 0.15;
  S.songMap = null;
  S.bpm = 0;
  S.fpHue = 0;
  S.energyCurve = null;
  S.audioBuffer = null;
  S.analyzeState = "analyzing";
  S.analyzeError = null;
  if (typeof syncExportGates === "function") syncExportGates();
  S.loopAB = { a: null, b: null, on: false };
  if ($("abBtn")) { $("abBtn").textContent = "A–B"; updateLoopRegion(); }
  renderMemDots();
  renderSongMap();
}

function kickDemoPlayback() {
  if (typeof startFilePlayback === "function") startFilePlayback();
  else if (typeof play === "function") play();
}

function setDemoLoading(on) {
  S.demoLoadingAudio = !!on;
  const label = $("trackName");
  const banner = $("demoBannerLabel");
  if (on) {
    if (label) {
      label.textContent = "Song lädt…";
      label.classList.add("analyzing");
    }
    if (banner && demoTrackMeta.source === "bundled") {
      banner.textContent = `«${demoTrackMeta.title}» · Song lädt …`;
    }
  } else {
    S.demoLoadingAudio = false;
    if (typeof updateDemoBannerLabel === "function") updateDemoBannerLabel();
  }
  if (typeof updateDemoBanner === "function") updateDemoBanner();
}

function patchDemoLoadingBanner() {
  const _updateDemoBanner = updateDemoBanner;
  updateDemoBanner = function () {
    const el = $("demoBanner");
    if (el && S.demoLoadingAudio) {
      el.classList.add("show");
      return;
    }
    _updateDemoBanner();
  };
}

function loadDemoStream(url, name) {
  resetDemoTrackState();
  setDemoLoading(true);
  audioEl.preload = "auto";
  audioEl.src = url;
  $("dropHint").style.display = "none";
  $("phaseBadge").style.display = "block";
  $("presetBadge").style.display = "block";
  updateBadge();
  if (typeof updateCreatorDock === "function") updateCreatorDock();

  loadDemoTrack._loading = true;
  updateDemoBanner();

  if (S.useLaunchDefaultLook !== false && typeof applyDemoShowcaseLook === "function") {
    applyDemoShowcaseLook();
  }

  const start = () => {
    setDemoLoading(false);
    kickDemoPlayback();
  };
  if (audioEl.readyState >= 2) start();
  else audioEl.addEventListener("canplay", start, { once: true });
  audioEl.addEventListener("error", () => {
    setDemoLoading(false);
    showAppToast("Demo-Song konnte nicht geladen werden — bitte Seite neu laden.", 5500);
  }, { once: true });

  analyzeTrackFromUrl(url, name).finally(() => {
    loadDemoTrack._loading = false;
    S.demoMode = true;
    updateDemoBanner();
    if (typeof updateOnboardingHint === "function") updateOnboardingHint();
  });
}

async function analyzeTrackFromUrl(url, name) {
  const fake = {
    name,
    arrayBuffer: () => fetchDemoBytes(url)
  };
  try {
    await analyzeTrack(fake);
  } catch (e) {
    console.warn("[demo] background analysis failed:", e);
    const label = $("trackName");
    if (label) {
      label.textContent = name;
      label.classList.remove("analyzing");
    }
    S.analyzeState = "error";
  }
}

function patchDemoFastStart() {
  const _loadDemoTrack = loadDemoTrack;
  loadDemoTrack = async function (opts) {
    opts = opts || {};
    initAudio();
    if (!audioCtx) {
      showAppToast("Audio konnte nicht gestartet werden — Seite neu laden.");
      return;
    }
    if (typeof setUiMode === "function") setUiMode("creator");
    $("dropHint").style.display = "none";
    $("phaseBadge").style.display = "block";
    $("presetBadge").style.display = "block";

    S.demoMode = true;
    S.onboardingActive = opts.onboarding !== false;
    S.useLaunchDefaultLook = opts.useDefaultLook !== false;

    const manifest = await loadDemoManifest();
    for (const url of demoManifestPaths(manifest)) {
      if (await demoUrlReachable(url)) {
        const name = decodeURIComponent(url.split("/").pop() || "demo.wav");
        applyDemoMeta(manifest, { file: { name }, url });
        updateDemoBanner();
        loadDemoStream(url, name);
        if (S.onboardingActive) showAppToast(`«${demoTrackMeta.title}» — Song lädt …`, 2800);
        return;
      }
    }
    return _loadDemoTrack(opts);
  };
}

function initDemoFastStart() {
  patchDemoLoadingBanner();
  patchDemoFastStart();
}
