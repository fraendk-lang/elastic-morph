/* ============================================================
   v99 — DNA on/off toggle + Image presets + Image modes
   ============================================================ */

const IMG_MODES_V99 = [
  ["parallax", "Parallax Depth"],
  ["zoompulse", "Zoom Pulse"],
  ["datamosh", "Datamosh Blocks"],
  ["flicker", "Beat Flicker"],
  ["tunnel", "Tunnel Warp"]
];

const IMG_V99_MODES = new Set(IMG_MODES_V99.map(m => m[0]));

const IMAGE_PRESETS = [
  {
    id: "canvas", name: "Spotify Canvas", layer: "a",
    mode: "backdrop", filter: "cinematic", blend: "source-over",
    amount: 0.12, opacity: 1, kenburns: true, beatSync: false, tint: false
  },
  {
    id: "club", name: "Club Strobe", layer: "a",
    mode: "glitch", filter: "neon", blend: "screen",
    amount: 0.78, opacity: 0.92, kenburns: false, beatSync: true, tint: false
  },
  {
    id: "vinyl", name: "Vinyl Spin", layer: "a",
    mode: "spin", filter: "vintage", blend: "source-over",
    amount: 0.55, opacity: 0.95, kenburns: false, beatSync: false, tint: false
  },
  {
    id: "portrait", name: "Portrait Glow", layer: "a",
    mode: "backdrop", filter: "dreamy", blend: "soft-light",
    amount: 0.18, opacity: 0.88, kenburns: true, beatSync: false, tint: false
  },
  {
    id: "halftone", name: "Halftone Print", layer: "a",
    mode: "halftone", filter: "bw", blend: "multiply",
    amount: 0.62, opacity: 0.9, kenburns: false, beatSync: false, tint: false
  },
  {
    id: "kaleido", name: "Kaleido Trip", layer: "a",
    mode: "kaleido", filter: "duotone", blend: "screen",
    amount: 0.68, opacity: 0.85, kenburns: false, beatSync: false, tint: true
  },
  {
    id: "parallax", name: "Parallax Drift", layer: "a",
    mode: "parallax", filter: "cinematic", blend: "source-over",
    amount: 0.58, opacity: 0.94, kenburns: true, beatSync: false, tint: false
  },
  {
    id: "datamosh", name: "Datamosh Drop", layer: "a",
    mode: "datamosh", filter: "none", blend: "overlay",
    amount: 0.82, opacity: 0.9, kenburns: false, beatSync: true, tint: false
  }
];

function drawImageLayerV99(IM, W, H, baseHue, dt, opMul) {
  if (!IM.on || !IM.img) return;
  const energy = S.loudness, beat = S.beat, amt = IM.amount;
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

  if (IM.mode === "parallax") {
    const bands = 48;
    const bh = dH / bands;
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const depth = (b / bands - 0.5) * 2;
      const shift = depth * dW * 0.06 * amt * (0.35 + energy + beat * 0.45);
      const drift = Math.sin(S.time * 0.8 + b * 0.11) * dW * 0.015 * amt;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + shift + drift, oY + b * bh, dW, bh + 1);
    }
  } else if (IM.mode === "zoompulse") {
    const cx = W / 2, cy = H / 2;
    const pulse = 1 + (beat * 0.14 + S.transient * 0.1 + energy * 0.06) * amt;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.drawImage(IM.img, oX, oY, dW, dH);
  } else if (IM.mode === "datamosh") {
    const blocks = 10 + Math.round(amt * 10);
    const bw = dW / blocks;
    const slip = (beat * 0.85 + S.transient * 0.75) * amt;
    for (let i = 0; i < blocks; i++) {
      const sx = (i / blocks) * IM.img.width;
      const sw = IM.img.width / blocks + 1;
      const jx = (Math.random() - 0.5) * dW * 0.18 * slip;
      const jy = (i % 3 === 0 ? (Math.random() - 0.5) * dH * 0.04 * slip : 0);
      ctx.drawImage(IM.img, sx, 0, sw, IM.img.height, oX + i * bw + jx, oY + jy, bw + 1, dH);
    }
  } else if (IM.mode === "flicker") {
    const gate = 0.55 + beat * 0.45 * amt + S.transient * 0.35 * amt;
    ctx.globalAlpha *= Math.max(0.12, Math.min(1, gate));
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    if (beat > 0.5 * amt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul) * beat * 0.22 * amt;
      ctx.drawImage(IM.img, oX, oY, dW, dH);
      ctx.globalCompositeOperation = "source-over";
    }
  } else if (IM.mode === "tunnel") {
    const cx = W / 2, cy = H / 2;
    const segs = 16 + Math.round(amt * 8);
    const rot = S.time * 0.08 * amt + beat * 0.12;
    const pull = 1 + (beat * 0.08 + energy * 0.05) * amt;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const sc = (0.35 + t * 0.95) * pull;
      ctx.save();
      ctx.scale(sc, sc);
      ctx.globalAlpha *= 0.55 + t * 0.45;
      ctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      ctx.restore();
    }
  }

  ctx.filter = "none";
  ctx.restore();
}

function syncImageLayerControls(p, IM) {
  const on = $(p + "On"), mode = $(p + "Mode"), tint = $(p + "Tint"), kb = $(p + "KB");
  const amt = $(p + "Amt"), op = $(p + "Op"), flt = $(p + "Filter"), blend = $(p + "Blend");
  const bs = $(p + "BeatSync");
  if (on) on.checked = !!IM.on;
  if (mode) mode.value = IM.mode;
  if (tint) tint.checked = !!IM.tint;
  if (kb) kb.checked = !!IM.kenburns;
  if (amt) { amt.value = Math.round(IM.amount * 100); $(p + "AmtVal").textContent = amt.value; }
  if (op) { op.value = Math.round(IM.opacity * 100); $(p + "OpVal").textContent = op.value; }
  if (flt) flt.value = IM.filter || "none";
  if (blend) blend.value = IM.blend || "source-over";
  if (bs) bs.checked = !!IM.beatSync;
}

function applyImagePreset(id) {
  const p = IMAGE_PRESETS.find(x => x.id === id);
  if (!p) return;
  const IM = p.layer === "b" ? S.image2 : S.image;
  const prefix = p.layer === "b" ? "img2" : "img";
  IM.mode = p.mode;
  IM.filter = p.filter || "none";
  IM.blend = p.blend || "source-over";
  IM.amount = p.amount;
  IM.opacity = p.opacity;
  IM.kenburns = !!p.kenburns;
  IM.beatSync = !!p.beatSync;
  IM.tint = !!p.tint;
  if (IM.img) IM.on = true;
  syncImageLayerControls(prefix, IM);
  S.imagePresetId = id;
  syncImagePresetUI();
}

function injectImagePresetUI() {
  const anchor = $("imgClearBtn");
  if (!anchor || $("imgPresetRow")) return;
  const wrap = document.createElement("div");
  wrap.id = "imgPresetWrap";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Image Presets · Layer A</div><div id="imgPresetRow" class="smart-row" style="display:flex;flex-wrap:wrap;gap:6px"></div>`;
  anchor.insertAdjacentElement("afterend", wrap);
  if (!document.getElementById("imgPresetStyles")) {
    const st = document.createElement("style");
    st.id = "imgPresetStyles";
    st.textContent = "#imgPresetRow .img-chip.active{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 1px var(--accent)}";
    document.head.appendChild(st);
  }
  const row = $("imgPresetRow");
  row.innerHTML = "";
  IMAGE_PRESETS.filter(p => p.layer !== "b").forEach(p => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "btn img-chip";
    chip.dataset.id = p.id;
    chip.style.fontSize = "10px";
    chip.style.padding = "6px 10px";
    chip.textContent = p.name;
    chip.title = `${p.mode} · ${p.filter} · ${p.blend}`;
    chip.addEventListener("click", () => applyImagePreset(p.id));
    row.appendChild(chip);
  });
}

function syncImagePresetUI() {
  document.querySelectorAll("#imgPresetRow .img-chip").forEach(el => {
    el.classList.toggle("active", el.dataset.id === S.imagePresetId);
  });
}

function injectDnaToggleUI() {
  const page = $("page-dna");
  if (!page || $("dnaOnChk")) return;
  const sub = page.querySelector(".sub");
  const box = document.createElement("label");
  box.className = "check";
  box.style.cssText = "display:block;margin:12px 0 18px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px";
  box.innerHTML = `<input type="checkbox" id="dnaOnChk" checked> <b>Visual DNA anzeigen</b> — Organismus / Preset-Form<br><span style="font-size:11px;color:var(--text-dim);margin-left:22px;display:inline-block;margin-top:4px">Aus = nur Bild, Shader, Partikel &amp; FX (z.&nbsp;B. reines Cover-Visual)</span>`;
  sub.insertAdjacentElement("afterend", box);
  /* change handler wired in v100 (toggleDna + toast) */
}

function syncDnaToggleUI() {
  const el = $("dnaOnChk");
  if (el) el.checked = S.dnaOn !== false;
}

function patchDnaAndImageProject() {
  const _projectData = projectData;
  projectData = function () {
    const d = _projectData();
    d.dnaOn = S.dnaOn !== false;
    d.imagePresetId = S.imagePresetId || "";
    return d;
  };

  const _applyProject = applyProject;
  applyProject = function (o, fromScene) {
    _applyProject(o, fromScene);
    if (o.dnaOn != null) S.dnaOn = o.dnaOn !== false;
    S.imagePresetId = o.imagePresetId || "";
    syncDnaToggleUI();
    syncImagePresetUI();
  };
}

function initImageLayerV99() {
  IMG_MODES.push(...IMG_MODES_V99);
  if (S.imagePresetId == null) S.imagePresetId = "";

  const _drawImageLayer = drawImageLayer;
  drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
    if (IMG_V99_MODES.has(IM.mode)) {
      drawImageLayerV99(IM, W, H, baseHue, dt, opMul);
      return;
    }
    _drawImageLayer(IM, W, H, baseHue, dt, opMul);
  };

  const _wireImageLayer = wireImageLayer;
  wireImageLayer = function (p, IM) {
    _wireImageLayer(p, IM);
    IMG_MODES_V99.forEach(([id, label]) => {
      const sel = $(p + "Mode");
      if (!sel || sel.querySelector(`option[value="${id}"]`)) return;
      const o = document.createElement("option");
      o.value = id; o.textContent = label;
      sel.appendChild(o);
    });
  };

  /* modes added when buildImageLayer() wires controls */
}

function initDnaAndImageV99() {
  if (S.dnaOn == null) S.dnaOn = true;
  patchDnaAndImageProject();
  injectDnaToggleUI();
  syncDnaToggleUI();
  initImageLayerV99();
  injectImagePresetUI();
  syncImagePresetUI();
}
