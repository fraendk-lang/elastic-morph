/* ============================================================
   v108 — Creator Export UX: step 3 actionable + visible CTA
   9:16 portrait dock scroll hid the HQ Export button.
   ============================================================ */

function injectCreatorExportCTAStyles() {
  if (document.getElementById("creatorExportCTAStyles")) return;
  const s = document.createElement("style");
  s.id = "creatorExportCTAStyles";
  s.textContent = `
    .cr-export-cta {
      display: none; flex-direction: column; gap: 6px; margin-bottom: 12px;
      padding: 10px 12px; border-radius: 12px;
      background: rgba(177,75,255,.08); border: 1px solid rgba(177,75,255,.25);
    }
    .cr-export-cta .btn.primary { flex: 1; font-size: 13px; padding: 12px 16px; }
    .cr-export-btns { display: flex; gap: 8px; width: 100%; }
    .cr-export-btns .btn { flex: 1; }
    .cr-export-hint { font-size: 10px; color: var(--text-dim); text-align: center; }
    .cr-step[role="button"] { cursor: pointer; }
    .cr-step[role="button"]:hover { border-color: var(--accent); color: var(--text); }
    .cr-step.on[role="button"]:hover { filter: brightness(1.05); }
  `;
  document.head.appendChild(s);
}

function ensureCreatorExportCTA() {
  const row = $("creatorExportCTA");
  if (!row || row.dataset.v108) return;
  row.dataset.v108 = "1";
  row.removeAttribute("hidden");
  $("creatorExportCTAQuick")?.addEventListener("click", () => runCreatorQuickExport?.() || $("creatorExport")?.click());
  $("creatorExportCTAHQ")?.addEventListener("click", () => runCreatorHQExport?.() || $("creatorExportHQ")?.click());
}

function triggerCreatorStep(step) {
  if (step === 1) {
    $("fileInput")?.click();
    return;
  }
  if (step === 2) {
    $("creatorLooks")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showAppToast("Look wählen — Karte antippen oder am Canvas wischen.", 3800);
    return;
  }
  if (step === 3) {
    if (typeof runCreatorQuickExport === "function") {
      runCreatorQuickExport();
      return;
    }
    const cta = $("creatorExportCTAQuick") || $("creatorExport");
    if (cta && !cta.disabled) {
      cta.click();
      return;
    }
    const exp = $("creatorExport");
    if (exp && !exp.disabled) {
      exp.click();
      return;
    }
    showAppToast("Export — zuerst Track laden und Look wählen.", 3500);
  }
}

function wireCreatorSteps() {
  document.querySelectorAll("#creatorDock .cr-step").forEach(el => {
    if (el.dataset.v108) return;
    el.dataset.v108 = "1";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.title = el.dataset.step === "3"
      ? "Export starten"
      : (el.dataset.step === "2" ? "Look wählen" : "Track laden");
    const go = () => triggerCreatorStep(+el.dataset.step);
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });
}

function syncCreatorExportCTA() {
  const hasTrack = !!(S.audioBuffer || audioEl.src || S.micMode);
  const step = !hasTrack ? 1 : (S.preset ? 3 : 2);
  const cta = $("creatorExportCTA");
  if (cta) cta.style.display = step >= 3 && hasTrack ? "flex" : "none";
  if (typeof syncCreatorExportButtons === "function") syncCreatorExportButtons();
}

function patchCreatorExportUX() {
  injectCreatorExportCTAStyles();
  ensureCreatorExportCTA();
  wireCreatorSteps();
  const _update = updateCreatorDock;
  updateCreatorDock = function () {
    _update();
    syncCreatorExportCTA();
  };
  updateCreatorDock();
}

function initCreatorExportUXV108() {
  patchCreatorExportUX();
}
