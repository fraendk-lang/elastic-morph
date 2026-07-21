/* ============================================================
   v76 — Export transitions: configurable fade in/out (HQ + realtime)
   ============================================================ */

function defaultExportTrans() {
  return {
    fadeIn: { on: true, dur: 1.5, curve: "smooth", color: "#000000" },
    fadeOut: { on: true, dur: 2.0, curve: "smooth", color: "#000000" },
    audioFade: true
  };
}

function exportTransCurve(x, curve) {
  x = Math.max(0, Math.min(1, x));
  switch (curve) {
    case "linear": return x;
    case "easeIn": return x * x;
    case "easeOut": return 1 - (1 - x) * (1 - x);
    case "scurve": return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "smooth":
    default: return x * x * (3 - 2 * x);
  }
}

function exportTransAlpha(t, dur, trans) {
  trans = trans || S.exportTrans || defaultExportTrans();
  if (!dur || dur <= 0) return 0;
  let alpha = 0;
  const fi = trans.fadeIn, fo = trans.fadeOut;
  if (fi && fi.on && fi.dur > 0 && t < fi.dur) {
    alpha = Math.max(alpha, 1 - exportTransCurve(t / fi.dur, fi.curve || "smooth"));
  }
  if (fo && fo.on && fo.dur > 0 && t > dur - fo.dur) {
    alpha = Math.max(alpha, exportTransCurve((t - (dur - fo.dur)) / fo.dur, fo.curve || "smooth"));
  }
  return Math.max(0, Math.min(1, alpha));
}

function exportTransGain(t, dur, trans) {
  trans = trans || S.exportTrans || defaultExportTrans();
  if (!trans.audioFade) return 1;
  return 1 - exportTransAlpha(t, dur, trans);
}

function exportFadeTimeline() {
  if (S.exporting && S._hqExportDur != null) {
    return {
      t: Math.max(0, (S.virtualT || 0) - (S._hqExportT0 || 0)),
      dur: S._hqExportDur
    };
  }
  if (typeof exportFade !== "undefined" && exportFade) {
    const t = (performance.now() - exportFade.t0) / 1000;
    const dur = exportFade.endAt
      ? Math.max(0.01, (exportFade.endAt - exportFade.t0) / 1000)
      : Math.max(0.01, audioEl.duration || 60);
    return { t, dur };
  }
  return null;
}

function exportFadeOutMs() {
  const fo = (S.exportTrans || defaultExportTrans()).fadeOut;
  return Math.max(200, Math.round((fo.on ? fo.dur : 0.3) * 1000));
}

function beginRealtimeExportFade(t0, opts) {
  opts = opts || {};
  const fade = { t0, endAt: null };
  if (opts.loopDurS) fade.endAt = t0 + opts.loopDurS * 1000;
  else if (opts.remainS != null && isFinite(opts.remainS)) fade.endAt = t0 + opts.remainS * 1000;
  return fade;
}

function hqExportRange() {
  const buf = S.audioBuffer;
  if (!buf) return { startT: 0, rangeDur: 1 };
  let startT = 0, endT = buf.duration;
  if (S.exportRange && S.exportRange.on) {
    startT = Math.max(0, Math.min(buf.duration, S.exportRange.start || 0));
    endT = S.exportRange.end > 0 ? Math.min(buf.duration, S.exportRange.end) : buf.duration;
    if (endT <= startT + 0.2) { startT = 0; endT = buf.duration; }
  }
  return { startT, rangeDur: Math.max(0.01, endT - startT) };
}

function applyAudioExportFade(data, numCh, n, off, sampleRate, bufStart) {
  if (!S.exportTrans || !S.exportTrans.audioFade) return;
  const { rangeDur } = hqExportRange();
  for (let f = 0; f < n; f++) {
    const t = (off + f - bufStart) / sampleRate;
    const g = exportTransGain(t, rangeDur, S.exportTrans);
    if (g >= 0.999) continue;
    for (let c = 0; c < numCh; c++) data[c * n + f] *= g;
  }
}

function injectExportTransUI() {
  const panel = $("exportTransPanel");
  const anchor = $("hqExportBtn");
  if (!panel || !anchor || panel.dataset.wired) return;
  panel.dataset.wired = "1";
  panel.innerHTML = `
    <h3 style="margin:18px 0 6px">Export-Übergänge</h3>
    <p class="note" style="margin-bottom:10px">Ein- und Ausblendung für <b>HQ Export</b> und ● Export — wie in DaVinci.</p>
    <div class="text-opts" style="max-width:440px;margin-bottom:12px">
      <div class="opt"><span>Einblendung</span>
        <label class="check" style="flex:1"><input type="checkbox" id="xfInOn" checked> An</label>
      </div>
      <div class="opt"><span>Dauer In</span>
        <input type="range" id="xfInDur" min="0" max="8" step="0.1" value="1.5" style="flex:1">
        <span class="val" id="xfInDurVal">1.5s</span>
      </div>
      <div class="opt"><span>Kurve In</span>
        <select id="xfInCurve" style="flex:1">
          <option value="smooth" selected>Smooth</option>
          <option value="linear">Linear</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
          <option value="scurve">S-Kurve</option>
        </select>
      </div>
      <div class="opt"><span>Ausblendung</span>
        <label class="check" style="flex:1"><input type="checkbox" id="xfOutOn" checked> An</label>
      </div>
      <div class="opt"><span>Dauer Out</span>
        <input type="range" id="xfOutDur" min="0" max="8" step="0.1" value="2" style="flex:1">
        <span class="val" id="xfOutDurVal">2.0s</span>
      </div>
      <div class="opt"><span>Kurve Out</span>
        <select id="xfOutCurve" style="flex:1">
          <option value="smooth" selected>Smooth</option>
          <option value="linear">Linear</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
          <option value="scurve">S-Kurve</option>
        </select>
      </div>
      <div class="opt"><span>Farbe</span>
        <select id="xfColorMode" style="flex:1">
          <option value="#000000" selected>Schwarz</option>
          <option value="#ffffff">Weiß</option>
          <option value="custom">Eigene…</option>
        </select>
        <input type="color" id="xfColorCustom" value="#000000" style="width:34px;height:26px;padding:0;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer;display:none">
      </div>
      <div class="opt"><span>Audio</span>
        <label class="check" style="flex:1"><input type="checkbox" id="xfAudioFade" checked> Audio mitfaden</label>
      </div>
    </div>`;

  const syncColorUi = () => {
    const mode = $("xfColorMode").value;
    $("xfColorCustom").style.display = mode === "custom" ? "" : "none";
    if (mode !== "custom") S.exportTrans.fadeIn.color = S.exportTrans.fadeOut.color = mode;
    else S.exportTrans.fadeIn.color = S.exportTrans.fadeOut.color = $("xfColorCustom").value;
  };

  $("xfInOn").addEventListener("change", e => { S.exportTrans.fadeIn.on = e.target.checked; });
  $("xfOutOn").addEventListener("change", e => { S.exportTrans.fadeOut.on = e.target.checked; });
  $("xfInDur").addEventListener("input", e => {
    S.exportTrans.fadeIn.dur = +e.target.value;
    $("xfInDurVal").textContent = (+e.target.value).toFixed(1) + "s";
  });
  $("xfOutDur").addEventListener("input", e => {
    S.exportTrans.fadeOut.dur = +e.target.value;
    $("xfOutDurVal").textContent = (+e.target.value).toFixed(1) + "s";
  });
  $("xfInCurve").addEventListener("change", e => { S.exportTrans.fadeIn.curve = e.target.value; });
  $("xfOutCurve").addEventListener("change", e => { S.exportTrans.fadeOut.curve = e.target.value; });
  $("xfColorMode").addEventListener("change", syncColorUi);
  $("xfColorCustom").addEventListener("input", e => {
    S.exportTrans.fadeIn.color = S.exportTrans.fadeOut.color = e.target.value;
    $("xfColorMode").value = "custom";
  });
  $("xfAudioFade").addEventListener("change", e => { S.exportTrans.audioFade = e.target.checked; });
}

function syncExportTransUI() {
  const t = S.exportTrans;
  if (!$("exportTransPanel") || !t) return;
  $("xfInOn").checked = !!t.fadeIn.on;
  $("xfOutOn").checked = !!t.fadeOut.on;
  $("xfInDur").value = t.fadeIn.dur; $("xfInDurVal").textContent = t.fadeIn.dur.toFixed(1) + "s";
  $("xfOutDur").value = t.fadeOut.dur; $("xfOutDurVal").textContent = t.fadeOut.dur.toFixed(1) + "s";
  $("xfInCurve").value = t.fadeIn.curve || "smooth";
  $("xfOutCurve").value = t.fadeOut.curve || "smooth";
  $("xfAudioFade").checked = !!t.audioFade;
  const col = t.fadeIn.color || "#000000";
  if (col === "#000000" || col === "#ffffff") { $("xfColorMode").value = col; $("xfColorCustom").style.display = "none"; }
  else { $("xfColorMode").value = "custom"; $("xfColorCustom").value = col; $("xfColorCustom").style.display = ""; }
}

function patchExportTransitions() {
  if (!S.exportTrans) S.exportTrans = defaultExportTrans();

  drawExportFade = function (W, H) {
    const tl = exportFadeTimeline();
    if (!tl) return;
    const trans = S.exportTrans || defaultExportTrans();
    if (!trans.fadeIn.on && !trans.fadeOut.on) return;
    const alpha = exportTransAlpha(tl.t, tl.dur, trans);
    if (alpha <= 0.001) return;
    const col = trans.fadeIn.color || "#000000";
    let r = 0, g = 0, b = 0;
    if (/^#[0-9a-fA-F]{6}$/.test(col)) {
      r = parseInt(col.slice(1, 3), 16);
      g = parseInt(col.slice(3, 5), 16);
      b = parseInt(col.slice(5, 7), 16);
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  const _exportHQ = exportHQ;
  exportHQ = async function () {
    const { startT, rangeDur } = hqExportRange();
    S._hqExportT0 = startT;
    S._hqExportDur = rangeDur;
    try { return await _exportHQ(); }
    finally {
      S._hqExportT0 = null;
      S._hqExportDur = null;
    }
  };

  const _projectData = projectData;
  projectData = function () {
    const d = _projectData();
    d.exportTrans = {
      fadeIn: { ...S.exportTrans.fadeIn },
      fadeOut: { ...S.exportTrans.fadeOut },
      audioFade: S.exportTrans.audioFade
    };
    return d;
  };

  const _applyProject = applyProject;
  applyProject = function (o, fromScene) {
    _applyProject(o, fromScene);
    if (o.exportTrans) {
      const d = defaultExportTrans();
      S.exportTrans = {
        fadeIn: { ...d.fadeIn, ...(o.exportTrans.fadeIn || {}) },
        fadeOut: { ...d.fadeOut, ...(o.exportTrans.fadeOut || {}) },
        audioFade: o.exportTrans.audioFade != null ? !!o.exportTrans.audioFade : d.audioFade
      };
      syncExportTransUI();
    }
  };
}

function initExportTransitions() {
  if (!S.exportTrans) S.exportTrans = defaultExportTrans();
  patchExportTransitions();
  injectExportTransUI();
  syncExportTransUI();
}
