# Stem Separation Integration (Part A) — Design

## Problem

Elastic Morph's audio reactivity is driven entirely by FFT frequency bands
(`S.bands.subBass/bass/lowMid/mid/highMid/air`, computed in
`updateAudioFeatures()`). A hi-hat and a sung "sss" sibilant both land in the
same high-frequency band even though they come from completely different
instruments — frequency-band analysis can't tell them apart. True source
separation (isolated vocals/drums/bass/other stems) is a categorically
different, richer signal: it's the single most differentiating technical
feature among the visualizer competitors researched (only Neural Frames, a
$39-66/month tool, has anything comparable), and Frank already owns the
infrastructure for it — Elastic Split, a Demucs v4 stem-separation service on
Railway (`elastic-split-api-production.up.railway.app`), already live and
serving `/tools/split` on elasticuniverse.app.

This spec covers **Part A only**: getting stems fetched, analyzed, and
available as data, with a visible Simple/Advanced mode toggle. **Part B**
(wiring the stem data into actual visual parameters — vocals→color,
drums→camera, etc.) is a separate follow-up spec, mirroring how Frequency
Band Reactivity shipped in two rounds (instrumentation, then routing).

## Goals

- Let the user switch between **Simple** (current frequency-band analysis,
  unchanged) and **Advanced** (stem-separated analysis) for the currently
  loaded track.
- Advanced triggers stem separation **only when the user switches to it** —
  never automatically on track load — to avoid loading the shared Railway
  backend for users who never try it.
- Once stems are ready, expose them as per-stem energy-over-time data
  (`S.stemCurves`), reusing the app's existing offline energy-curve pattern
  (`S.energyCurve`) rather than inventing new live-audio-graph machinery.
- Survive a page reload while a job is in flight (resume polling, don't
  resubmit).
- Discard results that no longer match the currently loaded track (user
  switched tracks while a job was running).

## Non-Goals

- **Any visual reactivity change.** Selecting Advanced in this round changes
  no rendered output — it only gets the data ready. Part B wires it up.
- **Automatic/background stem separation on every track load.** Confirmed
  explicitly: lazy, on-toggle only.
- **Playable/soloed stem audio** (e.g. "preview just the vocals"). Would
  require keeping full decoded `AudioBuffer`s per stem in memory for a
  feature nobody asked for — YAGNI. If wanted later, it's a cheap addition
  on top of this design (the stems are already downloaded and decoded; only
  the decoded buffers themselves aren't currently retained past curve
  computation).
- **Changes to the Elastic Split backend itself.** It already works
  correctly for realistic file sizes — verified live with a 42MB/4-minute
  test file (previously-tracked "large file" backlog concern did not
  reproduce). CORS for `elasticmorph.app` was verified and enabled on
  Elastic Split's Railway `ALLOWED_ORIGINS` env var as a prerequisite,
  outside this repo.

## Design

### 1. API client

Three new functions, calling the verified live API
(`https://elastic-split-api-production.up.railway.app`, no auth):

```js
const STEM_API_BASE = "https://elastic-split-api-production.up.railway.app";

async function submitStemJob(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", "4stems");
  const res = await fetch(`${STEM_API_BASE}/split`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Stem-Trennung: Server antwortete mit " + res.status);
  return res.json(); // { job_id, status: "processing" }
}

async function pollStemJobStatus(jobId) {
  const res = await fetch(`${STEM_API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Job nicht gefunden oder abgelaufen.");
  return res.json(); // { job_id, status, progress? } or { ..., status:"completed", stems:[...] }
}

async function downloadStem(jobId, stemName) {
  const res = await fetch(`${STEM_API_BASE}/download/${jobId}/${stemName}?format=wav`);
  if (!res.ok) throw new Error("Download fehlgeschlagen: " + stemName);
  return res.arrayBuffer();
}
```

Verified live response shapes (real requests against production, not
assumed from docs): `POST /split` → `{"job_id":"...","status":"processing"}`;
`GET /status/{id}` while running →
`{"job_id":"...","status":"processing","progress":"Separating on CPU… 0:45 elapsed (can take 15–30 min)"}`;
on completion → `{"job_id":"...","status":"completed","stems":["other","bass","vocals","drums"],"duration":66.6}`;
unknown/expired job → 404 `{"detail":"Job not found or expired."}`. Real-world
timing for a realistic 4-minute track: ~67 seconds (the API's own "15–30 min"
message is a conservative worst-case warning, not the typical case — plan the
UI copy around "can take a minute or two," not the API's own wording).

### 2. State

```js
S.stemMode = "simple";   // "simple" | "advanced"
S.stemJob = null;        // { id, status, progress, error, trackHash }
                          // status: "submitting" | "processing" | "downloading" | "analyzing" | "ready" | "error"
S.stemCurves = null;     // null | { bass, drums, vocals, other } — each a Float32Array(240), same shape as S.energyCurve
```

`trackHash` on the job is `S.fpHash` (the deterministic per-track fingerprint
`analyzeTrack()` already computes) — this is how a stale/mismatched job
result gets detected and discarded.

### 3. Reuse the existing energy-curve computation

`analyzeTrack()` (`elastic-morph.html:3170-3202`) currently computes its
240-window RMS energy curve inline. Extract that into:

```js
function computeEnergyCurve(channelData, N = 240) {
  const win = Math.max(1, Math.floor(channelData.length / N));
  let curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0, c = 0;
    const o = i * win;
    for (let j = 0; j < win; j += 16) { const v = channelData[o + j] || 0; s += v * v; c++; }
    curve[i] = Math.sqrt(s / c);
  }
  const sm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const idx = i + k; if (idx >= 0 && idx < N) { s += curve[idx]; c++; } }
    sm[i] = s / c;
  }
  const mx = Math.max(...sm) || 1;
  for (let i = 0; i < N; i++) sm[i] /= mx;
  return sm;
}
```

`analyzeTrack()` calls this instead of its inline copy (`S.energyCurve =
computeEnergyCurve(ch)`) — behavior-identical, now reusable. The stem job
handler (§4) calls the same function once per decoded stem.

### 4. Two ways a track gets loaded, and why it matters here

`loadFile(file)` (`elastic-morph.html:9266`) handles real uploads — `file` is
a genuine `File`. The bundled demo track instead goes through
`analyzeTrackFromUrl(url, name)` (`elastic-morph.html:16143`), which builds a
**duck-typed stand-in** — `{ name, arrayBuffer: () => fetchDemoBytes(url) }`
— not a real `Blob`/`File`. `FormData.append("file", ...)` needs a real
Blob/File, so this stand-in can't be passed to `submitStemJob()` directly.

Fix: both entry points record how the track arrived, and stem submission
resolves a real File lazily, only when actually needed:

```js
// in loadFile(file), alongside the existing S.energyCurve = null etc. reset:
S.currentAudioFile = file;
S.currentDemoUrl = null;

// in analyzeTrackFromUrl(url, name), before calling analyzeTrack(fake):
S.currentAudioFile = null;
S.currentDemoUrl = url;
S.currentDemoName = name;

async function resolveAudioFileForStemJob() {
  if (S.currentAudioFile) return S.currentAudioFile;
  if (S.currentDemoUrl) {
    const ab = await fetchDemoBytes(S.currentDemoUrl);
    if (!ab) throw new Error("Demo-Track konnte nicht geladen werden.");
    return new File([ab], S.currentDemoName || "demo.mp3", { type: "audio/mpeg" });
  }
  throw new Error("Kein Track geladen.");
}
```

`fetchDemoBytes()` always re-fetches over the network (no caching, by
design in the existing code) — an acceptable small extra download once, only
when the user actually opts into Advanced for the demo track.

### 5. Job lifecycle

```js
const STEM_JOB_LS = "elasticMorph.stemJob"; // {trackHash, jobId, submittedAt}

async function startStemSeparation() {
  const trackHash = S.fpHash;
  if (S.stemJob && S.stemJob.trackHash === trackHash && S.stemJob.status !== "error") return; // already running/done for this track — retry only after a prior error
  S.stemJob = { id: null, status: "submitting", progress: "", error: null, trackHash };
  syncStemUI();
  try {
    const file = await resolveAudioFileForStemJob();
    const { job_id } = await submitStemJob(file);
    S.stemJob.id = job_id;
    S.stemJob.status = "processing";
    try { localStorage.setItem(STEM_JOB_LS, JSON.stringify({ trackHash, jobId: job_id, submittedAt: Date.now() })); } catch (e) { }
    syncStemUI();
    pollStemJobLoop(job_id, trackHash);
  } catch (err) {
    failStemJob(trackHash, err.message);
  }
}

function pollStemJobLoop(jobId, trackHash) {
  setTimeout(async () => {
    if (!S.stemJob || S.stemJob.trackHash !== trackHash) return; // superseded by a track change — drop silently
    try {
      const st = await pollStemJobStatus(jobId);
      if (st.status === "completed") {
        S.stemJob.status = "downloading"; syncStemUI();
        await downloadAndAnalyzeStems(jobId, trackHash, st.stems);
      } else {
        S.stemJob.progress = st.progress || ""; syncStemUI();
        pollStemJobLoop(jobId, trackHash);
      }
    } catch (err) {
      failStemJob(trackHash, err.message);
    }
  }, 4000);
}

async function downloadAndAnalyzeStems(jobId, trackHash, stemNames) {
  const curves = {};
  for (const name of stemNames) {
    const ab = await downloadStem(jobId, name);
    const buf = await audioCtx.decodeAudioData(ab);
    curves[name] = computeEnergyCurve(buf.getChannelData(0));
  }
  if (!S.stemJob || S.stemJob.trackHash !== trackHash) return; // track changed mid-download — drop silently
  S.stemCurves = curves;
  S.stemJob.status = "ready";
  try { localStorage.removeItem(STEM_JOB_LS); } catch (e) { }
  syncStemUI();
}

function failStemJob(trackHash, message) {
  if (S.stemJob && S.stemJob.trackHash === trackHash) {
    S.stemJob.status = "error"; S.stemJob.error = message;
  }
  S.stemMode = "simple";
  try { localStorage.removeItem(STEM_JOB_LS); } catch (e) { }
  syncStemUI();
  if (typeof showAppToast === "function") showAppToast("Stem-Trennung fehlgeschlagen: " + message, 5000);
}
```

On startup / after a track's `analyzeTrack()` finishes (fpHash known), check
`localStorage.getItem(STEM_JOB_LS)`: if its `trackHash` matches
`S.fpHash`, restore `S.stemJob = { id: jobId, status: "processing", ... }`
and call `pollStemJobLoop(jobId, trackHash)` directly instead of
`startStemSeparation()` — resumes without resubmitting. If it doesn't match
(different track loaded since), remove the stale entry and ignore it.

### 6. UI

New "Audio-Analyse" section in Settings (`elastic-morph.html`, inserted
after the existing "Audio Mixer" section at line ~1610, before "MIDI
Control"):

```html
<h3>Audio-Analyse</h3>
<p class="note" id="stemNote">Advanced trennt den Track in Vocals, Drums, Bass und Melodie — kann ein bis zwei Minuten dauern. Läuft über unseren Trennungs-Dienst.</p>
<div class="blend-row" style="max-width:420px">
  <label class="check"><input type="radio" name="stemMode" id="stemModeSimple" checked> Einfach</label>
  <label class="check"><input type="radio" name="stemMode" id="stemModeAdvanced"> Advanced (Stems)</label>
</div>
<p class="note" id="stemStatus"></p>
```

Wiring (top-level, alongside the existing `$("mixBass").addEventListener(...)`
style at `elastic-morph.html:10605`):

```js
$("stemModeSimple").addEventListener("change", e => { if (e.target.checked) { S.stemMode = "simple"; syncStemUI(); } });
$("stemModeAdvanced").addEventListener("change", e => {
  if (e.target.checked) { S.stemMode = "advanced"; startStemSeparation(); syncStemUI(); }
});

function syncStemUI() {
  const s = $("stemStatus"); if (!s) return;
  $("stemModeSimple").checked = S.stemMode === "simple";
  $("stemModeAdvanced").checked = S.stemMode === "advanced";
  if (!S.stemJob) { s.textContent = ""; return; }
  if (S.stemJob.status === "ready") s.textContent = "Bereit ✓";
  else if (S.stemJob.status === "error") s.textContent = "Fehler: " + S.stemJob.error;
  else s.textContent = "Stems werden getrennt… " + (S.stemJob.progress || "wird gestartet");
}
```

### 7. Testing

New `test.js` assertions, same static-source-assertion style as the rest of
the file:

- `S.stemMode`/`S.stemJob`/`S.stemCurves` defaults present in the `S` object
  literal.
- `computeEnergyCurve` exists as a standalone function and `analyzeTrack()`
  calls it (`S.energyCurve = computeEnergyCurve(ch)`) instead of containing
  the inline loop — regression guard that the extraction didn't change
  behavior (same windowing constant `N=240`, same smoothing radius `4`).
- `submitStemJob`/`pollStemJobStatus`/`downloadStem` construct the exact
  verified URLs/FormData fields (`/split` with `file`+`mode=4stems`,
  `/status/{id}`, `/download/{id}/{stem}?format=wav`).
- `resolveAudioFileForStemJob` returns `S.currentAudioFile` when set, else
  builds a `File` from `fetchDemoBytes(S.currentDemoUrl)`.
- `pollStemJobLoop` and `downloadAndAnalyzeStems` both no-op (drop the
  result) when `S.stemJob.trackHash` no longer matches the `trackHash`
  they were called with — the stale-job-discard guard.
- The new Settings markup and its two listeners exist with the exact ids
  used above.

## Open questions

None — Frank confirmed lazy (on-toggle) triggering, and confirmed scoping
this spec to Part A only (data pipeline + toggle, no visual wiring yet).
