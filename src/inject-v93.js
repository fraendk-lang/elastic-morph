/* ============================================================
   v93 — Demo showcase look (Dust Reel / bundled demo)
   Punchy club visual instead of calm Liquid Memory default.
   ============================================================ */

const DEMO_SHOWCASE = {
  presetId: "clubStrobe",
  ctrl: {
    pulse: 0.82, morph: 0.62, density: 0.72, memory: 0.28,
    colorDrift: 0.48, camDrift: 0.42, zoom: 0.52, mutation: 0.38,
    gravity: 0.32, organic: 0.5
  },
  shader: { on: true, style: "laser", intensity: 0.84, opacity: 0.58, blend: "lighter" },
  fx: ["strobe", "shake"],
  mix: { bass: 1.18, mid: 1.1, high: 1.05, autoLevel: true, beatThresh: 0.028 }
};

function isBundledDemoShowcase() {
  return !!(S.demoMode && demoTrackMeta && demoTrackMeta.source === "bundled" && S.useLaunchDefaultLook !== false);
}

function syncShaderUI() {
  if (!$("shOn")) return;
  $("shOn").checked = !!S.shader.on;
  $("shStyle").value = S.shader.style;
  $("shBlend").value = S.shader.blend;
  const i = Math.round(S.shader.intensity * 100);
  const o = Math.round(S.shader.opacity * 100);
  $("shInt").value = i; $("shIntVal").textContent = i;
  $("shOp").value = o; $("shOpVal").textContent = o;
  if (S.shader.on && typeof initGL === "function") initGL();
}

function syncMixUI() {
  if (!$("mixBass")) return;
  $("mixBass").value = Math.round(S.mix.bass * 100);
  $("mixBassVal").textContent = Math.round(S.mix.bass * 100);
  $("mixMid").value = Math.round(S.mix.mid * 100);
  $("mixMidVal").textContent = Math.round(S.mix.mid * 100);
  $("mixHigh").value = Math.round(S.mix.high * 100);
  $("mixHighVal").textContent = Math.round(S.mix.high * 100);
  $("mixBeat").value = Math.round(S.mix.beatThresh * 100);
  $("mixBeatVal").textContent = Math.round(S.mix.beatThresh * 100);
  if ($("mixAuto")) $("mixAuto").checked = !!S.mix.autoLevel;
}

function enableFxKeys(keys) {
  keys.forEach(k => {
    if (S.fx[k]) return;
    if (typeof toggleFX === "function") toggleFX(k);
    else S.fx[k] = true;
  });
  if (typeof syncFXUI === "function") syncFXUI();
}

function applyDemoShowcaseLook() {
  const p = PRESETS.find(x => x.id === DEMO_SHOWCASE.presetId) || PRESETS.find(x => x.id === "hardGroove");
  if (!p) return;
  applyPreset(p);
  Object.assign(ctrl, DEMO_SHOWCASE.ctrl);
  if (typeof syncSliderUI === "function") syncSliderUI();

  Object.assign(S.shader, DEMO_SHOWCASE.shader);
  syncShaderUI();

  Object.assign(S.mix, { ...S.mix, ...DEMO_SHOWCASE.mix });
  syncMixUI();

  enableFxKeys(DEMO_SHOWCASE.fx);
  spawnParticles();
  updateCreatorDock();
  if (typeof showAppToast === "function") {
    showAppToast("Showcase-Look — Club Strobe + Laser, optimiert für Dust Reel.", 4200);
  }
}

function patchDemoShowcase() {
  const _applyLaunchDefaultLook = applyLaunchDefaultLook;
  applyLaunchDefaultLook = function () {
    if (isBundledDemoShowcase()) {
      applyDemoShowcaseLook();
      return;
    }
    _applyLaunchDefaultLook();
  };

  const _applyFirstSmartLook = applyFirstSmartLook;
  applyFirstSmartLook = function () {
    if (isBundledDemoShowcase()) {
      applyDemoShowcaseLook();
      return;
    }
    _applyFirstSmartLook();
  };

  const _updateOnboardingHint = updateOnboardingHint;
  updateOnboardingHint = function () {
    _updateOnboardingHint();
    const el = $("onboardingHint");
    if (!el || !S.onboardingActive || !isBundledDemoShowcase()) return;
    const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
    const hasLook = !!S.preset;
    if (hasTrack && (!hasLook || S.analyzeState === "analyzing")) {
      el.textContent = "Schritt 2 — Look aktiv: Club Strobe (Showcase für Dust Reel)";
    }
  };
}

function initDemoShowcase() {
  patchDemoShowcase();
}
