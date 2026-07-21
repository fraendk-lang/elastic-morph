/* ============================================================
   v68 — Image Layer: Blend-Modi + Beat-Sync Trigger
   ============================================================ */

const IMG_BLEND_MODES = [
  ["source-over", "Normal"],
  ["screen", "Screen"],
  ["lighter", "Add"],
  ["overlay", "Overlay"],
  ["multiply", "Multiply"],
  ["soft-light", "Soft Light"]
];

function imageBeatGate(IM, dt) {
  if (!IM.beatSync) return 1;
  if (IM._beatGate == null) IM._beatGate = 0;
  const hit = S.beat > 0.45 || S.transient > 0.38 || S.dropFlash > 0.2;
  if (hit) IM._beatGate = 1;
  else IM._beatGate = Math.max(0, IM._beatGate - dt * 4.5);
  return IM._beatGate;
}

function drawImageLayerStatic(IM, W, H, baseHue, opMul) {
  if (!IM.on || !IM.img) return;
  ctx.save();
  ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul);
  if (ctx.globalAlpha < 0.01) { ctx.restore(); return; }
  if (IM.kenburns) {
    const p = S.progress;
    ctx.translate(W / 2, H / 2);
    ctx.scale(1.06 + 0.16 * p, 1.06 + 0.16 * p);
    ctx.translate(-W / 2 + Math.sin(p * Math.PI + IM.kbPhase) * W * 0.05,
      -H / 2 + Math.cos(p * Math.PI * 0.8 + IM.kbPhase) * H * 0.045);
  }
  const { dW, dH, oX, oY } = coverRect(W, H, IM);
  const filt = typeof imageLayerFilterCSS === "function" ? imageLayerFilterCSS(IM, baseHue) : "none";
  if (filt !== "none") ctx.filter = filt;
  ctx.drawImage(IM.img, oX, oY, dW, dH);
  ctx.filter = "none";
  ctx.restore();
}

function appendImageBlendSelect(p, IM) {
  if ($(p + "Blend")) return;
  const sel = document.createElement("select");
  sel.id = p + "Blend";
  sel.className = "pm-select";
  sel.style.marginTop = "6px";
  IMG_BLEND_MODES.forEach(([id, label]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = "Blend: " + label;
    if (id === (IM.blend || "source-over")) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", e => { IM.blend = e.target.value; });
  const anchor = $(p + "Filter") || $(p + "Mode");
  anchor?.insertAdjacentElement("afterend", sel);
}

function appendImageBeatSync(p, IM) {
  if ($(p + "BeatSync")) return;
  const lab = document.createElement("label");
  lab.className = "check";
  lab.style.marginTop = "8px";
  lab.style.display = "block";
  lab.innerHTML = `<input type="checkbox" id="${p}BeatSync"> Beat-Sync (nur auf Drop/Transient)`;
  lab.querySelector("input").checked = !!IM.beatSync;
  lab.querySelector("input").addEventListener("change", e => { IM.beatSync = e.target.checked; IM._beatGate = 0; });
  const anchor = $(p + "Blend") || $(p + "Filter") || $(p + "Mode");
  anchor?.insertAdjacentElement("afterend", lab);
}

function initImageLayerV68() {
  if (S.image.blend == null) S.image.blend = "source-over";
  if (S.image2.blend == null) S.image2.blend = "source-over";
  if (S.image.beatSync == null) S.image.beatSync = false;
  if (S.image2.beatSync == null) S.image2.beatSync = false;

  const _draw = drawImageLayer;
  drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
    const blend = IM.blend || "source-over";
    const gate = imageBeatGate(IM, dt);
    ctx.save();
    ctx.globalCompositeOperation = blend;
    if (IM.beatSync && gate < 0.12) {
      drawImageLayerStatic(IM, W, H, baseHue, opMul);
    } else {
      const saved = IM.amount;
      if (IM.beatSync) IM.amount = saved * Math.max(0.18, gate);
      _draw(IM, W, H, baseHue, dt, opMul);
      IM.amount = saved;
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  };

  const _wire = wireImageLayer;
  wireImageLayer = function (p, IM) {
    _wire(p, IM);
    appendImageBlendSelect(p, IM);
    appendImageBeatSync(p, IM);
  };

  const _imgData = imgLayerData;
  imgLayerData = function (IM) {
    return {
      ..._imgData(IM),
      blend: IM.blend || "source-over",
      beatSync: !!IM.beatSync
    };
  };
}
