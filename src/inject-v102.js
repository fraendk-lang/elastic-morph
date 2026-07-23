/* ============================================================
   v102 — 1-click Cover Export presets (Canvas / Reel / YouTube)
   ============================================================ */

const COVER_EXPORT_PRESETS = [
  { id: "reel", name: "Cover · 9:16 Reel", w: 9, h: 16, canvas: false },
  { id: "canvas", name: "Cover · Spotify Canvas", w: 1, h: 1, canvas: true },
  { id: "youtube", name: "Cover · 16:9 YouTube", w: 16, h: 9, canvas: false }
];

function silenceFxForCover() {
  Object.keys(S.fx).forEach(k => { S.fx[k] = false; });
  Object.keys(S.fx2).forEach(k => { S.fx2[k] = false; });
  if (typeof syncFXUI === "function") syncFXUI();
  if (typeof syncFX2UI === "function") syncFX2UI();
}

function applyCoverImageSettings() {
  const IM = S.image;
  IM.mode = "backdrop";
  IM.filter = "cinematic";
  IM.blend = "source-over";
  IM.amount = 0.1;
  IM.opacity = 1;
  IM.kenburns = true;
  IM.beatSync = false;
  IM.tint = false;
  if (IM.img) IM.on = true;
  if (typeof syncImageLayerControls === "function") syncImageLayerControls("img", IM);
  const on = $("imgOn"); if (on) on.checked = !!IM.on;
}

function applyCoverExportPreset(id) {
  const preset = COVER_EXPORT_PRESETS.find(x => x.id === id);
  if (!preset) return;

  if (!S.image.img) {
    if (typeof showAppToast === "function") showAppToast("Cover Export — zuerst Bild A hochladen", 2800);
    $("imgInput")?.click();
    return;
  }

  applyCoverImageSettings();
  if (typeof toggleDna === "function") toggleDna(false);
  else S.dnaOn = false;

  S.shader.on = false;
  if (typeof syncShaderUI === "function") syncShaderUI();
  else { const sh = $("shOn"); if (sh) sh.checked = false; }

  S.pmode.on = false;
  const pm = $("pmOn"); if (pm) pm.checked = false;

  S.layerB.on = false;
  const lb = $("lbOn"); if (lb) lb.checked = false;

  silenceFxForCover();

  S.intro.on = false;
  S.intro.hold = false;
  const io = $("introOn"), ih = $("introHold");
  if (io) io.checked = false;
  if (ih) ih.checked = false;

  Object.assign(S.coverFX, { motion: "kenburns", filter: "cinematic", depth: 0.25 });

  S.spotifyCanvas = false;
  S.exportRange.on = false;
  const ro = $("rangeOn"); if (ro) ro.checked = false;

  if (typeof setCreatorFormat === "function") setCreatorFormat(preset.w, preset.h);
  else {
    S.aspect = [preset.w, preset.h];
    if (typeof resize === "function") resize();
  }

  if (preset.canvas && typeof applySpotifyCanvasMode === "function") {
    applySpotifyCanvasMode();
  } else {
    document.querySelectorAll("#fmtRow .fmt").forEach(f => {
      const m = +f.dataset.w === preset.w && +f.dataset.h === preset.h && !f.dataset.canvas && !f.dataset.loop;
      f.classList.toggle("active", m);
    });
  }

  S.imagePresetId = "canvas";
  S.imagePresetIdB = "";
  if (typeof syncImagePresetUI === "function") syncImagePresetUI();

  if (typeof updateCreatorDock === "function") updateCreatorDock();

  if (typeof showAppToast === "function") {
    showAppToast(`${preset.name} — jetzt ⤓ HQ Export`, 3600);
  }
}

function injectCoverExportUI() {
  if (document.getElementById("coverExportRow") || document.getElementById("coverExportRowLayers")) return;

  const dockActs = document.querySelector("#creatorDock .cr-actions");
  if (dockActs && !document.getElementById("coverExportRow")) {
    const row = document.createElement("div");
    row.id = "coverExportRow";
    row.className = "cr-cover-row";
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-bottom:8px";
    COVER_EXPORT_PRESETS.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn cr-sm";
      b.style.fontSize = "10px";
      b.textContent = p.name.replace("Cover · ", "");
      b.title = p.name;
      b.addEventListener("click", () => applyCoverExportPreset(p.id));
      row.appendChild(b);
    });
    dockActs.insertAdjacentElement("beforebegin", row);
  }

  const imgWrap = document.getElementById("imgPresetWrap");
  if (imgWrap && !document.getElementById("coverExportRowLayers")) {
    const wrap = document.createElement("div");
    wrap.id = "coverExportRowLayers";
    wrap.style.marginTop = "10px";
    wrap.innerHTML = '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Cover Export · 1-Klick</div>';
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexWrap = "wrap";
    row.style.gap = "6px";
    COVER_EXPORT_PRESETS.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.style.fontSize = "10px";
      b.style.padding = "6px 10px";
      b.textContent = p.name;
      b.addEventListener("click", () => applyCoverExportPreset(p.id));
      row.appendChild(b);
    });
    wrap.appendChild(row);
    imgWrap.insertAdjacentElement("afterend", wrap);
  }
}

function initCoverExportV102() {
  injectCoverExportUI();
}
