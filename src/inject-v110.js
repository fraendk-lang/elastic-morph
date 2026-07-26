/* ============================================================
   v110 — Creator Text (3 Stufen)
   Stufe 1: Titel/Artist + Presets im Creator-Dock
   Stufe 2: Lyrics-Sheet ohne Pro-Modus
   Stufe 3: Auto-Fill + Release-Card-Preset
   ============================================================ */

const CREATOR_TEXT_PRESETS = [
  { id: "untertitel", label: "Untertitel", kind: "lyrics", hint: "Dezent unten — wie Untertitel" },
  { id: "neon-lower", label: "Neon", kind: "text", hint: "Neon Lower Third" },
  { id: "magazine", label: "Poster", kind: "text", hint: "Magazine Cover — groß oben" }
];

function injectCreatorTextStylesV110() {
  if (document.getElementById("creatorTextStylesV110")) return;
  const st = document.createElement("style");
  st.id = "creatorTextStylesV110";
  st.textContent = `
    #creatorTextRow { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:10px; width:100%; }
    #creatorTextRow .cr-text-in { flex:1 1 100px; min-width:90px; max-width:160px; padding:5px 8px; font-size:11px;
      background:var(--panel2); border:1px solid var(--border); border-radius:6px; color:var(--text); }
    #creatorTextRow .cr-text-in:focus { border-color:var(--cyan); outline:none; }
    #creatorTextRow .text-chip.active { border-color:var(--cyan); color:var(--cyan); }
    #creatorLyricsSheet { position:fixed; inset:0; z-index:12000; display:none; align-items:flex-end; justify-content:center;
      background:rgba(0,0,0,.55); backdrop-filter:blur(4px); padding:12px; padding-bottom:max(12px, env(safe-area-inset-bottom)); }
    #creatorLyricsSheet.open { display:flex; }
    #creatorLyricsSheet .cls-card { width:min(520px,100%); max-height:min(78vh,640px); overflow:auto;
      background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px 16px 14px;
      box-shadow:0 12px 40px rgba(0,0,0,.45); }
    #creatorLyricsSheet h3 { margin:0 0 6px; font-size:15px; }
    #creatorLyricsSheet .cls-sub { font-size:11px; color:var(--text-dim); margin-bottom:12px; line-height:1.45; }
    #creatorLyricsSheet textarea { width:100%; min-height:120px; resize:vertical; font-size:12px; padding:10px;
      background:var(--panel2); border:1px solid var(--border); border-radius:8px; color:var(--text); box-sizing:border-box; }
    #creatorLyricsSheet .cls-actions { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
    #creatorLyricsSheet .cls-foot { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    #creatorLyricsSheet .tap-next { margin:8px 0; font-size:11px; }
    #creatorLyricsSheet .cue-list { max-height:140px; overflow:auto; }
    #creatorLyricsEditBtn.on { border-color:var(--cyan); color:var(--cyan); }
  `;
  document.head.appendChild(st);
}

function syncCreatorTextUIV110() {
  const on = document.getElementById("creatorTextOn");
  const title = document.getElementById("creatorTextTitle");
  const artist = document.getElementById("creatorTextArtist");
  if (on && on.checked !== !!S.textShow) on.checked = !!S.textShow;
  if (title && title.value !== (S.textTitle || "")) title.value = S.textTitle || "";
  if (artist && artist.value !== (S.textArtist || "")) artist.value = S.textArtist || "";
  document.querySelectorAll("#creatorTextRow .text-chip").forEach(el => {
    const pid = S.textPresetId || "";
    const lid = S.lyricsPresetId ? "lyrics-" + S.lyricsPresetId : "";
    el.classList.toggle("active", el.dataset.id === pid || el.dataset.id === lid ||
      (el.dataset.id === "untertitel" && lid === "lyrics-untertitel"));
  });
}

function applyCreatorTextPresetV110(id) {
  const p = CREATOR_TEXT_PRESETS.find(x => x.id === id);
  if (!p) return;
  if (p.kind === "lyrics" && typeof applyLyricsStudioPreset === "function") {
    applyLyricsStudioPreset(id);
  } else if (typeof applyTextPreset === "function") {
    applyTextPreset(id);
  }
  S.textShow = true;
  const textShow = $("textShow"); if (textShow) textShow.checked = true;
  syncCreatorTextUIV110();
  if (typeof syncTextPresetUI === "function") syncTextPresetUI();
}

function injectCreatorTextRowV110() {
  if (document.getElementById("creatorTextRow")) return;
  const opts = document.querySelector("#creatorDock .cr-opts");
  if (!opts) return;
  const row = document.createElement("div");
  row.id = "creatorTextRow";
  row.innerHTML =
    '<label class="check" style="font-size:11px"><input type="checkbox" id="creatorTextOn"> Text</label>' +
    '<input type="text" id="creatorTextTitle" class="cr-text-in" placeholder="Titel" maxlength="60">' +
    '<input type="text" id="creatorTextArtist" class="cr-text-in" placeholder="Artist" maxlength="60">' +
    '<span style="font-size:10px;color:var(--text-dim)">Stil:</span>';
  CREATOR_TEXT_PRESETS.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn cr-sm text-chip";
    b.dataset.id = p.id;
    b.textContent = p.label;
    b.title = p.hint || p.label;
    b.style.fontSize = "10px";
    b.addEventListener("click", () => applyCreatorTextPresetV110(p.id));
    row.appendChild(b);
  });
  const releaseBtn = document.createElement("button");
  releaseBtn.type = "button";
  releaseBtn.className = "btn cr-sm";
  releaseBtn.id = "creatorReleaseCardBtn";
  releaseBtn.textContent = "Release";
  releaseBtn.title = "9:16 + Poster-Text — ideal für Reels & Shorts";
  releaseBtn.style.fontSize = "10px";
  releaseBtn.addEventListener("click", () => applyReleaseCardPresetV110());
  row.appendChild(releaseBtn);
  const calm = document.getElementById("creatorCalmRow");
  if (calm) calm.insertAdjacentElement("beforebegin", row);
  else opts.insertAdjacentElement("afterend", row);

  $("creatorTextOn")?.addEventListener("change", e => {
    S.textShow = e.target.checked;
    const textShow = $("textShow"); if (textShow) textShow.checked = e.target.checked;
    if (typeof restartType === "function") restartType();
  });
  $("creatorTextTitle")?.addEventListener("input", e => {
    S.textTitle = e.target.value;
    S.creatorTextUserEdited = true;
    const pro = $("textTitle"); if (pro) pro.value = e.target.value;
    if (typeof restartType === "function") restartType();
  });
  $("creatorTextArtist")?.addEventListener("input", e => {
    S.textArtist = e.target.value;
    S.creatorTextUserEdited = true;
    const pro = $("textArtist"); if (pro) pro.value = e.target.value;
    if (typeof restartType === "function") restartType();
  });
  $("textTitle")?.addEventListener("input", e => {
    S.textTitle = e.target.value;
    syncCreatorTextUIV110();
  }, true);
  $("textArtist")?.addEventListener("input", e => {
    S.textArtist = e.target.value;
    syncCreatorTextUIV110();
  }, true);
  $("textShow")?.addEventListener("change", e => {
    S.textShow = e.target.checked;
    syncCreatorTextUIV110();
  }, true);
}

function injectCreatorLyricsSheetV110() {
  if (document.getElementById("creatorLyricsSheet")) return;
  const sheet = document.createElement("div");
  sheet.id = "creatorLyricsSheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "clsTitle");
  sheet.innerHTML =
    '<div class="cls-card">' +
    '<h3 id="clsTitle">Lyrics — Tap-Sync</h3>' +
    '<p class="cls-sub">Zeilen einfügen (eine pro Zeile), Tap-Sync starten und bei jeder Zeile tippen. Alles bleibt im Creator Mode.</p>' +
    '<textarea id="creatorLyricsText" placeholder="Zeile eins&#10;Zeile zwei&#10;…"></textarea>' +
    '<div class="cls-actions">' +
    '<button type="button" class="btn primary" id="creatorTapStart">▶ Tap-Sync starten</button>' +
    '<button type="button" class="btn" id="creatorTapBtn">Zeile antippen (T)</button>' +
    '<button type="button" class="btn" id="creatorTapUndo">Zurück</button>' +
    '<button type="button" class="btn" id="creatorLrcBtn">📄 .lrc importieren</button>' +
    '</div>' +
    '<div id="creatorTapNext" class="tap-next">Nächste Zeile: —</div>' +
    '<div id="creatorCueList" class="cue-list"></div>' +
    '<div class="cls-foot">' +
    '<button type="button" class="btn" id="creatorLyricsClose">Fertig</button>' +
    '</div></div>';
  document.body.appendChild(sheet);

  $("creatorLyricsClose")?.addEventListener("click", closeCreatorLyricsSheetV110);
  sheet.addEventListener("click", e => { if (e.target === sheet) closeCreatorLyricsSheetV110(); });

  $("creatorLyricsText")?.addEventListener("input", e => {
    const lyr = $("lyrText"); if (lyr) lyr.value = e.target.value;
  });

  $("creatorTapStart")?.addEventListener("click", () => {
    const src = $("creatorLyricsText") || $("lyrText");
    const lyr = $("lyrText"); if (lyr && src) lyr.value = src.value;
    if (typeof tapStart === "function") tapStart();
    updateCreatorTapNextV110();
  });
  $("creatorTapBtn")?.addEventListener("click", () => {
    if (typeof tapOnce === "function") tapOnce();
    updateCreatorTapNextV110();
    renderCreatorCueListV110();
  });
  $("creatorTapUndo")?.addEventListener("click", () => {
    if (typeof tapUndo === "function") tapUndo();
    updateCreatorTapNextV110();
    renderCreatorCueListV110();
  });
  $("creatorLrcBtn")?.addEventListener("click", () => $("lrcInput")?.click());
}

function renderCreatorCueListV110() {
  const host = document.getElementById("creatorCueList");
  if (!host) return;
  host.innerHTML = "";
  S.lyrics.cues.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "cue-row";
    row.innerHTML =
      '<span class="ct">' + (typeof fmtTime === "function" ? fmtTime(c.t) : c.t.toFixed(1) + "s") + '</span>' +
      '<span class="cx"></span>';
    row.querySelector(".cx").textContent = c.text || "♪";
    row.querySelector(".ct").addEventListener("click", () => {
      if (typeof seekSeconds === "function") seekSeconds(c.t);
    });
    host.appendChild(row);
  });
}

function updateCreatorTapNextV110() {
  const el = document.getElementById("creatorTapNext");
  const tp = S.lyrics.tap;
  if (!el || !tp) return;
  el.classList.toggle("active", tp.active);
  if (tp.active && tp.next < tp.lines.length) {
    const ln = (tp.lines[tp.next] || "").trim() || "♪ (Instrumental — tippen)";
    el.innerHTML = "Zeile " + (tp.next + 1) + " / " + tp.lines.length + ": <b>" + ln.replace(/</g, "&lt;") + "</b>";
  } else if (!tp.active && S.lyrics.cues.length) {
    el.textContent = "Fertig — " + S.lyrics.cues.length + " Zeilen getimed";
  } else {
    el.textContent = tp.active ? "Tap-Sync bereit…" : "Nächste Zeile: —";
  }
}

function openCreatorLyricsSheetV110() {
  injectCreatorLyricsSheetV110();
  const sheet = document.getElementById("creatorLyricsSheet");
  const ta = document.getElementById("creatorLyricsText");
  const lyr = $("lyrText");
  if (ta && lyr) ta.value = lyr.value;
  renderCreatorCueListV110();
  updateCreatorTapNextV110();
  if (sheet) sheet.classList.add("open");
  const editBtn = document.getElementById("creatorLyricsEditBtn");
  if (editBtn) editBtn.classList.add("on");
}

function closeCreatorLyricsSheetV110() {
  const sheet = document.getElementById("creatorLyricsSheet");
  if (sheet) sheet.classList.remove("open");
  const editBtn = document.getElementById("creatorLyricsEditBtn");
  if (editBtn) editBtn.classList.remove("on");
  const ta = document.getElementById("creatorLyricsText");
  const lyr = $("lyrText");
  if (ta && lyr) lyr.value = ta.value;
  renderCreatorCueListV110();
}

function patchCreatorLyricsRowV110() {
  const row = document.getElementById("creatorLyricsRow");
  if (!row || row.dataset.v110 === "1") return;
  row.dataset.v110 = "1";

  row.querySelectorAll(".lyr-preset").forEach(b => {
    const id = b.dataset.id;
    const nb = b.cloneNode(true);
    b.replaceWith(nb);
    nb.addEventListener("click", () => {
      if (typeof applyLyricsStudioPreset === "function") applyLyricsStudioPreset(id);
      S.lyrics.on = true;
      S.textShow = true;
      const lyrOn = $("lyrOn"); if (lyrOn) lyrOn.checked = true;
      const crOn = $("creatorLyricsOn"); if (crOn) crOn.checked = true;
      const textShow = $("textShow"); if (textShow) textShow.checked = true;
      syncCreatorTextUIV110();
      if (typeof showAppToast === "function") showAppToast("Lyrics-Stil: " + nb.textContent, 2200);
    });
  });

  if (!document.getElementById("creatorLyricsEditBtn")) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn cr-sm";
    editBtn.id = "creatorLyricsEditBtn";
    editBtn.textContent = "Bearbeiten…";
    editBtn.title = "Lyrics einfügen & Tap-Sync — ohne Pro-Modus";
    editBtn.style.fontSize = "10px";
    editBtn.addEventListener("click", () => openCreatorLyricsSheetV110());
    const line = document.getElementById("creatorLyricsLine");
    if (line) line.insertAdjacentElement("beforebegin", editBtn);
    else row.appendChild(editBtn);
  }
}

function parseTitleArtistFromFilenameV110(name) {
  const base = String(name || "").replace(/\.[^.]+$/, "").trim();
  if (!base) return { title: "", artist: "" };
  const m = base.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { title: base, artist: "" };
}

function applyCreatorTrackMetaV110(meta) {
  if (!meta) return;
  if (S.creatorTextUserEdited) return;
  const title = (meta.title || "").trim();
  const artist = (meta.artist || "").trim();
  if (!title && !artist) return;
  if (!S.textTitle && title) S.textTitle = title;
  if (!S.textArtist && artist) S.textArtist = artist;
  const proT = $("textTitle"); if (proT) proT.value = S.textTitle;
  const proA = $("textArtist"); if (proA) proA.value = S.textArtist;
  syncCreatorTextUIV110();
}

function patchLoadFileAutoFillV110() {
  const _loadFile = loadFile;
  loadFile = function (file) {
    const r = _loadFile(file);
    if (!file) return r;
    if (!S.creatorTextUserEdited) {
      const parsed = parseTitleArtistFromFilenameV110(file.name);
      if (!S.textTitle && parsed.title) S.textTitle = parsed.title;
      if (!S.textArtist && parsed.artist) S.textArtist = parsed.artist;
      if (typeof demoTrackMeta !== "undefined" && demoTrackMeta && demoTrackMeta.source === "bundled") {
        applyCreatorTrackMetaV110(demoTrackMeta);
      }
      const proT = $("textTitle"); if (proT) proT.value = S.textTitle;
      const proA = $("textArtist"); if (proA) proA.value = S.textArtist;
      syncCreatorTextUIV110();
    }
    return r;
  };
}

function applyReleaseCardPresetV110() {
  if (typeof setCreatorFormat === "function") setCreatorFormat(9, 16);
  applyCreatorTextPresetV110("magazine");
  S.textShow = true;
  const on = document.getElementById("creatorTextOn"); if (on) on.checked = true;
  const textShow = $("textShow"); if (textShow) textShow.checked = true;
  syncCreatorTextUIV110();
  if (typeof showAppToast === "function") {
    showAppToast("Release Card: 9:16 + Poster-Text — jetzt ● Direkt Export", 4200);
  }
}

function patchLyricsTapHooksV110() {
  if (typeof updateTapNext !== "function") return;
  const _updateTapNext = updateTapNext;
  updateTapNext = function () {
    _updateTapNext();
    updateCreatorTapNextV110();
  };
  const _renderCueList = renderCueList;
  renderCueList = function () {
    _renderCueList();
    renderCreatorCueListV110();
  };
}

function initCreatorTextV110() {
  if (S.creatorTextUserEdited == null) S.creatorTextUserEdited = false;
  injectCreatorTextStylesV110();
  injectCreatorTextRowV110();
  injectCreatorLyricsSheetV110();
  patchCreatorLyricsRowV110();
  patchLoadFileAutoFillV110();
  patchLyricsTapHooksV110();
  syncCreatorTextUIV110();
}
