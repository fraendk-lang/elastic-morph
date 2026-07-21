/* ============================================================
   v77 — Text Mode presets (one-click looks)
   ============================================================ */

const TEXT_PRESETS = [
  {
    id: "cinematic", name: "Cinematic Title",
    show: true, pos: "c", font: "serif", color: "white", anim: "fade", size: 1.35,
    style: "fill", plate: false, shadow: true, lower: false, circle: false,
    upper: false, weight: "300", track: 4, blend: "source-over", gradDir: "h"
  },
  {
    id: "neon-lower", name: "Neon Lower Third",
    show: true, pos: "bl", font: "sans", color: "grad2", anim: "glow", size: 1.05,
    style: "neon", plate: true, shadow: false, lower: true, circle: false,
    upper: true, weight: "700", track: 2, blend: "screen", gradDir: "h",
    custom: "#4be1e8", custom2: "#d946ef", plateOpacity: 0.55
  },
  {
    id: "minimal-credits", name: "Minimal Credits",
    show: true, pos: "br", font: "mono", color: "white", anim: "static", size: 0.82,
    style: "fill", plate: true, shadow: false, lower: false, circle: false,
    upper: false, weight: "500", track: 1, blend: "source-over", plateOpacity: 0.4
  },
  {
    id: "karaoke", name: "Karaoke Lyric",
    show: true, pos: "bc", font: "poster", color: "white", anim: "karaoke", size: 1.2,
    style: "outline", plate: true, shadow: true, lower: false, circle: false,
    upper: false, weight: "900", track: 0, blend: "source-over", plateOpacity: 0.45
  },
  {
    id: "glitch-drop", name: "Glitch Drop",
    show: true, pos: "c", font: "mono", color: "dna", anim: "beatgate", size: 1.15,
    style: "neon", plate: false, shadow: false, lower: false, circle: false,
    upper: true, weight: "900", track: 6, blend: "difference", gradDir: "d"
  },
  {
    id: "magazine", name: "Magazine Cover",
    show: true, pos: "tc", font: "poster", color: "grad2", anim: "zoom", size: 1.45,
    style: "fill", plate: false, shadow: true, lower: false, circle: false,
    upper: true, weight: "900", track: 8, blend: "source-over", gradDir: "v",
    custom: "#f5e6d3", custom2: "#c2410c"
  }
];

function applyTextPreset(id) {
  const p = TEXT_PRESETS.find(x => x.id === id);
  if (!p) return;
  S.textShow = !!p.show;
  S.textPos = p.pos || "bl";
  S.textFont = p.font || "sans";
  S.textColor = p.color || "white";
  S.textAnim = p.anim || "static";
  S.textSize = p.size != null ? p.size : 1;
  S.textStyle = p.style || "fill";
  S.textPlate = !!p.plate;
  S.textShadow = !!p.shadow;
  S.textLower = !!p.lower;
  S.textCircle = !!p.circle;
  S.textUpper = !!p.upper;
  S.textWeight = p.weight || "auto";
  S.textTrack = p.track != null ? p.track : 0;
  S.textBlend = p.blend || "source-over";
  S.textGradDir = p.gradDir || "h";
  if (p.custom) S.textCustom = p.custom;
  if (p.custom2) S.textCustom2 = p.custom2;
  if (p.plateOpacity != null) S.textPlateOpacity = p.plateOpacity;
  S.textPresetId = id;
  syncTextPresetUI();
  if (typeof restartType === "function") restartType();
  showAppToast(`Text-Preset: ${p.name}`, 2400);
}

function syncTextPresetUI() {
  document.querySelectorAll("#textPresetRow .text-chip").forEach(el => {
    el.classList.toggle("active", el.dataset.id === S.textPresetId);
  });
  if (!$("textShow")) return;
  $("textShow").checked = S.textShow;
  $("textPos").value = S.textPos;
  $("textFont").value = S.textFont;
  $("textColor").value = S.textColor;
  $("textAnim").value = S.textAnim;
  $("textStyle").value = S.textStyle;
  $("textPlate").checked = S.textPlate;
  $("textLower").checked = S.textLower;
  $("textCircle").checked = S.textCircle;
  $("textUpper").checked = S.textUpper;
  $("textWeight").value = S.textWeight;
  $("textTrack").value = S.textTrack;
  $("textTrackVal").textContent = S.textTrack;
  $("textSize").value = Math.round(S.textSize * 100);
  $("textSizeVal").textContent = Math.round(S.textSize * 100) + "%";
  $("textShadow").checked = S.textShadow;
  $("textBlend").value = S.textBlend;
  $("textGradDir").value = S.textGradDir;
  $("textCustom").value = S.textCustom;
  $("textCustom2").value = S.textCustom2;
  $("textPlateOp").value = Math.round(S.textPlateOpacity * 100);
  $("textPlateOpVal").textContent = Math.round(S.textPlateOpacity * 100);
}

function injectTextPresetUI() {
  const row = $("textPresetRow");
  if (!row || row.dataset.wired) return;
  row.dataset.wired = "1";
  if (!document.getElementById("textPresetStyles")) {
    const st = document.createElement("style");
    st.id = "textPresetStyles";
    st.textContent = "#textPresetRow .text-chip.active{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 1px var(--accent)}";
    document.head.appendChild(st);
  }
  row.innerHTML = "";
  TEXT_PRESETS.forEach(p => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "btn text-chip";
    chip.dataset.id = p.id;
    chip.style.fontSize = "11px";
    chip.textContent = p.name;
    chip.addEventListener("click", () => applyTextPreset(p.id));
    row.appendChild(chip);
  });
}

function patchTextPresets() {
  if (S.textPresetId == null) S.textPresetId = "";

  const _projectData = projectData;
  projectData = function () {
    const d = _projectData();
    if (d.text) d.text.presetId = S.textPresetId || "";
    return d;
  };

  const _applyProject = applyProject;
  applyProject = function (o, fromScene) {
    _applyProject(o, fromScene);
    S.textPresetId = (o.text && o.text.presetId) || "";
    syncTextPresetUI();
  };
}

function initTextPresets() {
  patchTextPresets();
  injectTextPresetUI();
  syncTextPresetUI();
}
