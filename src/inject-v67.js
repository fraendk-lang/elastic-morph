/* ============================================================
   v67 — Image Layer A/B: 5 neue Modulationen + Creative Filter
   ============================================================ */

const IMG_MODES_V67 = [
  ["glitch", "Glitch / Slice"],
  ["ripple", "Ripple / Welle"],
  ["kaleido", "Kaleidoscope"],
  ["scan", "Scanlines / VHS"],
  ["mirror", "Mirror Split"]
];

const IMG_FILTERS = [
  ["none", "Kein Filter"],
  ["cinematic", "Cinematic"],
  ["bw", "Schwarzweiß"],
  ["duotone", "Duotone (DNA)"],
  ["vintage", "Vintage"],
  ["dreamy", "Dreamy"],
  ["neon", "Neon Glow"]
];

const IMG_V67_MODES = new Set(IMG_MODES_V67.map(m => m[0]));

function imageLayerFilterCSS(IM, baseHue) {
  const f = IM.filter || "none";
  if (f === "none") return "none";
  const hue = S.palette.on ? S.palette.hue : (baseHue || 280);
  return coverFilterCSS(f, hue);
}

function drawImageLayerV67(IM, W, H, baseHue, dt, opMul) {
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
  const filt = imageLayerFilterCSS(IM, baseHue);
  if (filt !== "none") ctx.filter = filt;

  if (IM.mode === "glitch") {
    const bands = 24 + Math.round(amt * 20);
    const bh = dH / bands;
    const glitch = (beat * 0.85 + S.transient * 0.9) * amt;
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const jx = (Math.random() - 0.5) * dW * 0.12 * glitch;
      const dup = glitch > 0.35 && b % 7 === 0;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx, oY + b * bh, dW, bh + 1);
      if (dup) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha *= 0.45;
        ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + jx + 8, oY + b * bh, dW, bh + 1);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = IM.opacity * (opMul == null ? 1 : opMul);
      }
    }
  } else if (IM.mode === "ripple") {
    const bands = 56;
    const bh = dH / bands;
    const amp = dW * 0.04 * amt * (0.4 + energy + beat * 0.5);
    for (let b = 0; b < bands; b++) {
      const sy = (b / bands) * IM.img.height;
      const sh = IM.img.height / bands + 1;
      const cx = (b / bands - 0.5) * 2;
      const wav = Math.sin(S.time * 3 + b * 0.22 + cx * 4) * amp;
      const wav2 = Math.cos(S.time * 2.1 + b * 0.15) * amp * 0.35 * S.bass;
      ctx.drawImage(IM.img, 0, sy, IM.img.width, sh, oX + wav + wav2, oY + b * bh, dW, bh + 1);
    }
  } else if (IM.mode === "kaleido") {
    const cx = W / 2, cy = H / 2;
    const segs = 4 + Math.round(amt * 4);
    const diag = Math.hypot(W, H);
    const fill = diag / Math.min(dW, dH);
    ctx.translate(cx, cy);
    ctx.rotate(S.time * 0.05 * amt + beat * 0.08);
    for (let s = 0; s < segs; s++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / segs) * s);
      ctx.scale(s % 2 ? 1 : -1, 1);
      ctx.scale(fill * (1 + beat * 0.04 * amt), fill * (1 + beat * 0.04 * amt));
      ctx.drawImage(IM.img, -dW / 2, -dH / 2, dW, dH);
      ctx.restore();
    }
  } else if (IM.mode === "scan") {
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    const lines = Math.floor(H / 3);
    const scroll = (S.time * 40 + beat * 80) % 12;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, (y + scroll) % H, W, 1);
    if (amt > 0.2) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${0.03 + beat * 0.08 * amt})`;
      ctx.fillRect(0, (S.time * 120) % H, W, 2 + beat * 6);
    }
    const barH = H * (0.08 + (1 - energy) * 0.12);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, (S.time * 90 + beat * 200) % (H + barH) - barH, W, barH);
  } else if (IM.mode === "mirror") {
    const gap = amt * W * 0.08 * (0.3 + beat);
    const cx = W / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, cx - gap / 2, H); ctx.clip();
    ctx.drawImage(IM.img, oX, oY, dW, dH);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + gap / 2, 0);
    ctx.scale(-1, 1);
    ctx.beginPath(); ctx.rect(0, 0, cx - gap / 2, H); ctx.clip();
    ctx.drawImage(IM.img, oX - (cx + gap / 2), oY, dW, dH);
    ctx.restore();
    if (gap > 2) {
      ctx.fillStyle = `rgba(177,75,255,${0.15 + beat * 0.35 * amt})`;
      ctx.fillRect(cx - gap / 2, 0, gap, H);
    }
  }

  ctx.filter = "none";
  ctx.restore();
}

function appendImageFilterSelect(p, IM) {
  const host = $(p + "Mode")?.parentElement;
  if (!host || $(p + "Filter")) return;
  const lab = document.createElement("label");
  lab.className = "check";
  lab.style.marginTop = "8px";
  lab.style.display = "block";
  lab.style.fontSize = "11px";
  lab.style.color = "var(--text-dim)";
  lab.textContent = "Filter ";
  const sel = document.createElement("select");
  sel.id = p + "Filter";
  sel.className = "pm-select";
  sel.style.marginTop = "4px";
  IMG_FILTERS.forEach(([id, label]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = label;
    if (id === (IM.filter || "none")) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", e => { IM.filter = e.target.value; });
  host.insertAdjacentElement("afterend", sel);
}

function initImageLayerV67() {
  IMG_MODES.push(...IMG_MODES_V67);
  if (S.image.filter == null) S.image.filter = "none";
  if (S.image2.filter == null) S.image2.filter = "none";

  const _drawImageLayer = drawImageLayer;
  drawImageLayer = function (IM, W, H, baseHue, dt, opMul) {
    if (IMG_V67_MODES.has(IM.mode)) {
      drawImageLayerV67(IM, W, H, baseHue, dt, opMul);
      return;
    }
    if (IM.filter && IM.filter !== "none") {
      const filt = imageLayerFilterCSS(IM, baseHue);
      if (filt !== "none") {
        ctx.save();
        ctx.filter = filt;
        _drawImageLayer(IM, W, H, baseHue, dt, opMul);
        ctx.filter = "none";
        ctx.restore();
        return;
      }
    }
    _drawImageLayer(IM, W, H, baseHue, dt, opMul);
  };

  const _wireImageLayer = wireImageLayer;
  wireImageLayer = function (p, IM) {
    _wireImageLayer(p, IM);
    IMG_MODES_V67.forEach(([id, label]) => {
      const sel = $(p + "Mode");
      if (!sel || sel.querySelector(`option[value="${id}"]`)) return;
      const o = document.createElement("option");
      o.value = id; o.textContent = label;
      sel.appendChild(o);
    });
    appendImageFilterSelect(p, IM);
  };

  const _imgLayerData = imgLayerData;
  imgLayerData = function (IM) {
    return { ..._imgLayerData(IM), filter: IM.filter || "none" };
  };
}
