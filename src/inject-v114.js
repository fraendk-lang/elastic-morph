/* ============================================================
   v114 — Obsidian Bloom renderer (DNA engine "sculpture")
   Own WebGL context (isolated from the Shader Engine's), bounded SDF raymarcher:
   4 smooth-unioned lobes + bloom ridges, polished graphite material lit by a warm key
   softbox and a cool rim strip. Reads ONE feature source (v113 contract): the per-track
   timeline sampled by absolute song time (file), or the live adapter (mic / tab audio).
   Filmic tonemap + gamma happen once, inside the shader (this look's own finish path).
   ============================================================ */

const SCULPT_VERSION = 1;

const SCULPT_VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

const SCULPT_FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec4 uSeed;
uniform float uForm,uSurf,uGloss,uKick,uSnare,uLoud,uGrow; uniform vec3 uTint; uniform float uQ; // uQ: 0 low,1 med,2 high
float hash1(float n){return fract(sin(n*127.1)*43758.5453);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 kickDir(){float a=uT*0.31+uSeed.x*6.283,b=uT*0.17+uSeed.y*6.283;return normalize(vec3(sin(a)*cos(b),sin(b),cos(a)*cos(b)));}
float map(vec3 p){
  // slow, inert turntable + seed-dependent orientation
  p.xz*=rot(uT*0.05+uSeed.z*6.283); p.yz*=rot(0.35+uSeed.w*0.6);
  float spread=0.34+0.16*uForm+0.10*uGrow;
  float k=0.42;
  float d=1e5;
  for(int i=0;i<4;i++){
    float fi=float(i);
    float ph=uSeed.x*6.283+fi*1.7;
    vec3 c=spread*vec3(sin(ph+uT*0.11*(1.0+0.3*fi)),0.75*cos(ph*1.3+uT*0.09),cos(ph*0.8-uT*0.13));
    vec3 q=p-c;
    q.y*=1.0+0.25*(uSeed.y-0.5)*(fi-1.5);
    float r=0.46-0.05*fi+0.05*hash1(fi+uSeed.z*10.0);
    d=smin(d,length(q)-r,k);
  }
  // bloom ridges: 5 soft petals around the vertical axis, seed-phased, fade towards the poles
  float ang=atan(p.z,p.x);
  d+=0.055*cos(ang*5.0+uSeed.w*6.283+uT*0.07)*(1.0-smoothstep(0.2,0.75,abs(p.y)))*smoothstep(0.1,0.5,length(p.xz));
  // large slow deformation (bass), small ripple (mids)
  float big=sin(p.x*2.3+uT*0.21+uSeed.x*9.0)*sin(p.y*2.1-uT*0.17+uSeed.y*9.0)*sin(p.z*2.6+uT*0.13+uSeed.z*9.0);
  d+=big*(0.035+0.11*uForm);
  float rip=sin(p.x*9.0+uT*0.9)*sin(p.y*8.0-uT*0.7)*sin(p.z*10.0+uT*0.6);
  d+=rip*(0.006+0.020*uSurf+0.016*uSnare);
  // kick: one local bump, deterministic direction, quick decay
  vec3 kd=kickDir()*0.55; float kb=exp(-dot(p-kd,p-kd)*4.0);
  d-=kb*uKick*uKick*0.13;
  return d;
}
vec3 calcN(vec3 p){const vec2 e=vec2(1.0,-1.0)*0.0022;return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
float boxL(vec3 r,vec3 dir,vec2 ext,float soft){
  vec3 x=normalize(cross(dir,vec3(0.0,1.0,0.0))); vec3 y=cross(x,dir);
  float f=dot(r,dir); if(f<=0.02) return 0.0;
  vec2 q=vec2(dot(r,x),dot(r,y))/f;
  return smoothstep(ext.x+soft,ext.x-soft,abs(q.x))*smoothstep(ext.y+soft,ext.y-soft,abs(q.y));
}
vec3 env(vec3 r){ // dark studio: large warm softbox (key), tall cool strip (rim), floor bounce
  float up=r.y*0.5+0.5;
  vec3 col=vec3(0.006,0.007,0.010)+0.03*vec3(0.25,0.32,0.45)*smoothstep(0.3,1.0,up);
  col+=vec3(1.0,0.70,0.44)*3.0*boxL(r,normalize(vec3(-0.55,0.60,0.58)),vec2(0.55,0.34),0.12);
  col+=vec3(0.36,0.60,1.0)*3.4*boxL(r,normalize(vec3(0.80,0.10,-0.60)),vec2(0.10,0.85),0.06);
  col+=vec3(0.85,0.88,1.0)*0.5*boxL(r,normalize(vec3(0.05,-0.85,0.45)),vec2(0.7,0.25),0.2);
  return col;
}
float softShadow(vec3 ro,vec3 rd){float res=1.0,t=0.03;int n=uQ>1.5?28:12;for(int i=0;i<28;i++){if(i>=n)break;float h=map(ro+rd*t);res=min(res,7.0*h/t);t+=clamp(h,0.02,0.2);if(res<0.002||t>2.5)break;}return clamp(res,0.0,1.0);}
float calcAO(vec3 p,vec3 n){float o=0.0,s=1.0;for(int i=0;i<5;i++){float h=0.02+0.07*float(i);o+=(h-map(p+n*h))*s;s*=0.72;}return clamp(1.0-2.2*o,0.0,1.0);}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y);
  vec3 ro=vec3(0.0,0.0,3.2), rd=normalize(vec3(uv,-2.4));
  // bounding sphere
  float b=dot(ro,rd), c0=dot(ro,ro)-1.9*1.9, disc=b*b-c0;
  vec4 outc=vec4(0.0);
  if(disc>0.0){
    float t=-b-sqrt(disc); t=max(t,0.0);
    float tmax=-b+sqrt(disc);
    int maxSteps=uQ>1.5?96:(uQ>0.5?64:40);
    float md=1e5, hit=-1.0;
    for(int i=0;i<96;i++){
      if(i>=maxSteps)break;
      float h=map(ro+rd*t);
      md=min(md,h/ max(t,0.1));
      if(h<0.0012*t){hit=t;break;}
      t+=h*0.72; // conservative: displaced SDF is not exact
      if(t>tmax)break;
    }
    float px=2.0/min(uRes.x,uRes.y);   // ~pixel size in uv units at unit depth
    if(hit>0.0){
      vec3 p=ro+rd*hit; vec3 n=calcN(p);
      vec3 v=-rd; vec3 r=reflect(rd,n);
      float fres=pow(1.0-clamp(dot(n,v),0.0,1.0),4.0);
      vec3 kdir=normalize(vec3(-0.55,0.65,0.55)); vec3 rdir=normalize(vec3(0.75,0.25,-0.62));
      float sh=uQ>0.5?softShadow(p+n*0.02,kdir):1.0;
      float ao=uQ>0.5?calcAO(p,n):1.0;
      float dif=clamp(dot(n,kdir)*0.85+0.15,0.0,1.0);
      float rim=clamp(dot(n,rdir)*0.5+0.5,0.0,1.0);
      float rough=clamp(0.42-0.22*uGloss-0.06*uSnare,0.14,0.5);
      vec3 base=vec3(0.020,0.021,0.026);
      vec3 spec=env(r)*vec3(0.62,0.64,0.68)*mix(1.0,0.6,rough*1.6);
      vec3 col=base*(vec3(1.0,0.72,0.5)*dif*sh*1.6+vec3(0.30,0.52,1.0)*pow(rim,3.0)*0.5+0.04)*ao;
      col+=spec*(0.55+0.9*fres)*ao*mix(0.45,1.0,sh);
      col+=vec3(0.30,0.52,1.0)*fres*0.10*(0.4+0.6*uGloss+1.2*uSnare);
      col*=uTint;
      col*=0.9+0.25*uLoud;
      // filmic tonemap once + gamma once (finish path of this look)
      col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
      col=pow(clamp(col,0.0,1.0),vec3(1.0/2.2));
      outc=vec4(col,1.0);
    } else {
      // soft analytic edge from the minimum normalized distance seen along the ray
      float a=1.0-smoothstep(0.0,px*1.6,md);
      if(a>0.0){vec3 col=vec3(0.02,0.022,0.03);outc=vec4(col*a,a);}
    }
  }
  gl_FragColor=outc;
}`;

const SCULPT = { ok: null, canvas: null, gl: null, prog: null, loc: null, w: 0, h: 0, lastUse: 0, lastT: 0,
                 live: { form: 0, surf: 0, gloss: 0, loud: 0 }, feat: {}, badge: false };

/* xorshift32 -> 4 floats in [0,1); same hash + version => same shape parameters */
function sculptureSeedFromHash(h, version) {
  let x = (((h >>> 0) ^ Math.imul(version || 1, 0x9E3779B1)) >>> 0) || 0x9E3779B9;
  const out = [];
  for (let i = 0; i < 4; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out.push(x / 4294967296);
  }
  return out;
}

/* detail level only (steps / shadow / AO / resolution) — never changes form, seed or motion phase */
function sculptureQuality(mode, perfScale, exporting) {
  if (exporting) return 2;
  if (mode === "high") return 2;
  if (mode === "med") return 1;
  if (mode === "low") return 0;
  const p = perfScale > 0 ? perfScale : 1;
  return p >= 0.75 ? 2 : (p >= 0.5 ? 1 : 0);
}

function sculptureRenderSize(W, H, q, exporting) {
  const cap = exporting ? Math.min(Math.max(W, H), 4096) : ([640, 960, 1280][q] || 960);
  const s = Math.min(1, cap / Math.max(W, H));
  return { w: Math.max(2, Math.round(W * s)), h: Math.max(2, Math.round(H * s)) };
}

/* ±9% neutral tint from the DNA hue, so palette/hue drift is felt without recolouring the material */
function sculptureTint(hueDeg) {
  const h = (((hueDeg % 360) + 360) % 360) / 60, c = 0.5, x = c * (1 - Math.abs(h % 2 - 1));
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return seg.map(v => 1 + (v + 0.5 - 0.75) * 0.36);
}

/* stateless composition growth: the song-phase target (same curve as evolutionTargets) averaged over the
   last ~2.25 s at 4 points — depends only on absolute progress, so a range export equals a full export */
function sculptureGrowth(prog, durSec, map) {
  const target = p => {
    p = Math.max(0, Math.min(1, p));
    let i = map.length - 1;
    for (let k = 0; k < map.length; k++) { if (p >= map[k].a && p < map[k].b) { i = k; break; } }
    const seg = map[i], t = Math.max(0, Math.min(1, (p - seg.a) / Math.max(0.001, seg.b - seg.a)));
    switch (seg.label) {
      case "Birth": return 0.15 + t * 0.25;
      case "Grow": return 0.40 + t * 0.30;
      case "Tension": return 0.70 + t * 0.25;
      case "Break": return 0.45;
      case "Return": return 0.85;
      default: return 0.85 - t * 0.6;
    }
  };
  const step = durSec > 0 ? 0.75 / durSec : 0;
  return (target(prog) + target(prog - step) + target(prog - 2 * step) + target(prog - 3 * step)) / 4;
}

function sculptureCollectFeatures(out, dt) {
  if (S.audioBuffer && !S.micMode && !S.tabAudioMode) {
    if (!(S._sculptTL && S._sculptTL.srcBuffer === S.audioBuffer)) ensureSculptureTimeline();
    if (S._sculptTL && S._sculptTL.srcBuffer === S.audioBuffer) {
      const t = sculptureSongTime(S._hqT, audioEl.currentTime);
      sampleSculptureTimeline(S._sculptTL, t, out);
      out.t = t;
      return out;
    }
  }
  sculptureLiveStep(SCULPT.live, S.bands, S.kickOnset, S.snareOnset, dt, out);
  out.t = S.virtualT;
  return out;
}

function sculptureInitGL() {
  if (SCULPT.ok !== null) return SCULPT.ok;
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
    if (!gl) { SCULPT.ok = false; return false; }
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); if (SCULPT.canvas !== cv) return; SCULPT.ok = null; SCULPT.prog = null; SCULPT.w = SCULPT.h = 0; }, false);
    cv.addEventListener("webglcontextrestored", () => { if (SCULPT.canvas !== cv) return; SCULPT.ok = null; }, false);
    const vs = glCompile(gl, gl.VERTEX_SHADER, SCULPT_VERT);
    const fs = glCompile(gl, gl.FRAGMENT_SHADER, SCULPT_FRAG);
    if (!vs || !fs) { SCULPT.ok = false; return false; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("sculpture link:", gl.getProgramInfoLog(prog)); SCULPT.ok = false; return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ploc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(ploc);
    gl.vertexAttribPointer(ploc, 2, gl.FLOAT, false, 0, 0);
    const loc = {};
    ["uRes", "uT", "uSeed", "uForm", "uSurf", "uGloss", "uKick", "uSnare", "uLoud", "uGrow", "uTint", "uQ"].forEach(n => { loc[n] = gl.getUniformLocation(prog, n); });
    SCULPT.canvas = cv; SCULPT.gl = gl; SCULPT.prog = prog; SCULPT.loc = loc; SCULPT.w = SCULPT.h = 0;
    SCULPT.ok = true;
    return true;
  } catch (e) { console.warn("sculpture GL init failed:", e); SCULPT.ok = false; return false; }
}

function sculptureRenderGL(f, q, W, H, seedArr, grow, tint, calm) {
  const gl = SCULPT.gl, L = SCULPT.loc, sz = sculptureRenderSize(W, H, q, S.exporting);
  if (sz.w !== SCULPT.w || sz.h !== SCULPT.h) {
    SCULPT.canvas.width = sz.w; SCULPT.canvas.height = sz.h; SCULPT.w = sz.w; SCULPT.h = sz.h;
    gl.viewport(0, 0, sz.w, sz.h);
  }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(L.uRes, sz.w, sz.h);
  gl.uniform1f(L.uT, f.t);
  gl.uniform4f(L.uSeed, seedArr[0], seedArr[1], seedArr[2], seedArr[3]);
  gl.uniform1f(L.uForm, f.form); gl.uniform1f(L.uSurf, f.surf); gl.uniform1f(L.uGloss, f.gloss);
  gl.uniform1f(L.uKick, Math.min(1, f.kick * calm)); gl.uniform1f(L.uSnare, Math.min(1, f.snare * calm));
  gl.uniform1f(L.uLoud, f.loud); gl.uniform1f(L.uGrow, grow);
  gl.uniform3f(L.uTint, tint[0], tint[1], tint[2]);
  gl.uniform1f(L.uQ, q);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* no-GPU fallback: a calm graphite orb so the frame is never empty (drawn inside the camera transform) */
function sculptureFallback(base, growthF) {
  const r = base * Math.max(0.4, growthF) * 1.15;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  g.addColorStop(0, "#5b6270"); g.addColorStop(0.35, "#1a1d26"); g.addColorStop(1, "#050508");
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function sculptureBadge(fail) {
  const el = $("sculptBadge");
  if (!el || SCULPT.badge === fail) return;
  SCULPT.badge = fail;
  el.textContent = fail ? "Obsidian Bloom: GPU nicht verfügbar — 2D-Ersatzbild aktiv" : "";
  el.classList.toggle("show", fail);
}

function sculptureRelease() {
  try { if (SCULPT.gl) { const ext = SCULPT.gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } } catch (e) { }
  SCULPT.gl = null; SCULPT.canvas = null; SCULPT.prog = null; SCULPT.loc = null; SCULPT.w = SCULPT.h = 0; SCULPT.ok = null;
}

/* called every frame from the DNA dispatch: frees the GPU context ~5 s after leaving the look */
function sculptureIdleTick(active) {
  if (active) return;
  if (SCULPT.badge) sculptureBadge(false);
  if (SCULPT.gl && performance.now() - SCULPT.lastUse > 5000) sculptureRelease();
}

/* the engine: one GL render per output frame, composited screen-space with an identity transform
   (the scene's 2D camera must NOT be applied twice — the 3D look owns its camera in the shader) */
function drawSculpture(base, hue, growthF, energySize, seed) {
  const W = canvas.width, H = canvas.height, now = performance.now();
  const dt = SCULPT.lastT ? Math.min(0.1, (now - SCULPT.lastT) / 1000) : 1 / 60;
  SCULPT.lastT = now; SCULPT.lastUse = now;
  const f = sculptureCollectFeatures(SCULPT.feat, dt);
  if (!sculptureInitGL()) { sculptureFallback(base, growthF); sculptureBadge(true); return; }
  sculptureBadge(false);
  const q = sculptureQuality(S.sculptQuality || "auto", S.perfScale, S.exporting);
  const seedArr = sculptureSeedFromHash(S.fpHash || 0x9E3779B9, SCULPT_VERSION);
  const calm = S.reduceFlash ? 0.35 : 1;
  const dur = S.audioBuffer ? S.audioBuffer.duration : ((S.micMode || S.tabAudioMode) ? 240 : 180);
  const grow = Math.max(0, Math.min(1, sculptureGrowth(S.progress, dur, songMap()) * 0.6));
  sculptureRenderGL(f, q, W, H, seedArr, grow, sculptureTint(hue), calm);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(SCULPT.canvas, 0, 0, W, H);
  ctx.restore();
}

(function initSculptureUI() {
  const sel = $("sculptQuality");
  if (sel) sel.addEventListener("change", e => { S.sculptQuality = e.target.value; });
})();
