/* ============================================================
   v78 — Visual polish: export sharpen, anti-banding, exposure reset
   ============================================================ */

function defaultExportPolish() {
  return { on: true, sharpen: 0.35, dither: 0.08 };
}

function drawExportPolish(W, H) {
  if (!S.exporting || !S.exportPolish || !S.exportPolish.on) return;
  const P = S.exportPolish;
  if (P.sharpen > 0.01) {
    snapshot(W, H);
    ctx.filter = `contrast(${1 + P.sharpen * 0.14}) saturate(${1 + P.sharpen * 0.06}) brightness(${1 + P.sharpen * 0.02})`;
    ctx.drawImage(fxC, 0, 0, W, H);
    ctx.filter = "none";
  }
  if (P.dither > 0.01) {
    const rng = seededRand(Math.floor((S.virtualT || S.time) * 60) + 913);
    ctx.globalAlpha = P.dither * 0.22;
    const n = Math.round(60 + P.dither * 180);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rng() > 0.5 ? "#fff" : "#000";
      ctx.fillRect(rng() * W, rng() * H, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function injectExportPolishUI() {
  const anchor = $("masterChroma");
  if (!anchor || $("exportPolishOn")) return;
  const host = anchor.closest(".text-opts");
  if (!host) return;
  const block = document.createElement("div");
  block.innerHTML = `
    <div class="divider" style="margin:12px 0"></div>
    <div class="opt"><span>HQ Polish</span>
      <label class="check" style="flex:1"><input type="checkbox" id="exportPolishOn" checked> Schärfe + Anti-Banding (nur Export)</label>
    </div>
    <div class="opt"><span>Schärfe</span>
      <input type="range" id="exportPolishSharp" min="0" max="100" value="35" style="flex:1">
      <span class="val" id="exportPolishSharpVal">35</span>
    </div>
    <div class="opt"><span>Dither</span>
      <input type="range" id="exportPolishDither" min="0" max="100" value="8" style="flex:1">
      <span class="val" id="exportPolishDitherVal">8</span>
    </div>
    <div class="opt"><span>Exposure</span>
      <button type="button" class="btn" id="exposureResetBtn" style="flex:1;font-size:11px">Auto-Exposure zurücksetzen</button>
    </div>`;
  host.appendChild(block);

  $("exportPolishOn").addEventListener("change", e => { S.exportPolish.on = e.target.checked; });
  $("exportPolishSharp").addEventListener("input", e => {
    S.exportPolish.sharpen = e.target.value / 100;
    $("exportPolishSharpVal").textContent = e.target.value;
  });
  $("exportPolishDither").addEventListener("input", e => {
    S.exportPolish.dither = e.target.value / 100;
    $("exportPolishDitherVal").textContent = e.target.value;
  });
  $("exposureResetBtn").addEventListener("click", () => {
    if (typeof resetVisualExposure === "function") resetVisualExposure();
    else { S.lumAvg = 0; S._lumPrev = null; }
    showAppToast("Auto-Exposure zurückgesetzt.", 2200);
  });
}

function syncExportPolishUI() {
  if (!$("exportPolishOn") || !S.exportPolish) return;
  $("exportPolishOn").checked = !!S.exportPolish.on;
  $("exportPolishSharp").value = Math.round(S.exportPolish.sharpen * 100);
  $("exportPolishSharpVal").textContent = Math.round(S.exportPolish.sharpen * 100);
  $("exportPolishDither").value = Math.round(S.exportPolish.dither * 100);
  $("exportPolishDitherVal").textContent = Math.round(S.exportPolish.dither * 100);
}

function patchVisualPolish() {
  if (!S.exportPolish) S.exportPolish = defaultExportPolish();

  const _drawExportFade = drawExportFade;
  drawExportFade = function (W, H) {
    if (S.exporting) drawExportPolish(W, H);
    _drawExportFade(W, H);
  };

  const _projectData = projectData;
  projectData = function () {
    const d = _projectData();
    d.exportPolish = { ...S.exportPolish };
    return d;
  };

  const _applyProject = applyProject;
  applyProject = function (o, fromScene) {
    _applyProject(o, fromScene);
    if (o.exportPolish) S.exportPolish = { ...defaultExportPolish(), ...o.exportPolish };
    syncExportPolishUI();
  };
}

function initVisualPolish() {
  if (!S.exportPolish) S.exportPolish = defaultExportPolish();
  patchVisualPolish();
  injectExportPolishUI();
  syncExportPolishUI();
}
