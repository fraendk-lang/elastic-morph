/* ============================================================
   v84 — Launch Phase 1: echter Demo-Track aus assets/demo/
   v84.1 — robust load: inline manifest, XHR fallback, no stale SW 404
   ============================================================ */

const DEMO_MANIFEST_URL = "assets/demo/demo.json";
const DEMO_FALLBACK_FILES = ["Elastic Field - Dust Reel.mp3", "Elastic Field - Dust Reel.wav", "elastic-morph-demo.mp3", "elastic-morph-demo.wav"];
const DEMO_INLINE_MANIFEST = {
  title: "Dust Reel",
  artist: "Elastic Field",
  files: DEMO_FALLBACK_FILES
};

let demoTrackMeta = { source: "synthetic", title: "Synthetischer Demo-Track", artist: "Elastic Morph" };

function demoAssetUrl(filename) {
  const clean = String(filename).replace(/^\/+/, "");
  return "assets/demo/" + clean.split("/").map(encodeURIComponent).join("/");
}

function demoManifestPaths(manifest) {
  const files = (manifest && manifest.files && manifest.files.length)
    ? manifest.files
    : DEMO_FALLBACK_FILES;
  return [...new Set(files.map(f => demoAssetUrl(f)))];
}

async function loadDemoManifest() {
  try {
    const res = await fetch(DEMO_MANIFEST_URL, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (e) { /* file:// — use inline manifest */ }
  return { ...DEMO_INLINE_MANIFEST };
}

function xhrArrayBuffer(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response);
      else reject(new Error("xhr " + xhr.status));
    };
    xhr.onerror = () => reject(new Error("xhr error"));
    xhr.send();
  });
}

async function fetchDemoBytes(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 1024) return ab;
    }
  } catch (e) { /* try XHR (some file:// setups) */ }
  try {
    const ab = await xhrArrayBuffer(url);
    if (ab.byteLength > 1024) return ab;
  } catch (e) { /* fall through */ }
  return null;
}

async function fetchBundledDemoFile(manifest) {
  for (const url of demoManifestPaths(manifest)) {
    const ab = await fetchDemoBytes(url);
    if (!ab) continue;
    const name = decodeURIComponent(url.split("/").pop() || "demo.wav");
    const type = name.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
    return { file: new File([ab], name, { type }), url };
  }
  return null;
}

function demoMetaValid(manifest) {
  const title = (manifest && manifest.title) ? String(manifest.title).trim() : "";
  const artist = (manifest && manifest.artist) ? String(manifest.artist).trim() : "";
  return title.length > 1 && !/DEIN TRACK-TITEL|DEIN KÜNSTLER/i.test(title + artist);
}

function applyDemoMeta(manifest, bundled) {
  const title = (manifest && manifest.title) ? String(manifest.title).trim() : "";
  const artist = (manifest && manifest.artist) ? String(manifest.artist).trim() : "";
  if (bundled && demoMetaValid(manifest)) {
    demoTrackMeta = { source: "bundled", title, artist: artist || "Demo" };
  } else if (bundled) {
    demoTrackMeta = {
      source: "bundled",
      title: bundled.file.name.replace(/\.[^.]+$/, ""),
      artist: artist || "Elastic Field"
    };
  } else {
    demoTrackMeta = { source: "synthetic", title: "Synthetischer Demo-Track", artist: "Elastic Morph" };
  }
  updateDemoBannerLabel();
}

function updateDemoBannerLabel() {
  const label = $("demoBannerLabel");
  if (!label) return;
  if (demoTrackMeta.source === "bundled") {
    label.textContent = `«${demoTrackMeta.title}» · ${demoTrackMeta.artist}`;
  } else {
    label.textContent = "synthetisches Audio — Demo-Datei nicht geladen";
  }
}

function patchRealDemoTrack() {
  const _updateDemoBanner = updateDemoBanner;
  updateDemoBanner = function () {
    _updateDemoBanner();
    updateDemoBannerLabel();
  };

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
    const bundled = await fetchBundledDemoFile(manifest);
    applyDemoMeta(manifest, bundled);

    let file;
    if (bundled) {
      file = bundled.file;
    } else {
      const buf = generateDemoTrackBuffer(audioCtx);
      const blob = audioBufferToWav(buf);
      file = new File([blob], DEMO_TRACK_NAME, { type: "audio/wav" });
      console.warn("[demo] Bundled track not found — using synthetic fallback. Serve via http(s) and hard-refresh if the WAV exists in assets/demo/.");
    }

    updateDemoBanner();
    loadDemoTrack._loading = true;
    try {
      loadFile(file);
    } finally {
      loadDemoTrack._loading = false;
      S.demoMode = true;
      updateDemoBanner();
      updateOnboardingHint();
      const msg = bundled
        ? `Demo: «${demoTrackMeta.title}» — Visual erscheint gleich.`
        : "Demo-Datei nicht gefunden — Fallback aktiv. Bitte über lokalen Server öffnen (npm start) und Hard-Refresh (Cmd+Shift+R).";
      if (S.onboardingActive || !bundled) showAppToast(msg, bundled ? 4000 : 8000);
    }
  };
}

function initRealDemoTrack() {
  patchRealDemoTrack();
  updateDemoBannerLabel();
  if (location.protocol === "file:") {
    setTimeout(() => {
      showAppToast("Demo-Track: bitte über lokalen Server öffnen — im Ordner: npm start, dann http://localhost:3456/elastic-morph.html", 9500);
    }, 1200);
  }
}
