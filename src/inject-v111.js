/* ============================================================
   v111 — Background Video: Creative Filter (Phase A)
   Same 7 filters as Image Layer A/B (coverFilterCSS pipeline)
   ============================================================ */

const BG_VID_FILTERS = [
  ["none", "Kein Filter"],
  ["cinematic", "Cinematic"],
  ["bw", "Schwarzweiß"],
  ["duotone", "Duotone (DNA)"],
  ["vintage", "Vintage"],
  ["dreamy", "Dreamy"],
  ["neon", "Neon Glow"]
];

function bgVidFilterCSS(v) {
  const f = v.filter || "none";
  if (f === "none") return "none";
  const hue = S.palette.on ? S.palette.hue : ((typeof currentDNA === "function" ? currentDNA().hue : null) || 280);
  return typeof coverFilterCSS === "function" ? coverFilterCSS(f, hue) : "none";
}

function ensureBgVidFilterUIV111() {
  if ($("bgVidFilter")) return;
  const blend = $("bgVidBlend");
  if (!blend) return;
  const sel = document.createElement("select");
  sel.id = "bgVidFilter";
  sel.className = "pm-select";
  sel.style.marginTop = "6px";
  BG_VID_FILTERS.forEach(([id, label]) => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = "Filter: " + label;
    if (id === (S.bgVid.filter || "none")) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", e => { S.bgVid.filter = e.target.value; });
  blend.insertAdjacentElement("afterend", sel);
}

function ensureBgVidSoftLightV111() {
  const blend = $("bgVidBlend");
  if (!blend || blend.querySelector('option[value="soft-light"]')) return;
  const o = document.createElement("option");
  o.value = "soft-light";
  o.textContent = "Soft Light";
  blend.appendChild(o);
}

function initBgVidFiltersV111() {
  if (S.bgVid.filter == null) S.bgVid.filter = "none";
  ensureBgVidSoftLightV111();
  ensureBgVidFilterUIV111();

  const sel = $("bgVidFilter");
  if (sel) sel.value = S.bgVid.filter || "none";

  const _drawBgVideo = drawBgVideo;
  drawBgVideo = function (W, H) {
    const filt = bgVidFilterCSS(S.bgVid);
    if (filt === "none") {
      _drawBgVideo(W, H);
      return;
    }
    ctx.save();
    ctx.filter = filt;
    _drawBgVideo(W, H);
    ctx.filter = "none";
    ctx.restore();
  };
}
