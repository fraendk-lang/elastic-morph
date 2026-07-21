/* ============================================================
   v69 — Phase A: Launch-ready onboarding
   Demo track · default look · export success · guided 3-step flow
   ============================================================ */

const DEMO_TRACK_NAME = "Elastic-Morph-Demo.wav";
const LAUNCH_DEFAULT_PRESET_ID = "liquid";
const ONBOARDING_LS = "elasticMorph.onboardingDone";
const EXPORT_DONE_LS = "elasticMorph.exportCelebrated";

function generateDemoTrackBuffer(ctx, durationSec, bpm) {
  durationSec = durationSec || 48;
  bpm = bpm || 120;
  const sr = ctx.sampleRate;
  const len = Math.floor(durationSec * sr);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const beatSec = 60 / bpm;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const beatIdx = Math.floor(t / beatSec);
    const bt = t - beatIdx * beatSec;
    const section = Math.floor(t / 12) % 4;
    const energy = section === 2 ? 1 : (section === 3 ? 0.92 : (section === 1 ? 0.65 : 0.48));
    const drop = t > 36 ? 1.25 : 1;
    let s = 0;

    if (bt < 0.045) {
      const k = bt / 0.045;
      s += Math.sin(k * Math.PI) * (1 - k * 0.6) * 0.82;
    }
    if (bt > beatSec * 0.48 && bt < beatSec * 0.48 + 0.018) {
      s += (Math.random() * 2 - 1) * 0.14 * energy;
    }

    const bassFreq = 55 + (beatIdx % 8) * 3.5;
    s += Math.sin(2 * Math.PI * bassFreq * t) * 0.22 * energy * drop;
    s += Math.sin(2 * Math.PI * (bassFreq * 2) * t + 0.4) * 0.08 * energy;

    s += Math.sin(2 * Math.PI * 220 * t) * 0.07 * energy;
    s += Math.sin(2 * Math.PI * 330 * t + 1.1) * 0.05 * energy;
    s += Math.sin(2 * Math.PI * 440 * t + 2.3) * 0.04 * energy * drop;

    if (section === 2 && bt < 0.02) s += Math.sin(bt * 600) * 0.18;

    const pan = Math.sin(t * 0.7 + beatIdx * 0.2) * 0.08;
    const mono = Math.max(-1, Math.min(1, s));
    L[i] = Math.max(-1, Math.min(1, mono * (1 - pan)));
    R[i] = Math.max(-1, Math.min(1, mono * (1 + pan)));
  }
  return buf;
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bps = 16;
  const blockAlign = numCh * (bps / 8);
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true); v.setUint16(34, bps, true);
  w(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function applyLaunchDefaultLook() {
  const p = PRESETS.find(x => x.id === LAUNCH_DEFAULT_PRESET_ID) || PRESETS[0];
  applyPreset(p);
}

function updateOnboardingHint() {
  const el = $("onboardingHint");
  if (!el || !S.onboardingActive) return;
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  const hasLook = !!S.preset;
  let msg = "";
  if (!hasTrack) msg = "Schritt 1 — Demo läuft oder eigenen Track laden";
  else if (!hasLook || S.analyzeState === "analyzing") msg = "Schritt 2 — Look wählen (empfohlen: Liquid Memory)";
  else msg = "Schritt 3 — HQ Export starten · fertiges MP4 in Minuten";
  el.textContent = msg;
  el.classList.add("show");
}

function finishOnboarding() {
  S.onboardingActive = false;
  S.useLaunchDefaultLook = false;
  try { localStorage.setItem(ONBOARDING_LS, "1"); } catch (e) { }
  $("onboardingHint")?.classList.remove("show");
}

async function loadDemoTrack(opts) {
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
  updateDemoBanner();

  const buf = generateDemoTrackBuffer(audioCtx);
  const blob = audioBufferToWav(buf);
  const file = new File([blob], DEMO_TRACK_NAME, { type: "audio/wav" });

  loadDemoTrack._loading = true;
  try {
    loadFile(file);
  } finally {
    loadDemoTrack._loading = false;
    S.demoMode = true;
    updateDemoBanner();
    updateOnboardingHint();
    if (S.onboardingActive) showAppToast("Demo-Track lädt — Visual erscheint gleich.", 4000);
  }
}

function showExportSuccess(kind) {
  kind = kind || "hq";
  const ov = $("exportSuccessOverlay");
  if (!ov) return;
  const sub = $("exportSuccessSub");
  if (sub) {
    sub.textContent = kind === "realtime"
      ? "Dein Clip wurde aufgenommen. Für frame-genaues MP4: Chrome/Edge + HQ Export."
      : "Dein MP4 wurde heruntergeladen — bereit für YouTube, Reels oder Spotify Canvas.";
  }
  ov.style.display = "flex";
  ov.setAttribute("aria-hidden", "false");
  if (typeof wireModalA11y === "function") wireModalA11y(ov, true);
  if (S.onboardingActive) finishOnboarding();
  try { localStorage.setItem(EXPORT_DONE_LS, "1"); } catch (e) { }
}

function onExportComplete(kind) {
  if (S.batchExportActive) return;
  if (kind === "realtime") {
    showAppToast("Echtzeit-Clip gespeichert — für ~500MB Qualität: HQ Export (Chrome, 4K).", 6500);
  }
  showExportSuccess(kind || "hq");
}

function closeExportSuccess() {
  const ov = $("exportSuccessOverlay");
  if (!ov) return;
  ov.style.display = "none";
  ov.setAttribute("aria-hidden", "true");
  if (typeof wireModalA11y === "function") wireModalA11y(ov, false);
}

function patchLaunchOnboarding() {
  const _applyFirstSmartLook = applyFirstSmartLook;
  applyFirstSmartLook = function () {
    if (S.autoLook === false) return;
    if (S.useLaunchDefaultLook) {
      applyLaunchDefaultLook();
      updateOnboardingHint();
      return;
    }
    _applyFirstSmartLook();
    updateOnboardingHint();
  };

  const _applyPreset = applyPreset;
  applyPreset = function (p) {
    _applyPreset(p);
    if (S.onboardingActive && S.preset) {
      showAppToast("Look gewählt — jetzt exportieren (③).", 3500);
      updateOnboardingHint();
    }
  };

  const _loadFile = loadFile;
  loadFile = function (file) {
    if (!loadDemoTrack._loading) S.demoMode = false;
    const r = _loadFile(file);
    if (loadDemoTrack._loading) {
      S.demoMode = true;
      updateDemoBanner();
    }
    updateOnboardingHint();
    return r;
  };

  const hero = $("heroDemoBtn");
  if (hero && !hero.dataset.v69) {
    hero.dataset.v69 = "1";
    hero.replaceWith(hero.cloneNode(true));
    $("heroDemoBtn")?.addEventListener("click", () => loadDemoTrack({ onboarding: false }));
  }

  const wel = $("welDemo");
  if (wel && !wel.dataset.v69) {
    wel.dataset.v69 = "1";
    const neo = wel.cloneNode(true);
    wel.replaceWith(neo);
    neo.addEventListener("click", () => {
      closeWelcome();
      loadDemoTrack({ onboarding: true });
    });
  }

  $("demoLoadBtn")?.addEventListener("click", () => {
    S.onboardingActive = false;
    updateOnboardingHint();
    $("fileInput")?.click();
  });

  $("exportSuccessClose")?.addEventListener("click", closeExportSuccess);
  $("exportSuccessAgain")?.addEventListener("click", closeExportSuccess);
  $("exportSuccessPro")?.addEventListener("click", () => {
    closeExportSuccess();
    if (typeof setUiMode === "function") setUiMode("pro");
    showAppToast("Pro-Modus — alle Regler, Set Editor, FX Racks.");
  });
  $("exportSuccessOverlay")?.addEventListener("click", e => {
    if (e.target.id === "exportSuccessOverlay") closeExportSuccess();
  });

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    updateOnboardingHint();
  };

  try {
    if (localStorage.getItem(ONBOARDING_LS)) S.onboardingActive = false;
  } catch (e) { }
}

function initLaunchOnboarding() {
  patchLaunchOnboarding();
}
