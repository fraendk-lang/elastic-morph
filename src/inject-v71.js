/* ============================================================
   v71 — Scene bank fix: B/C/D save + localStorage quota guard
   ============================================================ */

const SCENE_LABELS = ["A", "B", "C", "D"];

function normalizeScenes(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let i = 0; i < 4; i++) {
    const slot = raw[i] ?? raw[String(i)];
    if (slot && slot.app === "ElasticMorph") out[i] = slot;
  }
  return out;
}

function sceneSnapshot() {
  const d = projectData();
  delete d.cues;
  delete d.setActive;
  if (d.image) d.image = { ...d.image, src: null };
  if (d.image2) d.image2 = { ...d.image2, src: null };
  return d;
}

function persistScenes(all) {
  const normalized = normalizeScenes(all);
  const json = JSON.stringify(normalized);
  localStorage.setItem(SCENES_LS, json);
  return normalized;
}

function patchSceneBank() {
  loadScenes = function () {
    try { return normalizeScenes(JSON.parse(localStorage.getItem(SCENES_LS))); } catch (e) { return {}; }
  };

  saveScene = function (i) {
    const idx = i | 0;
    if (idx < 0 || idx > 3) return;
    const all = loadScenes();
    const snap = sceneSnapshot();
    all[idx] = snap;
    try {
      persistScenes(all);
      showAppToast(`Szene ${SCENE_LABELS[idx]} gespeichert.`, 2800);
    } catch (e) {
      try {
        if (snap.image) snap.image.src = null;
        if (snap.image2) snap.image2.src = null;
        all[idx] = snap;
        persistScenes(all);
        showAppToast(`Szene ${SCENE_LABELS[idx]} gespeichert (ohne Bilddaten — Speicherlimit).`, 5200);
      } catch (e2) {
        console.error("Scene save failed:", e2);
        showAppToast(`Szene ${SCENE_LABELS[idx]} konnte nicht gespeichert werden — localStorage voll?`, 6000);
      }
    }
    renderScenes();
  };

  recallScene = function (i) {
    const all = loadScenes();
    const idx = i | 0;
    if (all[idx]) applyProject(all[idx], true);
  };

  renderScenes = function () {
    const host = $("sceneBank");
    if (!host) return;
    const all = loadScenes();
    host.innerHTML = "";
    SCENE_LABELS.forEach((label, i) => {
      const filled = !!all[i];
      const row = document.createElement("div");
      row.className = "scene-row";
      row.innerHTML = `<span class="sname">${label}</span>
        <button type="button" class="btn scene-recall${filled ? "" : " empty"}">${filled ? "Recall" : "—"}</button>
        <button type="button" class="btn scene-save">Save</button>`;
      const recall = row.querySelector(".scene-recall");
      recall.addEventListener("click", () => { if (all[i]) recallScene(i); });
      row.querySelector(".scene-save").addEventListener("click", () => saveScene(i));
      host.appendChild(row);
    });
  };

  try {
    const raw = JSON.parse(localStorage.getItem(SCENES_LS) || "null");
    const all = normalizeScenes(raw);
    let changed = false;
    for (const k of Object.keys(all)) {
      const s = all[k];
      if (s.image?.src) { s.image.src = null; changed = true; }
      if (s.image2?.src) { s.image2.src = null; changed = true; }
      if (s.cues) { delete s.cues; changed = true; }
    }
    if (changed || raw !== null) persistScenes(all);
  } catch (e) { /* keep existing slots if migration fails */ }

  renderScenes();
}

function initSceneBank() {
  patchSceneBank();
}
