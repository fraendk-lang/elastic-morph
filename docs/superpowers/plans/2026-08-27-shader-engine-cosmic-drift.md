# Shader Engine — Cosmic Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one new Shader Engine GLSL style — Cosmic Drift — to the existing 15-style WebGL1 system.

**Architecture:** A new GLSL function pair (`cosmicDriftDensity` + `cosmicDriftStyle`) added to the single embedded fragment-shader source string, dispatched via the existing `uStyle` uniform / `SHADER_STYLE_ID` map / `<select id="shStyle">` mechanism every existing style already uses — the exact same 4-touch-point pattern the Portal/Crystal/Hypercube round used earlier today.

**Tech Stack:** WebGL1 (GLSL ES 1.00) fragment shader, vanilla JS.

## Global Constraints

- Every edit lands in `elastic-morph.html` before the `@BUILD-INJECT-V58` marker (currently line 10502 — verify fresh with `grep -n "@BUILD-INJECT-V58" elastic-morph.html`).
- After every code change, run `npm run ci` and confirm `git diff --stat elastic-morph.html` is empty.
- **This round's single biggest risk, same as every Shader Engine round today:** a malformed GLSL function can fail the ENTIRE shader program's compile/link step. Per `initGL()` (`elastic-morph.html`, search `function initGL()`), a failed fragment-shader compile makes `initGL()` set `GL.ok = false` and return `false` — this silently disables the ENTIRE Shader Engine (all 16 styles, not just the new one), with only a `console.warn("shader compile: ...")` as any trace. `npm run ci` CANNOT catch this — there is no WebGL context in Node. Live-verification (Task 2) is the only thing that can, and confirming `GL.ok === true` plus spot-checking a couple of pre-existing styles is the single most important check in this round — more important than the new style's own correctness.
- The exposure constant in the spec's code (`glow *= 0.02` inside `cosmicDriftStyle`) is a best estimate, not empirically tuned — this codebase's tests cannot render GLSL, so brightness can only be judged live. If Task 2's live check shows the style clearly too dim or blown out, adjusting that one multiplier is the **expected, in-scope fix** — do not treat it as a sign something else is wrong, and do not skip making the adjustment out of caution.
- No new GLSL arrays, no new uniforms — matches every existing style's convention (see spec's Locked Decisions).
- `git fetch`/`git push` require the Bash tool's `dangerouslyDisableSandbox: true` flag in this environment, or they hang indefinitely.

---

### Task 1: Cosmic Drift GLSL style + wiring

**Files:**
- Modify: `elastic-morph.html` (new GLSL functions, added after the existing `hypercubeStyle` function — verify current line with `grep -n "vec3 hypercubeStyle" elastic-morph.html`)
- Modify: `elastic-morph.html` (`main()`'s dispatch chain — verify current line with `grep -n "col = hypercubeStyle(uv);" elastic-morph.html`, inside the fragment shader)
- Modify: `elastic-morph.html` (`SHADER_STYLE_ID` — verify current line with `grep -n "const SHADER_STYLE_ID" elastic-morph.html`)
- Modify: `elastic-morph.html` (`<select id="shStyle">` — verify current line with `grep -n 'value="hypercube"' elastic-morph.html`)
- Test: `test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: one working GLSL style function pair (`cosmicDriftDensity`, `cosmicDriftStyle`) reachable via `uStyle` value 15, a `SHADER_STYLE_ID` entry `cosmicDrift:15`, and one new `<option>`. Task 2 (live verification) depends on this being wired correctly and compiling.

- [ ] **Step 1: Write the failing tests**

Read the existing "Shader Engine — Portal Depth, Crystal Prism, Hypercube Drift" test section first (`grep -n 'section("Shader Engine' test.js`) to confirm the established pattern this mirrors — you don't need to change that section, just match its conventions exactly.

Add this new section to `test.js`, right after that existing section's last assertion (search for `ok("no GLSL array syntax introduced` and its closing `})());` — add the new section immediately after that block ends):

```js
/* ---------------- Shader Engine: Cosmic Drift ---------------- */
section("Shader Engine — Cosmic Drift");

ok("SHADER_STYLE_ID gained the cosmicDrift entry with the correct uStyle value (15)", (() => {
  return /cosmicDrift:\s*15/.test(script);
})());

["cosmicDriftDensity", "cosmicDriftStyle"].forEach(fn =>
  ok("GLSL " + fn + " defined & called", (frag.split(fn).length - 1) >= 2));

ok("main()'s dispatch chain: hypercube's bare else became an explicit uStyle<14.5 branch, followed by cosmicDrift as the new bare else", (() => {
  const mainIdx = frag.lastIndexOf("void main(){");
  if (mainIdx < 0) return false;
  const mainBody = frag.slice(mainIdx);
  const hypercubeIdx = mainBody.indexOf("else if(uStyle < 14.5) col = hypercubeStyle(uv);");
  const cosmicIdx = mainBody.indexOf("else                   col = cosmicDriftStyle(uv);");
  return hypercubeIdx >= 0 && cosmicIdx > hypercubeIdx;
})());

ok("#shStyle gained the new <option> after hypercube", (() => {
  const selMatch = html.match(/<select id="shStyle"[^>]*>([\s\S]*?)<\/select>/);
  if (!selMatch) return false;
  const body = selMatch[1];
  const hypercubeIdx = body.indexOf('value="hypercube"');
  const cosmicIdx = body.indexOf('value="cosmicDrift"');
  return hypercubeIdx >= 0 && cosmicIdx > hypercubeIdx;
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node test.js 2>&1 | grep -A1 "Shader Engine — Cosmic Drift\|SHADER_STYLE_ID gained the cosmicDrift\|cosmicDriftDensity defined\|cosmicDriftStyle defined\|hypercube's bare else\|gained the new <option>"`
Expected: every new assertion prints `✗`.

- [ ] **Step 3: Write the implementation**

Confirm current line numbers first (they may have drifted): `grep -n "vec3 hypercubeStyle" elastic-morph.html`, then read to the end of that function (its closing `}` right before `void main(){`) to confirm the exact insertion point.

**3a.** Add these 2 GLSL functions directly after `hypercubeStyle`'s closing `}`, before `void main(){`:

```glsl
float cosmicDriftDensity(vec3 p){
  float d = 0.0, amp = 0.5, freq = 1.0;
  mat2 R = mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<4;i++){
    d += amp * abs(sin(p.x*freq) + sin(p.y*freq*1.3) + sin(p.z*freq*0.7));
    p.xy = R*p.xy; p.z += 1.7;
    freq *= 1.9; amp *= 0.55;
  }
  return d;
}
vec3 cosmicDriftStyle(vec2 uv){
  vec3 nebA = vec3(0.15, 0.05, 0.6);
  vec3 nebB = vec3(0.9, 0.3, 0.85);
  float starN = hash(floor(uv*380.0));
  float star = smoothstep(0.988, 1.0, starN) * (0.5 + 0.5*sin(uTime*3.0 + starN*40.0));
  vec3 ro = vec3(0.0, 0.0, -3.2);
  vec3 rd = normalize(vec3(uv, 1.5));
  float spiralSpeed = 0.12 + uBass*0.15;
  float glow = 0.0, t = 0.0;
  for(int i=0;i<40;i++){
    vec3 p = ro + rd*t;
    float ang = length(p.xy)*0.9 + p.z*0.15 + uTime*spiralSpeed;
    mat2 Rs = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
    p.xy = Rs*p.xy;
    float dens = cosmicDriftDensity(p*(1.0 + uMids*0.3));
    glow += dens * exp(-t*0.15) * (0.7 + uBeat*0.7);
    t += 0.14;
  }
  glow *= 0.02;
  float mixT = fract(uHue + glow*0.08 + uHighs*0.12 + uTime*0.02);
  float v = glow * (0.7 + uIntensity*0.6) * (0.7 + uLoud*0.6);
  vec3 col = mix(uPalOn > 0.5 ? uPalA : nebA, uPalOn > 0.5 ? uPalB : nebB, mixT) * v;
  col += vec3(1.0) * star * (0.6 + uLoud*0.4);
  col = applyEyeCatcherFX(col, uv);
  return col;
}
```

**3b.** In `main()`'s dispatch chain, the current final branch is a bare `else` for `hypercube`:
```glsl
  else if(uStyle < 13.5) col = crystalStyle(uv);
  else                   col = hypercubeStyle(uv);
```
Change it to:
```glsl
  else if(uStyle < 13.5) col = crystalStyle(uv);
  else if(uStyle < 14.5) col = hypercubeStyle(uv);
  else                   col = cosmicDriftStyle(uv);
```

**3c.** `SHADER_STYLE_ID` — currently:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14 };
```
Change to:
```js
const SHADER_STYLE_ID = { fluid:0, metaballs:1, tunnel:2, aurora:3, electric:4, chrome:5, gyroid:6, raymarch:7, feedback:8, strobe:9, warehouse:10, laser:11, portal:12, crystal:13, hypercube:14, cosmicDrift:15 };
```

**3d.** `<select id="shStyle">` — currently ends with:
```html
      <option value="hypercube">Style: Hypercube Drift</option>
    </select>
```
Change to:
```html
      <option value="hypercube">Style: Hypercube Drift</option>
      <option value="cosmicDrift">Style: Cosmic Drift</option>
    </select>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node test.js 2>&1 | grep -A1 "Shader Engine — Cosmic Drift\|SHADER_STYLE_ID gained the cosmicDrift\|cosmicDriftDensity defined\|cosmicDriftStyle defined\|hypercube's bare else\|gained the new <option>\|GLSL braces"`
Expected: every assertion prints `✓`, INCLUDING the pre-existing `"GLSL braces & parens balanced"` test — your first lexical sanity signal on the new GLSL (the true compile check still requires the live browser in Task 2).

- [ ] **Step 5: Run the full suite and check for build drift**

Run: `npm run ci` — expect all tests passing, 0 failed, `git diff --stat elastic-morph.html` empty.

- [ ] **Step 6: Commit**

```bash
git add elastic-morph.html test.js
git commit -m "feat: add Cosmic Drift shader style"
```

---

### Task 2: Live verification and push

**Files:** none (no code changes — verification only, except a possible one-line exposure tweak, see Step 3).

**Interfaces:**
- Consumes: the fully-wired feature from Task 1.
- Produces: nothing — terminal task.

**This task's first check is the most important one in the whole round.** `npm run ci` cannot compile GLSL — a single malformed character in Task 1's GLSL can silently disable the ENTIRE Shader Engine (all 16 styles), not just the new one.

- [ ] **Step 1: Start the dev server and open it in a browser**

The project's own `.claude/launch.json`-driven preview tool has intermittently served stale content from a wrong working directory in this environment (see project memory `project_morph_hq_export_frame_accuracy.md`). Prefer running the server directly:

```bash
npx --yes serve -l 3467 "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
```

Then open `http://localhost:3467/elastic-morph` in the browser tool and confirm via
`curl -s http://localhost:3467/elastic-morph | grep -c "cosmicDriftStyle"` returns `1`+ before trusting anything rendered in the tab.

- [ ] **Step 2: Confirm the whole shader program compiles**

In the browser console (`javascript_tool`):
```js
if (typeof loadDemoTrack === 'function') { await loadDemoTrack({}); }
S.shader.on = true; $("shOn").checked = true;
if (typeof initGL === 'function') initGL();
({ glOk: typeof GL !== 'undefined' ? GL.ok : 'GL not found' })
```
Expected: `glOk: true`. If it's `false`, check `read_console_messages` for a `"shader compile:"` message — that is a hard stop. Read the GLSL you wrote in Task 1 character-by-character against the plan's exact code, fix the mismatch, reload, and retry this step before doing anything else in this task.

- [ ] **Step 3: Confirm Cosmic Drift itself renders visible, audio-reactive content, and tune exposure if needed**

```js
S.shader.style = "cosmicDrift"; $("shStyle").value = "cosmicDrift";
```
Wait ~1-2s, screenshot. Confirm: a swirling cloud-like glow (not a flat blob, not solid rectangles) with small bright starfield points visible behind/around it, colorful (not just white/gray), and reacting to audio (brightness pulses with the beat, swirl speed shifts with bass — compare two screenshots ~2s apart to confirm real motion, not a static image).

If the result looks essentially black (glow too dim to see): increase the exposure constant — find `glow *= 0.02;` inside `cosmicDriftStyle` and raise it (try `0.04` first, re-test). If the result looks blown out to solid white with no visible structure: decrease it (try `0.01` first, re-test). This is the one adjustment explicitly anticipated in the Global Constraints above — make it directly, re-run `npm run ci` afterward to confirm the change didn't break the structural tests (it shouldn't — none of them assert on the literal `0.02` value), and note in your report that you tuned it and to what value.

- [ ] **Step 4: Confirm a couple of pre-existing styles are unaffected**

For at least 2 of the 15 pre-existing styles — pick `hypercube` (immediately adjacent to the new dispatch branch, the most likely spot for an off-by-one) and one other, e.g. `gyroid`:
```js
S.shader.style = "hypercube"; $("shStyle").value = "hypercube";
```
Screenshot, confirm it still looks like before this round (cube-in-cube wireframe for hypercube). Repeat for the second style. Check console for errors after each.

- [ ] **Step 5: Confirm the arrow-key style-cycle reaches the new style**

```js
({ ids: Object.keys(SHADER_STYLE_ID) })
```
Expect `ids` to include `cosmicDrift` (16 total). Call `cycleShaderStyle(1)` from a style near the end of the list (e.g. set `S.shader.style = "hypercube"` first) and confirm it reaches `cosmicDrift` without error.

- [ ] **Step 6: Check console for errors, then clean up and push**

```bash
pkill -f "serve -l 3467"
```
```bash
cd "/Users/frankkrumsdorf/Desktop/Claude Code Landingpage Elastic Field/Elastic Morph"
npm run ci
git status --short
git push origin main
```
(Use the Bash tool's `dangerouslyDisableSandbox: true` for the push, per the Global Constraints above. If Step 3 required an exposure-constant tweak, commit that change first — `git add elastic-morph.html && git commit -m "fix: tune Cosmic Drift exposure after live verification"` — before pushing.)

- [ ] **Step 7: Confirm live via hash match**

```bash
shasum -a 256 elastic-morph.html
curl -s https://elasticmorph.app/elastic-morph.html | shasum -a 256
```
Wait for the Vercel deploy to complete (30-60s is typical) before the second command if the hashes don't match on the first try.
