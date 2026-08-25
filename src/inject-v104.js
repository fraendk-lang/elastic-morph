/* ============================================================
   v104 — Lyrics Studio: Flow, DE, Presets, Creator-Dock
   ============================================================ */

const LYRICS_STUDIO_PRESETS = [
  {
    id: "karaoke", name: "Karaoke", textPresetId: "karaoke",
    hint: "Groß, unten — Karaoke-Wipe"
  },
  {
    id: "untertitel", name: "Untertitel",
    show: true, pos: "bc", font: "sans", color: "white", anim: "fade", size: 0.92,
    style: "fill", plate: true, shadow: true, lower: false, circle: false,
    upper: false, weight: "500", track: 1, blend: "source-over", plateOpacity: 0.58,
    hint: "Dezent unten — wie Untertitel"
  },
  {
    id: "poster", name: "Poster",
    show: true, pos: "c", font: "poster", color: "white", anim: "breathe", size: 1.48,
    style: "outline", plate: false, shadow: true, lower: false, circle: false,
    upper: false, weight: "900", track: 2, blend: "source-over",
    hint: "Eine Zeile, viel Luft in der Mitte"
  }
];

function applyLyricsStudioPreset(id) {
  const p = LYRICS_STUDIO_PRESETS.find(x => x.id === id);
  if (!p) return;
  if (p.textPresetId && typeof applyTextPreset === "function") {
    applyTextPreset(p.textPresetId);
  } else {
    S.textShow = !!p.show;
    S.textPos = p.pos || "bc";
    S.textFont = p.font || "sans";
    S.textColor = p.color || "white";
    S.textAnim = p.anim || "fade";
    S.textSize = p.size != null ? p.size : 1;
    S.textStyle = p.style || "fill";
    S.textPlate = !!p.plate;
    S.textShadow = !!p.shadow;
    S.textLower = !!p.lower;
    S.textPattern = p.pattern || (p.circle ? "circle" : "straight");
    S.textUpper = !!p.upper;
    S.textWeight = p.weight || "auto";
    S.textTrack = p.track != null ? p.track : 0;
    S.textBlend = p.blend || "source-over";
    if (p.plateOpacity != null) S.textPlateOpacity = p.plateOpacity;
    S.textPresetId = "lyrics-" + id;
    if (typeof syncTextPresetUI === "function") syncTextPresetUI();
    if (typeof restartType === "function") restartType();
  }
  S.lyrics.on = true;
  S.textShow = true;
  const lyrOn = $("lyrOn"); if (lyrOn) lyrOn.checked = true;
  const textShow = $("textShow"); if (textShow) textShow.checked = true;
  S.lyricsPresetId = id;
  syncLyricsPresetUI();
  if (typeof showAppToast === "function") showAppToast("Lyrics: " + p.name, 2400);
}

function syncLyricsPresetUI() {
  document.querySelectorAll(".lyr-preset").forEach(el => {
    el.classList.toggle("active", el.dataset.id === S.lyricsPresetId);
  });
  const cr = document.querySelectorAll("#creatorLyricsRow .lyr-preset");
  cr.forEach(el => el.classList.toggle("active", el.dataset.id === S.lyricsPresetId));
}

function germanizeLyricsPage() {
  const page = document.getElementById("page-lyrics");
  if (!page || page.dataset.lyricsDe === "1") return;
  page.dataset.lyricsDe = "1";
  const set = (sel, text) => { const el = page.querySelector(sel); if (el) el.textContent = text; };
  set("h2", "Lyrics Studio");
  const sub = page.querySelector(".sub");
  if (sub) sub.textContent = "Text synchron zum Song — ein Flow: einfügen, timen, Stil wählen, exportieren.";
  const lyrChk = $("lyrOn");
  if (lyrChk && lyrChk.parentElement && lyrChk.parentElement.tagName === "LABEL") {
    const lbl = lyrChk.parentElement;
    let hasText = false;
    lbl.childNodes.forEach(n => {
      if (n.nodeType === 3) { n.textContent = " Text auf dem Canvas anzeigen"; hasText = true; }
    });
    if (!hasText) lbl.appendChild(document.createTextNode(" Text auf dem Canvas anzeigen"));
  }
  set("#lrcBtn", "📄 .lrc importieren");
  const note = page.querySelector(".lyr-col .note");
  if (note) note.textContent = "…oder Zeilen unten einfügen (eine pro Zeile), dann Tap-Sync starten.";
  set("#tapStartBtn", "▶ Tap-Sync starten");
  set("#tapBtn", "Zeile antippen (T)");
  set("#tapUndoBtn", "Zurück");
  set("#cueClearBtn", "Alle Cues löschen");
  const offLbl = page.querySelector(".slider-row label");
  if (offLbl) offLbl.childNodes[0].textContent = "Sync-Offset ";
  const h3s = page.querySelectorAll(".lyr-col h3");
  if (h3s[0]) h3s[0].textContent = "Import / Schreiben";
  if (h3s[1]) h3s[1].textContent = "Tap-Sync";
  if (h3s[2]) h3s[2].textContent = "Cues";
  const tapNote = page.querySelectorAll(".lyr-col .note")[1];
  if (tapNote) tapNote.innerHTML = "Auf <b>Start</b> tippen — der Track läuft von vorn. Bei jeder Zeile <b>T</b> oder den Button drücken.";
}

function injectLyricsPresetRow() {
  const page = document.getElementById("page-lyrics");
  if (!page || document.getElementById("lyricsPresetRow")) return;
  const chk = page.querySelector("#lyrOn");
  if (!chk || !chk.parentElement) return;
  const row = document.createElement("div");
  row.id = "lyricsPresetRow";
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px;max-width:900px";
  row.innerHTML = '<span style="font-size:11px;color:var(--text-dim)">Stil:</span>';
  LYRICS_STUDIO_PRESETS.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn lyr-preset";
    b.dataset.id = p.id;
    b.title = p.hint || p.name;
    b.textContent = p.name;
    b.addEventListener("click", () => applyLyricsStudioPreset(p.id));
    row.appendChild(b);
  });
  chk.parentElement.insertAdjacentElement("afterend", row);

  const preview = document.createElement("div");
  preview.id = "lyricsLivePreview";
  preview.className = "tap-next";
  preview.style.marginBottom = "14px";
  preview.style.maxWidth = "900px";
  preview.innerHTML = '<span style="color:var(--text-dim)">Live:</span> <b id="lyricsLiveLine">—</b>';
  row.insertAdjacentElement("afterend", preview);
}

function injectCreatorLyricsRow() {
  if (document.getElementById("creatorLyricsRow")) return;
  const calm = document.getElementById("creatorCalmRow");
  const anchor = calm || document.querySelector("#creatorDock .cr-opts");
  if (!anchor) return;
  const row = document.createElement("div");
  row.id = "creatorLyricsRow";
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;width:100%";
  row.innerHTML =
    '<label class="check" style="font-size:11px"><input type="checkbox" id="creatorLyricsOn"> Lyrics</label>' +
    '<span style="font-size:10px;color:var(--text-dim)">Stil:</span>';
  LYRICS_STUDIO_PRESETS.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn cr-sm lyr-preset";
    b.dataset.id = p.id;
    b.textContent = p.name;
    b.title = p.hint || p.name;
    b.style.fontSize = "10px";
    b.addEventListener("click", () => {
      applyLyricsStudioPreset(p.id);
      if (typeof setUiMode === "function" && S.uiMode !== "pro") setUiMode("pro");
      if (typeof setMode === "function") setMode("lyrics");
    });
    row.appendChild(b);
  });
  const line = document.createElement("span");
  line.id = "creatorLyricsLine";
  line.style.cssText = "font-size:10px;color:var(--text-dim);flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  line.textContent = "—";
  row.appendChild(line);
  anchor.insertAdjacentElement("afterend", row);

  $("creatorLyricsOn")?.addEventListener("change", e => {
    S.lyrics.on = e.target.checked;
    S.textShow = e.target.checked;
    const lyrOn = $("lyrOn"); if (lyrOn) lyrOn.checked = e.target.checked;
    const textShow = $("textShow"); if (textShow) textShow.checked = e.target.checked;
  });
}

function updateLyricsLivePreview() {
  const { line } = currentLyric();
  const txt = line && line.text ? line.text : "—";
  const live = document.getElementById("lyricsLiveLine");
  if (live && live.textContent !== txt) live.textContent = txt;
  const cr = document.getElementById("creatorLyricsLine");
  if (cr) {
    const short = S.lyrics.on && line ? txt : (S.lyrics.cues.length ? "Lyrics bereit" : "—");
    if (cr.textContent !== short) cr.textContent = short;
  }
  const crOn = document.getElementById("creatorLyricsOn");
  if (crOn && crOn.checked !== !!S.lyrics.on) crOn.checked = !!S.lyrics.on;
}

function patchLyricsCueList() {
  renderCueList = function () {
    const host = $("cueList"); if (!host) return;
    host.innerHTML = "";
    S.lyrics.cues.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "cue-row";
      row.innerHTML =
        '<span class="ct" title="Springen">' + fmtTime(c.t) + '</span>' +
        '<span class="cx"></span>' +
        '<span class="cn" title="0,25 s früher" style="cursor:pointer;padding:0 3px;color:var(--text-dim)">◀</span>' +
        '<span class="cp" title="0,25 s später" style="cursor:pointer;padding:0 3px;color:var(--text-dim)">▶</span>' +
        '<span class="cd" title="Löschen">×</span>';
      row.querySelector(".cx").textContent = c.text || "♪";
      row.querySelector(".ct").addEventListener("click", () => seekSeconds(c.t));
      row.querySelector(".cn").addEventListener("click", e => {
        e.stopPropagation();
        c.t = Math.max(0, +(c.t - 0.25).toFixed(3));
        renderCueList();
      });
      row.querySelector(".cp").addEventListener("click", e => {
        e.stopPropagation();
        c.t = +(c.t + 0.25).toFixed(3);
        renderCueList();
      });
      row.querySelector(".cd").addEventListener("click", () => {
        S.lyrics.cues.splice(i, 1);
        renderCueList();
      });
      host.appendChild(row);
    });
    lastCueHL = -2;
  };
}

function patchLyricsFlow() {
  patchLyricsCueList();

  const _updateTapNext = updateTapNext;
  updateTapNext = function () {
    _updateTapNext();
    const tp = S.lyrics.tap, el = $("tapNext");
    if (!el || !tp.active) return;
    if (tp.active && tp.next < tp.lines.length) {
      const ln = (tp.lines[tp.next] || "").trim() || "♪ (Instrumental — tippen zum Markieren)";
      el.innerHTML = "Zeile " + (tp.next + 1) + " / " + tp.lines.length + ": <b>" + ln.replace(/</g, "&lt;") + "</b>";
    } else if (!tp.active && S.lyrics.cues.length) {
      el.textContent = "Fertig — " + S.lyrics.cues.length + " Zeilen getimed";
    }
  };

  const _tapStart = tapStart;
  tapStart = function () {
    const lines = $("lyrText").value.split(/\r?\n/);
    if (lines.every(l => !l.trim())) {
      if (typeof showAppToast === "function") showAppToast("Zuerst Zeilen einfügen (eine pro Zeile)", 3200);
      else alert("Zuerst Zeilen einfügen (eine pro Zeile).");
      return;
    }
    _tapStart();
    if (!S.lyricsPresetId) applyLyricsStudioPreset("untertitel");
  };

  const lrcInput = $("lrcInput");
  if (lrcInput) {
    lrcInput.addEventListener("change", () => {
      setTimeout(() => {
        if (S.lyrics.cues.length && !S.lyricsPresetId) applyLyricsStudioPreset("untertitel");
      }, 0);
    }, true);
  }

  const _updateUI = updateUI;
  updateUI = function () {
    _updateUI();
    updateLyricsLivePreview();
  };
}

function initLyricsStudioV104() {
  if (S.lyricsPresetId == null) S.lyricsPresetId = "";
  germanizeLyricsPage();
  injectLyricsPresetRow();
  injectCreatorLyricsRow();
  patchLyricsFlow();
  updateTapNext();
}
