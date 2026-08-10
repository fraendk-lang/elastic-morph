/* ============================================================
   v112 — Fix background video filters (scratch canvas blit)
   ctx.filter is ignored for drawImage(HTMLVideoElement) in Chrome/Safari;
   blit video → offscreen canvas → filtered drawImage(canvas) works.
   ============================================================ */

function bgVidScratchCanvas(w, h) {
  if (!S._bgVidScratch) S._bgVidScratch = document.createElement("canvas");
  const c = S._bgVidScratch;
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

function initBgVidFilterFixV112() {
  drawBgVideo = function (W, H) {
    const v = S.bgVid;
    if (!v.on || !v.el || v.el.readyState < 2) return;
    const vw = v.el.videoWidth, vh = v.el.videoHeight;
    if (!vw || !vh) return;
    const scale = v.cover ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const dw = Math.max(1, Math.round(vw * scale));
    const dh = Math.max(1, Math.round(vh * scale));
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    const filt = typeof bgVidFilterCSS === "function" ? bgVidFilterCSS(v) : "none";

    ctx.save();
    ctx.globalAlpha = v.opacity;
    ctx.globalCompositeOperation = v.blend || "source-over";

    if (filt === "none") {
      try { ctx.drawImage(v.el, dx, dy, dw, dh); } catch (e) { }
      ctx.restore();
      return;
    }

    const scratch = bgVidScratchCanvas(dw, dh);
    const sctx = scratch.getContext("2d");
    if (!sctx) { ctx.restore(); return; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, dw, dh);
    try { sctx.drawImage(v.el, 0, 0, dw, dh); } catch (e) { ctx.restore(); return; }

    ctx.filter = filt;
    try { ctx.drawImage(scratch, dx, dy, dw, dh); } catch (e) { }
    ctx.filter = "none";
    ctx.restore();
  };
}
