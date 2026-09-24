# Obsidian Bloom Stage C3 — Make the snare visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage-D testing on the real app build showed the snare channel has no visible effect on the Obsidian Bloom frame (0 % of pixels changed vs. bass 7.3 %, kick 3.9 %, mids 2.9 %, highs 0.9 %); `uSnare` only nudges roughness by ≤0.06. Give it a distinct, controlled, non-flashing signature: a brief surface-ripple burst and a short cool rim lift.

**Architecture:** Two GLSL constant edits in the pre-tuned module asset (`uSnare` is already an existing uniform, 0..1, decays 0.88 per 60 Hz grid step, damped to 35 % under "Weniger Flackern"). No new uniform, no JS change.

**Tech Stack:** GLSL inside `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js` (source of truth) copied to `src/inject-v114.js`.

## Global Constraints

- Edit the ASSET first, then `cp` it over `src/inject-v114.js` and confirm with `cmp`.
- Only these two shader lines change; the single tonemap/gamma line, uniforms and everything else stay identical.
- Verification command: `npm run ci`.

---

### Task 1: Snare ripple + rim

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js`, then `src/inject-v114.js`
- Test: `test.js`

- [ ] **Step 1: Write the failing test**

Insert before `/* ---------------- summary ---------------- */`:

```js
section("Obsidian Bloom stage C3 — snare has a visible signature");

okf("uSnare drives a surface-ripple burst and a rim lift (not just roughness)", () => {
  const s = injectSrc("inject-v114.js");
  return s.includes("d+=rip*(0.006+0.020*uSurf+0.016*uSnare);")
    && s.includes("fres*0.10*(0.4+0.6*uGloss+1.2*uSnare)")
    && s.includes("0.22*uGloss-0.06*uSnare");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run ci` — expected: the new assertion `✗`, everything else `✓`.

- [ ] **Step 3: Implement (asset)**

Find: `d+=rip*(0.006+0.020*uSurf);`
Replace with: `d+=rip*(0.006+0.020*uSurf+0.016*uSnare);`

Find: `col+=vec3(0.30,0.52,1.0)*fres*0.10*(0.4+0.6*uGloss);`
Replace with: `col+=vec3(0.30,0.52,1.0)*fres*0.10*(0.4+0.6*uGloss+1.2*uSnare);`

- [ ] **Step 4: Sync and verify**

```bash
cp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js
cmp docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js && echo identical
npm run ci
```

Expected: `identical`; `<N> passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-09-24-obsidian-C-assets/inject-v114.js src/inject-v114.js elastic-morph.html test.js
git commit -m "fix: Obsidian Bloom snare now has a visible signature (ripple burst + rim lift)

Measured on the real build: snare changed 0% of pixels while bass/kick/
mids/highs changed 7.3/3.9/2.9/0.9%. uSnare now adds a brief surface-ripple
amplitude and a cool rim lift; still bounded, decays with the onset, and is
damped under Weniger Flackern.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
