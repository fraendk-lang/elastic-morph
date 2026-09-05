# Stem Separation Integration (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user opt into "Advanced" mode, which sends the current track to Elastic Split for 4-stem separation and makes the result available as per-stem energy-curve data — with no visual reactivity change yet (that's a separate follow-up plan).

**Architecture:** A small API client talks to the already-live, already-CORS-enabled Elastic Split API. The existing offline energy-curve computation (`analyzeTrack()`'s inline RMS-windowing) is extracted into a reusable `computeEnergyCurve()` and run once per downloaded stem, producing `S.stemCurves` in the same shape as the existing `S.energyCurve`. A job-lifecycle layer (submit → poll → download → analyze) drives this, persists the in-flight job to localStorage so a reload can resume it, and discards any result that no longer matches the currently-loaded track. A new Settings section exposes the Simple/Advanced toggle.

**Tech Stack:** Single-file vanilla JS app (`elastic-morph.html`), Web Audio API (`decodeAudioData`), Fetch API, zero-dependency static-assertion test harness (`test.js`).

## Global Constraints

- API base: `https://elastic-split-api-production.up.railway.app` (no auth; CORS for `https://elasticmorph.app` already enabled on Elastic Split's Railway `ALLOWED_ORIGINS`).
- Verified live response shapes — use these exactly, don't guess at alternate field names:
  - `POST /split` (FormData: `file`, `mode=4stems`) → `{"job_id": "...", "status": "processing"}`
  - `GET /status/{job_id}` while running → `{"job_id": "...", "status": "processing", "progress": "..."}`; on completion → `{"job_id": "...", "status": "completed", "stems": ["other","bass","vocals","drums"], "duration": <seconds>}`; unknown/expired → 404 with `{"detail": "Job not found or expired."}`.
  - `GET /download/{job_id}/{stem}?format=wav` → raw WAV bytes.
- Stem separation triggers **only** when the user switches to Advanced — never automatically on track load.
- No visual reactivity changes in this plan. `S.stemCurves` becomes available as data; nothing reads it for rendering yet.
- `computeEnergyCurve()`'s behavior must exactly match the RMS-windowing/smoothing `analyzeTrack()` already does today (`N=240` windows, `j += 16` sample stride, smoothing radius `4`, normalized by max) — this is a refactor-for-reuse, not a behavior change.
- **Build-injection gotcha:** `elastic-morph.html` is partly regenerated from `src/inject-vNN.js` files by `node build.js` on every build/deploy. Confirmed via `grep -n "function analyzeTrackFromUrl\|function analyzeTrack\b\|function loadFile\b" src/*.js elastic-morph.html`: `analyzeTrackFromUrl` is sourced from `src/inject-v95.js:116` — it must be edited there, never patched directly in `elastic-morph.html` (the generated copy at `elastic-morph.html:16143` is silently overwritten on the next `node build.js`). `analyzeTrack` and `loadFile` are native to `elastic-morph.html` (not generated) and are edited there directly. Any task that touches `src/inject-v95.js` must run `node build.js` before running `node test.js` (matches `npm run ci`).

---

### Task 1: Shared energy-curve helper + API client

**Files:**
- Modify: `elastic-morph.html:3170` (insert `computeEnergyCurve` before `analyzeTrack`; modify `analyzeTrack`'s body at lines 3183-3202)
- Modify: `elastic-morph.html` (insert the 3 API client functions — see Step 5 for placement)
- Test: `test.js` (new section, inserted before the `/* ---------------- summary ---------------- */` block at the end of the file)

**Interfaces:**
- Produces: `computeEnergyCurve(channelData, N = 240)` → `Float32Array(N)`, normalized 0..1.
- Produces: `submitStemJob(file)` → `Promise<{job_id, status}>`; `pollStemJobStatus(jobId)` → `Promise<{job_id, status, progress?, stems?, duration?}>`; `downloadStem(jobId, stemName)` → `Promise<ArrayBuffer>`. All three `throw` on a non-OK HTTP response.
- Produces: `const STEM_API_BASE = "https://elastic-split-api-production.up.railway.app";` — later tasks reference this same constant, not a hardcoded URL.

- [ ] **Step 1: Write the failing tests**

Open `test.js`. Find the final block:

```js
/* ---------------- summary ---------------- */
(async () => {
```

Insert this new section **immediately before** it:

```js
section("Stem Separation — shared energy-curve helper + API client");

ok("computeEnergyCurve is a standalone function with the documented signature", (() => {
  return script.includes("function computeEnergyCurve(channelData, N = 240)");
})());

ok("analyzeTrack calls computeEnergyCurve instead of containing its own inline RMS/smoothing loop (regression guard for the extraction)", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn
    && fn.includes("S.energyCurve = computeEnergyCurve(ch);")
    && !fn.includes("let curve = new Float32Array(N);");
})());

ok("computeEnergyCurve reproduces the exact original windowing/smoothing constants (N=240 default, stride 16, smoothing radius 4, normalized by max)", (() => {
  const idx = script.indexOf("function computeEnergyCurve(channelData, N = 240)");
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 700);
  return body.includes("for (let j = 0; j < win; j += 16)")
    && body.includes("for (let k = -4; k <= 4; k++)")
    && body.includes("const mx = Math.max(...sm) || 1;");
})());

ok("STEM_API_BASE points at the verified production Elastic Split API", (() => {
  return script.includes('const STEM_API_BASE = "https://elastic-split-api-production.up.railway.app";');
})());

ok("submitStemJob posts multipart form data with file + mode=4stems to /split", (() => {
  const fn = extractFn("submitStemJob");
  return !!fn
    && fn.includes('fd.append("file", file);')
    && fn.includes('fd.append("mode", "4stems");')
    && fn.includes("`${STEM_API_BASE}/split`")
    && fn.includes('method: "POST"');
})());

ok("pollStemJobStatus GETs /status/{job_id} and throws on a non-OK response", (() => {
  const fn = extractFn("pollStemJobStatus");
  return !!fn
    && fn.includes("`${STEM_API_BASE}/status/${jobId}`")
    && fn.includes("if (!res.ok) throw new Error(");
})());

ok("downloadStem GETs /download/{job_id}/{stem}?format=wav and returns an ArrayBuffer", (() => {
  const fn = extractFn("downloadStem");
  return !!fn
    && fn.includes("`${STEM_API_BASE}/download/${jobId}/${stemName}?format=wav`")
    && fn.includes("return res.arrayBuffer();");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: all 7 new assertions under "Stem Separation — shared energy-curve helper + API client" print `✗`, everything else still prints `✓`.

- [ ] **Step 3: Implement — extract `computeEnergyCurve` and refactor `analyzeTrack`**

At `elastic-morph.html:3170`, insert this new function **immediately before** `async function analyzeTrack(file) {`:

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

Then at `elastic-morph.html:3183-3202` (now shifted down by the inserted function — locate by content, not line number), replace:

```js
    /* --- 1) coarse energy curve (240 windows over the track) --- */
    const N = 240;
    const win = Math.max(1, Math.floor(ch.length / N));
    let curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      const o = i * win;
      for (let j = 0; j < win; j += 16) { const v = ch[o + j] || 0; s += v * v; c++; }
      curve[i] = Math.sqrt(s / c);
    }
    // smooth (moving average, radius 4)
    const sm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let k = -4; k <= 4; k++) { const idx = i + k; if (idx >= 0 && idx < N) { s += curve[idx]; c++; } }
      sm[i] = s / c;
    }
    const mx = Math.max(...sm) || 1;
    for (let i = 0; i < N; i++) sm[i] /= mx;
    S.energyCurve = sm;   // v18: keep the envelope for the timeline waveform
```

with:

```js
    /* --- 1) coarse energy curve (240 windows over the track) --- */
    S.energyCurve = computeEnergyCurve(ch);   // v18: keep the envelope for the timeline waveform
```

- [ ] **Step 4: Implement — API client**

Immediately after the `computeEnergyCurve` function you just added (still before `analyzeTrack`), insert:

```js
const STEM_API_BASE = "https://elastic-split-api-production.up.railway.app";

async function submitStemJob(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", "4stems");
  const res = await fetch(`${STEM_API_BASE}/split`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Stem-Trennung: Server antwortete mit " + res.status);
  return res.json();
}

async function pollStemJobStatus(jobId) {
  const res = await fetch(`${STEM_API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Job nicht gefunden oder abgelaufen.");
  return res.json();
}

async function downloadStem(jobId, stemName) {
  const res = await fetch(`${STEM_API_BASE}/download/${jobId}/${stemName}?format=wav`);
  if (!res.ok) throw new Error("Download fehlgeschlagen: " + stemName);
  return res.arrayBuffer();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 7 new ones from Step 1. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: extract computeEnergyCurve and add the Elastic Split API client

computeEnergyCurve pulls analyzeTrack's inline RMS-windowing/smoothing
into a reusable function (same N=240/stride-16/radius-4 behavior,
verified by regression test) so both the main track and, in a later
task, each separated stem can use it. Adds the three API client
functions (submit/poll/download) against the now-CORS-enabled Elastic
Split production API, with response shapes verified live beforehand.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: State defaults + track-origin tracking

**Files:**
- Modify: `elastic-morph.html:2883` (add `S.stemMode`/`S.stemJob`/`S.stemCurves`/`S.currentAudioFile`/`S.currentDemoUrl`/`S.currentDemoName` defaults)
- Modify: `elastic-morph.html:3170-3173` (analyzeTrack — reset stem state on every new track)
- Modify: `elastic-morph.html:9280` (`loadFile` — record `S.currentAudioFile`)
- Modify: `src/inject-v95.js:116-120` (`analyzeTrackFromUrl` — record `S.currentDemoUrl`/`S.currentDemoName`; this function is build-injected into `elastic-morph.html:16143` from this source file, per the Global Constraints gotcha — do NOT edit the generated copy directly)
- Modify: `elastic-morph.html` (insert `resolveAudioFileForStemJob` — see Step 5 for placement)
- Test: `test.js` (extends the section from Task 1)

**Interfaces:**
- Consumes: `fetchDemoBytes(url)` (existing function, `elastic-morph.html:14792`) — returns `Promise<ArrayBuffer|null>`.
- Produces: `S.stemMode` (`"simple"` default), `S.stemJob` (`null` default), `S.stemCurves` (`null` default), `S.currentAudioFile` (`null` default), `S.currentDemoUrl` (`null` default), `S.currentDemoName` (`null` default).
- Produces: `async function resolveAudioFileForStemJob()` → `Promise<File>`, throws if no track is loaded or the demo track can't be fetched.

- [ ] **Step 1: Write the failing tests**

Add to the same `test.js` section from Task 1:

```js
ok("S gains stemMode/stemJob/stemCurves defaults", (() => {
  return script.includes('stemMode: "simple",') && script.includes("stemJob: null,") && script.includes("stemCurves: null,");
})());

ok("S gains currentAudioFile/currentDemoUrl/currentDemoName defaults for resolving which File to send to the stem API later", (() => {
  return script.includes("currentAudioFile: null,") && script.includes("currentDemoUrl: null,") && script.includes("currentDemoName: null,");
})());

ok("analyzeTrack resets stem state at the start of every new track analysis (a stale job/curve from the previous track must not leak into the new one)", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn && fn.includes('S.stemMode = "simple"; S.stemJob = null; S.stemCurves = null;');
})());

ok("loadFile records the real uploaded File on S.currentAudioFile and clears the demo-url fields", (() => {
  const fn = extractFn("loadFile");
  return !!fn && fn.includes("S.currentAudioFile = file; S.currentDemoUrl = null;");
})());

ok("analyzeTrackFromUrl records the demo track's url/name (no real File exists for the bundled demo track) and clears currentAudioFile", (() => {
  const fn = extractFn("analyzeTrackFromUrl");
  return !!fn && fn.includes("S.currentAudioFile = null; S.currentDemoUrl = url; S.currentDemoName = name;");
})());

ok("resolveAudioFileForStemJob returns S.currentAudioFile directly when it's set", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn && fn.includes("if (S.currentAudioFile) return S.currentAudioFile;");
})());

ok("resolveAudioFileForStemJob builds a real File from fetchDemoBytes(S.currentDemoUrl) when there's no currentAudioFile, and throws if fetchDemoBytes returns null", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn
    && fn.includes("const ab = await fetchDemoBytes(S.currentDemoUrl);")
    && fn.includes('if (!ab) throw new Error("Demo-Track konnte nicht geladen werden.");')
    && fn.includes('new File([ab], S.currentDemoName || "demo.mp3", { type: "audio/mpeg" });');
})());

ok("resolveAudioFileForStemJob throws when no track is loaded at all", (() => {
  const fn = extractFn("resolveAudioFileForStemJob");
  return !!fn && fn.includes('throw new Error("Kein Track geladen.");');
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 8 new assertions print `✗` (Task 1's assertions still `✓`).

- [ ] **Step 3: Implement — state defaults**

At `elastic-morph.html:2882-2883`, replace:

```js
  energyCurve: null,      // v18: normalized 0..1 energy envelope for the timeline waveform
  audioBuffer: null,      // v26: decoded AudioBuffer kept for offline export feature analysis
```

with:

```js
  energyCurve: null,      // v18: normalized 0..1 energy envelope for the timeline waveform
  audioBuffer: null,      // v26: decoded AudioBuffer kept for offline export feature analysis
  stemMode: "simple",     // "simple" | "advanced" — Advanced needs a completed stem-separation job for the current track
  stemJob: null,          // { id, status, progress, error, trackHash } | null
  stemCurves: null,       // null | { bass, drums, vocals, other } — each a Float32Array(240), same shape as energyCurve
  currentAudioFile: null, // the real uploaded File, when the track came from loadFile()
  currentDemoUrl: null,   // the bundled demo track's URL, when the track came from analyzeTrackFromUrl() (no real File exists for it)
  currentDemoName: null,  // the bundled demo track's display name, for building a File from it later if needed
```

- [ ] **Step 4: Implement — reset stem state in `analyzeTrack`, record origin in `loadFile`/`analyzeTrackFromUrl`**

At `elastic-morph.html:3170-3174`, replace:

```js
async function analyzeTrack(file) {
  const label = $("trackName");
  S.analyzeState = "analyzing";
  S.analyzeError = null;
  if (typeof syncExportGates === "function") syncExportGates();
```

with:

```js
async function analyzeTrack(file) {
  const label = $("trackName");
  S.analyzeState = "analyzing";
  S.analyzeError = null;
  S.stemMode = "simple"; S.stemJob = null; S.stemCurves = null;   // a new track invalidates any prior stem job/result
  if (typeof syncExportGates === "function") syncExportGates();
```

At `elastic-morph.html:9280`, replace:

```js
  S.time = 0; S.growth = 0.15; S.songMap = null; S.bpm = 0; S.fpHue = 0; S.energyCurve = null; S.audioBuffer = null;
```

with:

```js
  S.time = 0; S.growth = 0.15; S.songMap = null; S.bpm = 0; S.fpHue = 0; S.energyCurve = null; S.audioBuffer = null;
  S.currentAudioFile = file; S.currentDemoUrl = null;
```

At `src/inject-v95.js:116-120` (**not** `elastic-morph.html` — see the Global Constraints build-injection gotcha), replace:

```js
async function analyzeTrackFromUrl(url, name) {
  const fake = {
    name,
    arrayBuffer: () => fetchDemoBytes(url)
  };
```

with:

```js
async function analyzeTrackFromUrl(url, name) {
  S.currentAudioFile = null; S.currentDemoUrl = url; S.currentDemoName = name;
  const fake = {
    name,
    arrayBuffer: () => fetchDemoBytes(url)
  };
```

- [ ] **Step 5: Implement — `resolveAudioFileForStemJob`**

Immediately after the `downloadStem` function added in Task 1 (still before `analyzeTrack`), insert:

```js
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

- [ ] **Step 6: Rebuild so the edited `src/inject-v95.js` is merged into `elastic-morph.html`**

Run: `node build.js`
Expected output: `✓ Merged src/inject-v58.js + … (v<N>)`

**IMPORTANT:** do not hand-edit the generated `analyzeTrackFromUrl` block inside `elastic-morph.html` (between the `/* @BUILD-INJECT-V58 */` marker and `/* ---- boot ---- */`) — it is fully regenerated from `src/inject-v95.js` by this step and any direct edit there is silently discarded.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run ci`
Expected: all assertions print `✓`, including the 8 new ones from Step 1.

- [ ] **Step 8: Commit**

```bash
git add elastic-morph.html src/inject-v95.js test.js
git commit -m "feat: track state + origin tracking for stem separation

S.stemMode/stemJob/stemCurves defaults, reset on every new track so a
prior track's job/result can't leak into a new one. loadFile and
analyzeTrackFromUrl now record how the track arrived (a real File vs.
the bundled demo's URL+name), because the demo track goes through a
duck-typed stand-in with no real File/Blob -- resolveAudioFileForStemJob
builds a real one lazily, only when a stem job actually needs it.

analyzeTrackFromUrl is build-injected from src/inject-v95.js, so that
edit landed in its true source file and elastic-morph.html was
regenerated via node build.js, not hand-patched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Job lifecycle (submit, poll, download+analyze, persistence, resume)

**Files:**
- Modify: `elastic-morph.html` (insert the job-lifecycle functions — see Step 3 for placement)
- Modify: `elastic-morph.html:3226-3227` (`analyzeTrack`'s success path — check for a resumable job)
- Test: `test.js` (extends the section from Tasks 1-2)

**Interfaces:**
- Consumes: `submitStemJob`, `pollStemJobStatus`, `downloadStem`, `computeEnergyCurve` (Task 1); `resolveAudioFileForStemJob`, `S.stemMode`/`S.stemJob`/`S.stemCurves` (Task 2); `showAppToast(msg, ms)` (existing function).
- Produces: `async function startStemSeparation()`; `function pollStemJobLoop(jobId, trackHash)`; `async function downloadAndAnalyzeStems(jobId, trackHash, stemNames)`; `function failStemJob(trackHash, message)`; `const STEM_JOB_LS = "elasticMorph.stemJob";`. Task 4's UI calls `startStemSeparation()` directly and reads `S.stemJob`/`S.stemMode` to render status — it does not call any of the other functions here directly.

- [ ] **Step 1: Write the failing tests**

Add to the same `test.js` section:

```js
ok('STEM_JOB_LS follows the existing elasticMorph.* localStorage naming convention', (() => {
  return script.includes('const STEM_JOB_LS = "elasticMorph.stemJob";');
})());

ok("startStemSeparation skips re-submitting when a job for the current track is already running or done, but allows retrying after a prior error", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn && fn.includes('if (S.stemJob && S.stemJob.trackHash === trackHash && S.stemJob.status !== "error") return;');
})());

ok("startStemSeparation resolves the file, submits the job, and persists {trackHash, jobId, submittedAt} to localStorage before polling", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn
    && fn.includes("const file = await resolveAudioFileForStemJob();")
    && fn.includes("const { job_id } = await submitStemJob(file);")
    && fn.includes("localStorage.setItem(STEM_JOB_LS, JSON.stringify({ trackHash, jobId: job_id, submittedAt: Date.now() }));")
    && fn.includes("pollStemJobLoop(job_id, trackHash);");
})());

ok("startStemSeparation routes any failure (resolving the file or submitting the job) through failStemJob", (() => {
  const fn = extractFn("startStemSeparation");
  return !!fn && fn.includes("} catch (err) {\n    failStemJob(trackHash, err.message);\n  }");
})());

ok("pollStemJobLoop drops its result silently once the track has changed (S.stemJob.trackHash no longer matches the job it was polling for)", (() => {
  const fn = extractFn("pollStemJobLoop");
  return !!fn && fn.includes("if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;");
})());

ok("pollStemJobLoop polls every 4 seconds via setTimeout, moves to downloadAndAnalyzeStems on completion, and re-schedules itself otherwise", (() => {
  const fn = extractFn("pollStemJobLoop");
  return !!fn
    && fn.includes("setTimeout(async () => {")
    && fn.includes("}, 4000);")
    && fn.includes('if (st.status === "completed") {')
    && fn.includes("await downloadAndAnalyzeStems(jobId, trackHash, st.stems);")
    && fn.includes("pollStemJobLoop(jobId, trackHash);");
})());

ok("downloadAndAnalyzeStems downloads and decodes every stem, runs computeEnergyCurve on each, and also drops its result silently if the track changed mid-download", (() => {
  const fn = extractFn("downloadAndAnalyzeStems");
  return !!fn
    && fn.includes("const ab = await downloadStem(jobId, name);")
    && fn.includes("const buf = await audioCtx.decodeAudioData(ab);")
    && fn.includes("curves[name] = computeEnergyCurve(buf.getChannelData(0));")
    && fn.includes("if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;")
    && fn.includes("S.stemCurves = curves;")
    && fn.includes('S.stemJob.status = "ready";')
    && fn.includes("localStorage.removeItem(STEM_JOB_LS);");
})());

ok("failStemJob records the error on a still-current job, reverts to Simple mode, clears the persisted job, and toasts the user", (() => {
  const fn = extractFn("failStemJob");
  return !!fn
    && fn.includes('S.stemJob.status = "error"; S.stemJob.error = message;')
    && fn.includes('S.stemMode = "simple";')
    && fn.includes("localStorage.removeItem(STEM_JOB_LS);")
    && fn.includes('showAppToast("Stem-Trennung fehlgeschlagen: " + message, 5000);');
})());

ok("analyzeTrack's success path checks for a resumable job matching the freshly-analyzed track's fpHash and resumes polling instead of leaving it orphaned", (() => {
  const fn = extractFn("analyzeTrack");
  return !!fn
    && fn.includes("JSON.parse(localStorage.getItem(STEM_JOB_LS) || \"null\")")
    && fn.includes("saved.trackHash === S.fpHash")
    && fn.includes('S.stemJob = { id: saved.jobId, status: "processing", progress: "", error: null, trackHash: saved.trackHash };')
    && fn.includes("pollStemJobLoop(saved.jobId, saved.trackHash);");
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 8 new assertions print `✗`.

- [ ] **Step 3: Implement — job lifecycle functions**

Immediately after `resolveAudioFileForStemJob` (added in Task 2), insert:

```js
const STEM_JOB_LS = "elasticMorph.stemJob";

async function startStemSeparation() {
  const trackHash = S.fpHash;
  if (S.stemJob && S.stemJob.trackHash === trackHash && S.stemJob.status !== "error") return;
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
    if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;
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
  if (!S.stemJob || S.stemJob.trackHash !== trackHash) return;
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

`syncStemUI()` is defined in Task 4 — declare it there; calling an undeclared function here is fine in JS as long as it exists by the time these are actually invoked at runtime (Task 4 lands before this feature is used), but for this task's tests to run standalone without a `ReferenceError`, add a no-op stub right above `startStemSeparation` that Task 4 will replace:

```js
function syncStemUI() { /* replaced in Task 4 with the real UI sync */ }
```

- [ ] **Step 4: Implement — resume a matching job after analysis completes**

At `elastic-morph.html:3226-3227` (locate by content — the two lines right after `applyFirstSmartLook();` inside `analyzeTrack`'s try block), replace:

```js
    applyFirstSmartLook();
    S.analyzeState = "done";
```

with:

```js
    applyFirstSmartLook();
    try {
      const saved = JSON.parse(localStorage.getItem(STEM_JOB_LS) || "null");
      if (saved && saved.trackHash === S.fpHash) {
        S.stemJob = { id: saved.jobId, status: "processing", progress: "", error: null, trackHash: saved.trackHash };
        pollStemJobLoop(saved.jobId, saved.trackHash);
      } else if (saved) {
        localStorage.removeItem(STEM_JOB_LS);
      }
    } catch (e) { }
    S.analyzeState = "done";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node test.js`
Expected: all assertions print `✓`, including the 8 new ones from Step 1.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: stem separation job lifecycle (submit/poll/download/resume)

startStemSeparation -> pollStemJobLoop -> downloadAndAnalyzeStems, with
the job persisted to localStorage (elasticMorph.stemJob) so a reload
mid-job resumes polling instead of resubmitting. Both the poll loop
and the download step check S.stemJob.trackHash before applying a
result, so a result for a track the user has since navigated away
from is silently dropped rather than corrupting the current track's
state. failStemJob reverts to Simple mode and toasts the error.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Settings UI

**Files:**
- Modify: `elastic-morph.html:1610-1612` (Settings panel — new "Audio-Analyse" section)
- Modify: `elastic-morph.html` (replace the `syncStemUI` stub from Task 3 with the real implementation, add the two listeners — see Step 3 for placement)
- Test: `test.js` (extends the section from Tasks 1-3)

**Interfaces:**
- Consumes: `S.stemMode`, `S.stemJob` (Task 2/3); `startStemSeparation()` (Task 3).
- Produces: DOM elements `#stemModeSimple`, `#stemModeAdvanced`, `#stemStatus`; `function syncStemUI()` (replaces the Task 3 stub) called by the job-lifecycle functions and by the two new change listeners.

- [ ] **Step 1: Write the failing tests**

Add to the same `test.js` section:

```js
ok('Settings panel gains an "Audio-Analyse" section with the Simple/Advanced radio toggle, inserted between Audio Mixer and MIDI Control', (() => {
  const idx = html.indexOf("<h3>Audio-Analyse</h3>");
  if (idx < 0) return false;
  const block = html.slice(idx, idx + 700);
  return block.includes('<input type="radio" name="stemMode" id="stemModeSimple" checked> Einfach')
    && block.includes('<input type="radio" name="stemMode" id="stemModeAdvanced"> Advanced (Stems)')
    && block.includes('<p class="note" id="stemStatus">');
})());

ok("selecting Simple sets S.stemMode and re-syncs the UI, without starting a job", (() => {
  const idx = script.indexOf('$("stemModeSimple").addEventListener');
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 200);
  return body.includes('S.stemMode = "simple"; syncStemUI();') && !body.includes("startStemSeparation()");
})());

ok("selecting Advanced sets S.stemMode and calls startStemSeparation", (() => {
  const idx = script.indexOf('$("stemModeAdvanced").addEventListener');
  if (idx < 0) return false;
  const body = script.slice(idx, idx + 200);
  return body.includes('S.stemMode = "advanced"; startStemSeparation();');
})());

ok("syncStemUI shows Ready/error/progress text matching S.stemJob.status, and keeps the two radios in sync with S.stemMode", (() => {
  const fn = extractFn("syncStemUI");
  return !!fn
    && fn.includes('$("stemModeSimple").checked = S.stemMode === "simple";')
    && fn.includes('$("stemModeAdvanced").checked = S.stemMode === "advanced";')
    && fn.includes('if (S.stemJob.status === "ready") s.textContent = "Bereit ✓";')
    && fn.includes('else if (S.stemJob.status === "error") s.textContent = "Fehler: " + S.stemJob.error;')
    && fn.includes('else s.textContent = "Stems werden getrennt… " + (S.stemJob.progress || "wird gestartet");');
})());

ok("the real syncStemUI (not the Task 3 stub) is the one defined in the script — only one function declaration for it exists", (() => {
  const first = script.indexOf("function syncStemUI()");
  const last = script.lastIndexOf("function syncStemUI()");
  return first >= 0 && first === last;
})());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node test.js`
Expected: the 5 new assertions print `✗` (the last one especially — the Task 3 stub still exists standalone at this point, which is expected and about to be replaced).

- [ ] **Step 3: Implement — Settings markup**

At `elastic-morph.html:1610-1612`, replace:

```html
      </div>

      <h3>MIDI Control</h3>
```

with:

```html
      </div>

      <h3>Audio-Analyse</h3>
      <p class="note" id="stemNote">Advanced trennt den Track in Vocals, Drums, Bass und Melodie — kann ein bis zwei Minuten dauern. Läuft über unseren Trennungs-Dienst.</p>
      <div class="blend-row" style="max-width:420px">
        <label class="check"><input type="radio" name="stemMode" id="stemModeSimple" checked> Einfach</label>
        <label class="check"><input type="radio" name="stemMode" id="stemModeAdvanced"> Advanced (Stems)</label>
      </div>
      <p class="note" id="stemStatus"></p>

      <h3>MIDI Control</h3>
```

- [ ] **Step 4: Implement — replace the stub, add listeners**

Find the stub added in Task 3:

```js
function syncStemUI() { /* replaced in Task 4 with the real UI sync */ }
```

Replace it with:

```js
function syncStemUI() {
  const s = $("stemStatus"); if (!s) return;
  $("stemModeSimple").checked = S.stemMode === "simple";
  $("stemModeAdvanced").checked = S.stemMode === "advanced";
  if (!S.stemJob) { s.textContent = ""; return; }
  if (S.stemJob.status === "ready") s.textContent = "Bereit ✓";
  else if (S.stemJob.status === "error") s.textContent = "Fehler: " + S.stemJob.error;
  else s.textContent = "Stems werden getrennt… " + (S.stemJob.progress || "wird gestartet");
}

$("stemModeSimple").addEventListener("change", e => { if (e.target.checked) { S.stemMode = "simple"; syncStemUI(); } });
$("stemModeAdvanced").addEventListener("change", e => {
  if (e.target.checked) { S.stemMode = "advanced"; startStemSeparation(); syncStemUI(); }
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run ci`
Expected: all assertions print `✓`, including all new ones from Tasks 1-4. Final line: `<N> passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: Simple/Advanced toggle UI for stem separation

New 'Audio-Analyse' section in Settings between Audio Mixer and MIDI
Control. Selecting Advanced calls startStemSeparation(); syncStemUI
reflects S.stemJob's live status (submitting/processing progress text,
ready, or error) and keeps both radios in sync with S.stemMode. This
closes Part A -- Advanced now genuinely fetches and analyzes stems
end-to-end, though nothing reads S.stemCurves for rendering yet
(Part B, a separate follow-up plan, wires that up).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual live-check (after all 4 tasks)

Not covered by `test.js` (static source assertions only, no real network/DOM
execution) — verify against the real, live Elastic Split API:

1. Open the app, load the bundled demo track, open Settings, switch to
   "Advanced (Stems)". Confirm the status line shows a progress message
   within a few seconds and updates every ~4s.
2. Wait for it to finish (typically ~1-2 minutes for a full track). Confirm
   the status line shows "Bereit ✓".
3. Reload the page mid-job (start Advanced, then reload before it finishes).
   Confirm the app resumes polling the same job (check the Network tab for
   `/status/{same-job-id}` calls) rather than submitting a new one.
4. Load a different track while a stem job is running for the first one.
   Confirm the status line clears / no longer shows the old job's progress,
   and switching back to Advanced for the new track starts a fresh job.
5. Switch to Advanced with no network connection (or block the domain) to
   confirm the error path: status line shows "Fehler: ...", a toast
   appears, and the mode silently reverts to "Einfach".
