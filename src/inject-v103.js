/* ============================================================
   v103 — Calm Match: ruhige Tracks → Tape/Vinyl, Ruhe↔Punch
   ============================================================ */

const CALM_LOOK_ENGINES = ["tape", "vinyl", "oscilloscope", "lissajous", "sacred"];
const CALM_LOOK_IDS = ["tape", "vinyl", "liquid", "dust", "sgFlower"];

function trackCalmProfile() {
  if (!S.energyCurve || !S.energyCurve.length) {
    return { calm: 0, isCalm: false, avg: 0.5, peak: 0.5, bpm: S.bpm || 120 };
  }
  const avg = S.energyCurve.reduce((a, b) => a + b, 0) / S.energyCurve.length;
  const peak = Math.max(...S.energyCurve);
  const bpm = S.bpm || 120;
  let calm = 0;
  if (avg < 0.42) calm += 0.35;
  else if (avg < 0.52) calm += 0.2;
  if (bpm < 95) calm += 0.3;
  else if (bpm < 110) calm += 0.15;
  if (peak < 0.55) calm += 0.2;
  else if (peak < 0.68) calm += 0.08;
  calm = Math.min(1, calm);
  return { calm, isCalm: calm >= 0.45, avg, peak, bpm };
}

function calmBeatMul() {
  const lv = S.calmLevel != null ? S.calmLevel : 0.5;
  return 0.22 + lv * 0.78;
}

function syncCalmMixUI() {
  if (typeof syncMixUI === "function") syncMixUI();
  else {
    if ($("mixSmooth")) {
      $("mixSmooth").value = Math.round((S.mix.smooth || 0) * 100);
      $("mixSmoothVal").textContent = Math.round((S.mix.smooth || 0) * 100);
    }
    if ($("mixBeat")) {
      $("mixBeat").value = Math.round((S.mix.beatThresh || 0.04) * 100);
      $("mixBeatVal").textContent = Math.round((S.mix.beatThresh || 0.04) * 100);
    }
    if ($("mixAuto")) $("mixAuto").checked = !!S.mix.autoLevel;
  }
  if ($("gainSel")) {
    $("gainSel").value = Math.round((S.gain || 1) * 100);
    $("gainVal").textContent = (S.gain || 1).toFixed(1) + "×";
  }
}

function syncCalmSliderUI() {
  const sl = $("creatorCalmSlider");
  const val = $("creatorCalmVal");
  if (!sl) return;
  const lv = S.calmLevel != null ? S.calmLevel : 0.5;
  sl.value = Math.round(lv * 100);
  if (val) {
    if (lv < 0.22) val.textContent = "Ruhe";
    else if (lv > 0.78) val.textContent = "Punch";
    else val.textContent = Math.round(lv * 100) + "%";
  }
}

function syncCalmSliderFromProfile() {
  const prof = trackCalmProfile();
  if (!prof.isCalm) return;
  const lv = Math.max(0.05, 0.42 - prof.calm * 0.38);
  S.calmLevel = lv;
  syncCalmSliderUI();
}

function applyCalmMatch(level, opts) {
  level = Math.max(0, Math.min(1, +level));
  S.calmLevel = level;
  const ruhe = 1 - level;

  S.mix.smooth = 0.12 + ruhe * 0.68;
  S.mix.beatThresh = 0.022 + ruhe * 0.058;
  S.mix.autoLevel = level > 0.62;
  S.mix.bass = 0.9 + level * 0.28;
  S.mix.mid = 0.94 + level * 0.16;
  S.mix.high = 0.97 + level * 0.08;
  S.gain = 0.82 + level * 0.28;

  syncCalmMixUI();
  syncCalmSliderUI();

  if (opts && opts.applyLook) {
    const picks = suggestSmartLooks();
    const pick = picks.find(p =>
      CALM_LOOK_ENGINES.includes(p.engine) || CALM_LOOK_IDS.includes(p.id));
    if (pick && typeof applyPreset === "function") applyPreset(pick);
  }
  if (typeof updateCreatorDock === "function") updateCreatorDock();
}

function applyCalmPreset() {
  applyCalmMatch(0.06, { applyLook: true });
  if (typeof showAppToast === "function") {
    showAppToast("Ruhe-Modus — Tape/Vinyl, sanfter Beat", 3600);
  }
}

function injectCalmMatchUI() {
  if (document.getElementById("creatorCalmRow")) return;
  const opts = document.querySelector("#creatorDock .cr-opts");
  if (!opts) return;

  const row = document.createElement("div");
  row.id = "creatorCalmRow";
  row.className = "cr-calm-row";
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;width:100%";
  row.innerHTML =
    '<button type="button" class="btn cr-sm" id="creatorCalmBtn" title="Sanfter Look für ruhige Songs">☁ Ruhig</button>' +
    '<span style="font-size:11px;color:var(--text-dim)">Ruhe</span>' +
    '<input type="range" id="creatorCalmSlider" min="0" max="100" value="50" style="flex:1;min-width:80px;max-width:160px" aria-label="Ruhe bis Punch">' +
    '<span style="font-size:11px;color:var(--text-dim)">Punch</span>' +
    '<span class="val" id="creatorCalmVal" style="font-size:10px;min-width:42px">—</span>';

  opts.insertAdjacentElement("afterend", row);
  $("creatorCalmBtn")?.addEventListener("click", applyCalmPreset);
  $("creatorCalmSlider")?.addEventListener("input", e => applyCalmMatch(+e.target.value / 100));
  syncCalmSliderUI();
}

function patchCalmScoring() {
  const _score = scorePresetForTrack;
  scorePresetForTrack = function (p) {
    let s = _score(p);
    const prof = trackCalmProfile();
    if (!prof.isCalm) return s;
    const eng = p.engine || "blob";
    const id = p.id || "";
    if (eng === "tape" || eng === "vinyl") s += 4 + prof.calm * 2.5;
    if (eng === "oscilloscope" || eng === "lissajous") s += 2.5 + prof.calm;
    if (eng === "sacred") s += 2 + prof.calm * 0.6;
    if (id === "liquid" || id === "dust") s += 2.2;
    if (eng === "dance" || id === "danceClub" || id === "danceDisco" || id === "clubStrobe" || id === "hardGroove") {
      s -= 3 + prof.calm * 2.5;
    }
    return s;
  };
}

function patchCalmEngines() {
  const wrapBeat = fn => function (base, hue, growthF, energySize, seed) {
    const bm = calmBeatMul();
    const beatSave = S.beat;
    S.beat = beatSave * bm;
    fn(base, hue, growthF, energySize, seed);
    S.beat = beatSave;
  };
  if (typeof drawTape === "function") drawTape = wrapBeat(drawTape);
  if (typeof drawVinyl === "function") drawVinyl = wrapBeat(drawVinyl);
  if (typeof drawOscilloscope === "function") drawOscilloscope = wrapBeat(drawOscilloscope);
}

function patchCalmFlow() {
  patchCalmScoring();

  const _applyFirstSmartLook = applyFirstSmartLook;
  applyFirstSmartLook = function () {
    _applyFirstSmartLook();
    if (typeof isBundledDemoShowcase === "function" && isBundledDemoShowcase()) return;
    const prof = trackCalmProfile();
    if (prof.isCalm) {
      applyCalmMatch(Math.max(0.05, 0.44 - prof.calm * 0.38), { applyLook: false });
      if (typeof showAppToast === "function") {
        showAppToast("Ruhiger Track erkannt — Tape/Vinyl empfohlen · Ruhe-Slider unten", 4200);
      }
    }
  };

  const _renderSmartLooks = renderSmartLooks;
  renderSmartLooks = function () {
    _renderSmartLooks();
    const prof = trackCalmProfile();
    const host = $("smartLookRow");
    if (!host || !prof.isCalm || !S.energyCurve) return;
    const hint = document.createElement("p");
    hint.className = "note";
    hint.style.marginTop = "6px";
    hint.textContent = "☁ Ruhiger Track — Tape Machine & Vinyl passen besonders gut.";
    host.appendChild(hint);
  };

  const _updateCreatorDock = updateCreatorDock;
  updateCreatorDock = function () {
    _updateCreatorDock();
    const prof = trackCalmProfile();
    const btn = $("creatorCalmBtn");
    if (btn && S.energyCurve) {
      btn.classList.toggle("primary", prof.isCalm && (S.calmLevel == null || S.calmLevel < 0.35));
    }
  };
}

function initCalmMatchV103() {
  if (S.calmLevel == null) S.calmLevel = 0.5;
  patchCalmEngines();
  patchCalmFlow();
  injectCalmMatchUI();
}
