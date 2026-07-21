/* ============================================================
   v59 — Creator Mode (3-step flow) + brand-aligned UI helpers
   Canvas stays visible; controls live in a bottom dock only.
   ============================================================ */

const UI_MODE_LS = "elasticMorph.uiMode";

function applyPreset(p) {
  S.preset = p;
  S.blendWith = null;
  S.blendAmt = 0;
  document.querySelectorAll("#presetGrid .preset-card").forEach((c, i) =>
    c.classList.toggle("active", PRESETS[i] === p));
  if ($("blendSelect")) $("blendSelect").value = "";
  if ($("blendAmt")) { $("blendAmt").value = 0; if ($("blendVal")) $("blendVal").textContent = "0%"; }
  updateBadge();
  spawnParticles();
  drawDnaFingerprintPreview();
  updateCreatorDock();
}

function applyFirstSmartLook() {
  if (!S.energyCurve || !S.energyCurve.length) return;
  const picks = suggestSmartLooks();
  if (picks[0]) applyPreset(picks[0]);
}

function enterCreatorView() {
  /* Studio = no overlay page — the visual stays on the main canvas */
  setMode("studio");
}

function setCreatorFormat(w, h) {
  S.aspect = [w, h];
  document.querySelectorAll("#creatorFormats .cr-fmt").forEach(b =>
    b.classList.toggle("active", +b.dataset.w === w && +b.dataset.h === h));
  document.querySelectorAll("#fmtRow .fmt").forEach(f => {
    const m = +f.dataset.w === w && +f.dataset.h === h && !f.dataset.canvas && !f.dataset.loop;
    f.classList.toggle("active", m);
  });
  resize();
}

function setUiMode(mode) {
  S.uiMode = mode === "pro" ? "pro" : "creator";
  try { localStorage.setItem(UI_MODE_LS, S.uiMode); } catch (e) { }
  const app = $("app");
  if (app) app.classList.toggle("creator-mode", S.uiMode === "creator");
  const btn = $("uiModeBtn");
  if (btn) btn.textContent = S.uiMode === "creator" ? "Pro-Modus →" : "← Creator";
  if (S.uiMode === "creator") enterCreatorView();
  else setMode("studio");
  updateCreatorDock();
}

function updateCreatorDock() {
  const dock = $("creatorDock");
  if (!dock || S.uiMode !== "creator") return;
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  const step = !hasTrack ? 1 : (S.preset ? 3 : 2);
  dock.querySelectorAll(".cr-step").forEach(el => {
    const n = +el.dataset.step;
    el.classList.toggle("done", n < step);
    el.classList.toggle("on", n === step);
  });
  const looks = $("creatorLooks");
  if (looks) {
    looks.innerHTML = "";
    if (!hasTrack) {
      looks.innerHTML = '<span class="cr-hint">Track laden — das Visual erscheint sofort im Canvas darüber.</span>';
    } else if (S.energyCurve) {
      suggestSmartLooks().forEach((p, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cr-look" + (S.preset === p ? " active" : "") + (i === 0 ? " rec" : "");
        b.innerHTML = `<b>${p.name}</b><small>${(p.engine || "blob").toUpperCase()}</small>`;
        b.addEventListener("click", () => applyPreset(p));
        looks.appendChild(b);
      });
    } else {
      looks.innerHTML = '<span class="cr-hint">Analysiere Track…</span>';
    }
  }
  const exp = $("creatorExport");
  if (exp) exp.disabled = !hasTrack;
}

function initCreatorMode() {
  try { S.uiMode = localStorage.getItem(UI_MODE_LS) || "creator"; } catch (e) { S.uiMode = "creator"; }
  setUiMode(S.uiMode);
  $("creatorUpload")?.addEventListener("click", () => $("fileInput").click());
  /* creatorExport → initPhaseA (v63) */
  $("creatorMoreBtn")?.addEventListener("click", () => {
    setUiMode("pro");
    setMode("creator");
  });
  $("uiModeBtn")?.addEventListener("click", () => setUiMode(S.uiMode === "creator" ? "pro" : "creator"));
  $("uiModePro")?.addEventListener("click", () => setUiMode("pro"));
  $("creatorDockToggle")?.addEventListener("click", () => {
    $("app")?.classList.toggle("creator-dock-collapsed");
    if (typeof updateDockToggleLabel === "function") updateDockToggleLabel();
  });
  document.querySelectorAll("#creatorFormats .cr-fmt").forEach(b => {
    b.addEventListener("click", () => setCreatorFormat(+b.dataset.w, +b.dataset.h));
  });
  updateCreatorDock();
}
