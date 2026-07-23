/* ============================================================
   v100 — DNA shortcut (D) + Image Presets Layer B row
   ============================================================ */

const IMAGE_PRESETS_B = [
  {
    id: "b-glow", name: "Screen Glow",
    mode: "backdrop", filter: "neon", blend: "screen",
    amount: 0.22, opacity: 0.75, kenburns: true, beatSync: false, tint: true
  },
  {
    id: "b-mirror", name: "Mirror Split",
    mode: "mirror", filter: "cinematic", blend: "overlay",
    amount: 0.55, opacity: 0.82, kenburns: false, beatSync: false, tint: false
  },
  {
    id: "b-ripple", name: "Ripple Wash",
    mode: "ripple", filter: "dreamy", blend: "soft-light",
    amount: 0.48, opacity: 0.7, kenburns: false, beatSync: false, tint: false
  },
  {
    id: "b-kaleido", name: "Kaleido Overlay",
    mode: "kaleido", filter: "duotone", blend: "screen",
    amount: 0.62, opacity: 0.65, kenburns: false, beatSync: true, tint: true
  },
  {
    id: "b-dispersion", name: "Dispersion Ghost",
    mode: "dispersion", filter: "dreamy", blend: "lighter",
    amount: 0.45, opacity: 0.55, kenburns: false, beatSync: false, tint: true
  },
  {
    id: "b-glitch", name: "Glitch Echo",
    mode: "glitch", filter: "neon", blend: "lighter",
    amount: 0.72, opacity: 0.68, kenburns: false, beatSync: true, tint: false
  },
  {
    id: "b-parallax", name: "Parallax Depth",
    mode: "parallax", filter: "vintage", blend: "multiply",
    amount: 0.52, opacity: 0.78, kenburns: true, beatSync: false, tint: false
  },
  {
    id: "b-tunnel", name: "Tunnel Warp",
    mode: "tunnel", filter: "none", blend: "overlay",
    amount: 0.58, opacity: 0.72, kenburns: false, beatSync: false, tint: false
  }
];

function toggleDna(force) {
  S.dnaOn = force != null ? !!force : !(S.dnaOn !== false);
  syncDnaToggleUI();
  if (!S.dnaOn && typeof spawnParticles === "function") spawnParticles();
  if (typeof showAppToast === "function") {
    showAppToast(
      S.dnaOn !== false ? "Visual DNA an (D)" : "Visual DNA aus — nur Bild / Shader / FX (D)",
      2200
    );
  }
}

function applyImagePresetB(id) {
  const p = IMAGE_PRESETS_B.find(x => x.id === id);
  if (!p) return;
  const IM = S.image2;
  IM.mode = p.mode;
  IM.filter = p.filter || "none";
  IM.blend = p.blend || "source-over";
  IM.amount = p.amount;
  IM.opacity = p.opacity;
  IM.kenburns = !!p.kenburns;
  IM.beatSync = !!p.beatSync;
  IM.tint = !!p.tint;
  if (IM.img) IM.on = true;
  syncImageLayerControls("img2", IM);
  S.imagePresetIdB = id;
  S.imagePresetId = "";
  syncImagePresetUI();
}

function patchImagePresetLayerA() {
  const row = document.getElementById("imgPresetRow");
  const bOnly = row?.querySelector('[data-id="layer-b-glow"]');
  if (bOnly) bOnly.remove();
  const label = document.getElementById("imgPresetWrap")?.querySelector("div");
  if (label) label.textContent = "Image Presets · Layer A";
}

function injectImagePresetRowB() {
  const anchor = $("img2ClearBtn");
  if (!anchor || $("imgPresetRowB")) return;
  const wrap = document.createElement("div");
  wrap.id = "imgPresetWrapB";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Image Presets · Layer B</div><div id="imgPresetRowB" class="smart-row" style="display:flex;flex-wrap:wrap;gap:6px"></div>`;
  anchor.insertAdjacentElement("afterend", wrap);
  if (!document.getElementById("imgPresetStylesB")) {
    const st = document.createElement("style");
    st.id = "imgPresetStylesB";
    st.textContent = "#imgPresetRowB .img-chip.active{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 1px var(--accent)}";
    document.head.appendChild(st);
  }
  const row = $("imgPresetRowB");
  IMAGE_PRESETS_B.forEach(p => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "btn img-chip";
    chip.dataset.id = p.id;
    chip.dataset.layer = "b";
    chip.style.fontSize = "10px";
    chip.style.padding = "6px 10px";
    chip.textContent = p.name;
    chip.title = `${p.mode} · ${p.filter} · ${p.blend}`;
    chip.addEventListener("click", () => applyImagePresetB(p.id));
    row.appendChild(chip);
  });
}

function syncImagePresetUIV100() {
  document.querySelectorAll("#imgPresetRow .img-chip").forEach(el => {
    el.classList.toggle("active", el.dataset.id === S.imagePresetId && !S.imagePresetIdB);
  });
  document.querySelectorAll("#imgPresetRowB .img-chip").forEach(el => {
    el.classList.toggle("active", el.dataset.id === S.imagePresetIdB);
  });
}

function patchDnaShortcutAndPresetsB() {
  if (S.imagePresetIdB == null) S.imagePresetIdB = "";

  const dnaChk = $("dnaOnChk");
  if (dnaChk && !dnaChk.dataset.v100) {
    dnaChk.dataset.v100 = "1";
    dnaChk.addEventListener("change", e => toggleDna(e.target.checked));
  }

  const _applyImagePreset = typeof applyImagePreset === "function" ? applyImagePreset : null;
  if (_applyImagePreset) {
    applyImagePreset = function (id) {
      _applyImagePreset(id);
      S.imagePresetIdB = "";
      syncImagePresetUIV100();
    };
  }

  const _syncImagePresetUI = typeof syncImagePresetUI === "function" ? syncImagePresetUI : function () {};
  syncImagePresetUI = function () {
    _syncImagePresetUI();
    syncImagePresetUIV100();
  };

  const _projectData = projectData;
  projectData = function () {
    const d = _projectData();
    d.imagePresetIdB = S.imagePresetIdB || "";
    return d;
  };

  const _applyProject = applyProject;
  applyProject = function (o, fromScene) {
    _applyProject(o, fromScene);
    S.imagePresetIdB = o.imagePresetIdB || "";
    syncImagePresetUIV100();
  };

  if (typeof syncImageLayerControls === "function") {
    const _sync = syncImageLayerControls;
    syncImageLayerControls = function (p, IM) {
      _sync(p, IM);
      const kb = $(p + "KB");
      if (kb) kb.checked = !!IM.kenburns;
    };
  }
}

function wireDnaShortcut() {
  if (document.body.dataset.dnaKeyV100) return;
  document.body.dataset.dnaKeyV100 = "1";
  document.addEventListener("keydown", e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      toggleDna();
    }
  });
}

function patchHelpDnaShortcut() {
  document.querySelectorAll(".keys span").forEach(span => {
    if (span.textContent.includes("G") && span.textContent.includes("Partikel") && !span.textContent.includes(" DNA")) {
      span.innerHTML = span.innerHTML.replace(
        "<b>F</b> Vollbild",
        "<b>D</b> DNA · <b>F</b> Vollbild"
      );
    }
  });
}

function initDnaShortcutAndImagePresetsB() {
  patchDnaShortcutAndPresetsB();
  patchImagePresetLayerA();
  injectImagePresetRowB();
  syncImagePresetUIV100();
  wireDnaShortcut();
  patchHelpDnaShortcut();
}
