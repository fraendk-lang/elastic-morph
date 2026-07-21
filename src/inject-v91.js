/* ============================================================
   v91 — Club beat reactivity + kick pulse
   ============================================================ */

function clubBeatSharpness() {
  const bpm = S.bpm || 0;
  return bpm >= 108 && bpm <= 160 ? 0.68 : 0.88;
}

function beatPulseMul() {
  const cp = S.clubPulse || 0;
  return 1 + cp * 0.42;
}

function patchClubBeat() {
  S.kick = 0;
  S.clubPulse = 0;
  S._prevBass = 0;

  const _detectBPM = detectBPM;
  detectBPM = function (ch, sr) {
    try {
      const hop = 512;
      const s0 = Math.floor(ch.length * 0.15);
      const span = Math.min(ch.length - s0, Math.floor(80 * sr));
      const M = Math.floor(span / hop);
      if (M < 400) return { bpm: 0, t0: 0 };

      const env = new Float32Array(M);
      for (let i = 0; i < M; i++) {
        let s = 0;
        const o = s0 + i * hop;
        for (let j = 0; j < hop; j += 4) { const v = ch[o + j] || 0; s += v * v; }
        env[i] = s;
      }
      const on = new Float32Array(M);
      for (let i = 1; i < M; i++) on[i] = Math.max(0, env[i] - env[i - 1]);

      let bestBpm = 0, bestScore = -1, bestLag = 0;
      for (let bpm = 60; bpm <= 190; bpm++) {
        const lag = Math.round((60 / bpm) * sr / hop);
        if (lag < 4 || lag >= M / 2) continue;
        let score = 0;
        for (let i = 0; i + lag < M; i++) score += on[i] * on[i + lag];
        // Club range preference: house/techno 118–140
        score *= 1 - Math.abs(bpm - 128) / 420;
        if (score > bestScore) { bestScore = score; bestBpm = bpm; bestLag = lag; }
      }
      if (!bestBpm) return _detectBPM(ch, sr);

      let bestOff = 0, bestSum = -1;
      for (let o = 0; o < bestLag; o++) {
        let s = 0;
        for (let k = o; k < M; k += bestLag) s += on[k];
        if (s > bestSum) { bestSum = s; bestOff = o; }
      }
      return { bpm: bestBpm, t0: (s0 + bestOff * hop) / sr };
    } catch (e) {
      return _detectBPM(ch, sr);
    }
  };

  const _updateAudioFeatures = updateAudioFeatures;
  updateAudioFeatures = function (dt) {
    _updateAudioFeatures(dt);

    const prevB = S._prevBass || 0;
    const bassJump = Math.max(0, S.bass - prevB);
    S._prevBass = S.bass * 0.55 + prevB * 0.45;
    S.kick = Math.max(S.kick * Math.pow(0.78, dt * 60), Math.min(1, bassJump * 7.5 + S.transient * 0.35));

    if (S.bpm > 0 && !S.micMode && (S.playing || S.exporting)) {
      const sharp = clubBeatSharpness();
      S.beat = Math.min(1, Math.pow(Math.max(0, S.beat), sharp));
      if (S.kick > 0.35) S.beat = Math.max(S.beat, S.kick * 0.92);
    }

    const bpm = S.bpm || 0;
    const clubRange = bpm >= 108 && bpm <= 160;
    S.clubPulse = Math.min(1,
      S.beat * 0.75 + S.kick * 0.65 + S.transient * 0.2 + (clubRange ? 0.08 : 0));
  };

  const _liveMul = liveMul;
  liveMul = function (key) {
    const base = _liveMul(key);
    if (key === "pulse") return base * beatPulseMul();
    return base;
  };

  const _renderShader = renderShader;
  renderShader = function (W, H, hue) {
    if (!S.shader.on) return;
    const kickBoost = 1 + (S.kick || 0) * 0.35;
    const prevBeat = S.beat;
    S.beat = Math.min(1.5, (S.beat || 0) * kickBoost);
    try { _renderShader(W, H, hue); }
    finally { S.beat = prevBeat; }
  };

  const _drawScene = drawScene;
  drawScene = function (dt) {
    const cp = S.clubPulse || 0;
    const prevBeat = S.beat;
    if (cp > 0.04) S.beat = Math.min(1.35, S.beat + cp * 0.34);
    _drawScene(dt);
    S.beat = prevBeat;
  };
}

function initClubBeat() {
  patchClubBeat();
}

function registerClubPresets() {
  const adds = [
    {
      id: "danceTechno", name: "Techno Warehouse",
      desc: "Industrieller Grid-Floor, Kick-Strobe & Side-Laser. Techno, Hardgroove, Peak-Time.",
      hue: 165, hueEnd: 290, sat: 88, bgFade: 0.48,
      layers: 1, points: 0, noiseAmp: 0, speed: 0.45,
      particles: 0, particleStyle: "spark", symmetry: 1,
      verticalStretch: 1.0, grain: 0.06, lineMode: false, petals: 0, glass: false,
      motion: "orbit", flowBias: 0, constellation: false, bloom: 0.72, waveRing: false,
      engine: "dance", danceStyle: "techno",
      gradient: ["#020810", "#0a2840", "#00ffc8"]
    },
    {
      id: "clubStrobe", name: "Club Strobe",
      desc: "Harte Blob-Pulse & Spark-Partikel auf jeden Kick. House, EDM, Club.",
      hue: 280, hueEnd: 200, sat: 92, bgFade: 0.055,
      layers: 3, points: 72, noiseAmp: 0.62, speed: 0.55,
      particles: 220, particleStyle: "spark", symmetry: 2,
      verticalStretch: 1.0, grain: 0.05, lineMode: false, petals: 0, glass: false,
      motion: "orbit", flowBias: 0, constellation: true, bloom: 0.68, waveRing: false,
      gradient: ["#120018", "#5a1080", "#ff4fd8"]
    },
    {
      id: "hardGroove", name: "Hard Groove",
      desc: "Aggressive Linien-Creature mit Beat-Snap. Techno, Electro, Breakbeat.",
      hue: 350, hueEnd: 40, sat: 88, bgFade: 0.05,
      layers: 5, points: 80, noiseAmp: 0.48, speed: 0.62,
      particles: 140, particleStyle: "shard", symmetry: 1,
      verticalStretch: 0.95, grain: 0.08, lineMode: true, petals: 0, glass: false,
      motion: "orbit", flowBias: 0.1, constellation: false, bloom: 0.58, waveRing: true,
      gradient: ["#180008", "#801028", "#ff6080"]
    },
    {
      id: "warehouseRave", name: "Warehouse Rave",
      desc: "Reaction-Diffusion mit Kick-Injection — organisch aber hart. Techno, Rave, Industrial.",
      hue: 130, hueEnd: 220, sat: 82, bgFade: 0.06,
      layers: 1, points: 0, noiseAmp: 0, speed: 0.5,
      particles: 0, particleStyle: "soft", symmetry: 1,
      verticalStretch: 1.0, grain: 0.12, lineMode: false, petals: 0, glass: false,
      motion: "flow", flowBias: 0, constellation: false, bloom: 0.62, waveRing: false,
      engine: "reaction",
      gradient: ["#040a06", "#1a5038", "#7affc0"]
    },
    {
      id: "laserGrid", name: "Laser Grid",
      desc: "Spektrum + Laser-Fächer + Four-on-the-Floor. House, Trance, EDM.",
      hue: 210, hueEnd: 320, sat: 90, bgFade: 0.45,
      layers: 1, points: 0, noiseAmp: 0, speed: 0.5,
      particles: 80, particleStyle: "spark", symmetry: 1,
      verticalStretch: 1.0, grain: 0, lineMode: false, petals: 0, glass: false,
      motion: "orbit", flowBias: 0, constellation: false, bloom: 0.75, waveRing: false,
      engine: "dance", danceStyle: "club",
      gradient: ["#040818", "#2840a0", "#80d0ff"]
    }
  ];
  for (const p of adds) {
    if (!PRESETS.find(x => x.id === p.id)) PRESETS.push(p);
  }
}

function initClubPresets() {
  registerClubPresets();
}
