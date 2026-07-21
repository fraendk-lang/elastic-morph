/* ============================================================
   v88 — Audio load fix: gesture-safe play, file input reset, errors
   ============================================================ */

function resumeAudioCtx() {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    return audioCtx.resume().catch(() => { });
  }
  return Promise.resolve();
}

function startFilePlayback() {
  if (!audioEl.src || S.micMode) return;
  resumeAudioCtx().then(() => {
    const p = audioEl.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        S.playing = true;
        if ($("playBtn")) $("playBtn").textContent = "❚❚";
      }).catch(() => {
        S.playing = false;
        if ($("playBtn")) $("playBtn").textContent = "▶";
        showAppToast("▶ Play antippen — Browser blockiert Autostart.", 4500);
      });
    } else {
      S.playing = true;
      if ($("playBtn")) $("playBtn").textContent = "❚❚";
    }
  });
}

function patchAudioLoadFix() {
  const _play = play;
  play = function () {
    if (!audioEl.src) return;
    if (S.micMode) return _play();
    startFilePlayback();
  };

  const _loadFile = loadFile;
  loadFile = function (file) {
    if (!file) return;
    try {
      _loadFile(file);
      const kick = () => startFilePlayback();
      if (audioEl.readyState >= 2) kick();
      else audioEl.addEventListener("loadeddata", kick, { once: true });
    } catch (err) {
      console.error("loadFile failed:", err);
      showAppToast("Track konnte nicht geladen werden — bitte erneut versuchen.", 5500);
    }
  };

  const fi = $("fileInput");
  if (fi && !fi.dataset.v88) {
    fi.dataset.v88 = "1";
    fi.addEventListener("change", () => {
      setTimeout(() => { fi.value = ""; }, 0);
    });
  }

  const _loadDemoTrack = loadDemoTrack;
  loadDemoTrack = async function (opts) {
    await resumeAudioCtx();
    return _loadDemoTrack(opts);
  };
}

function initAudioLoadFix() {
  patchAudioLoadFix();
}
