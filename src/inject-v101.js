/* ============================================================
   v101 — Fix DNA toggle double-fire + cover-only image visibility
   ============================================================ */

function imageLayerActive(IM) {
  return !!(IM && IM.on && IM.img);
}

function drawImageLayersFront(W, H, hue, dt) {
  const mix = imgMix();
  drawImageLayer(S.image, W, H, hue, dt, mix.a);
  drawImageLayer(S.image2, W, H, hue, dt, mix.b);
}

function patchApplyImagePresetHint() {
  const _apply = applyImagePreset;
  applyImagePreset = function (id) {
    const p = IMAGE_PRESETS.find(x => x.id === id);
    if (p && !imageLayerActive(S.image) && !S.image.img) {
      if (typeof showAppToast === "function") showAppToast("Zuerst Bild A hochladen", 2400);
      return;
    }
    _apply(id);
  };
  const _applyB = applyImagePresetB;
  applyImagePresetB = function (id) {
    if (!S.image2.img) {
      if (typeof showAppToast === "function") showAppToast("Zuerst Bild B hochladen", 2400);
      return;
    }
    _applyB(id);
  };
}

function initDnaCoverFixV101() {
  patchApplyImagePresetHint();
}
