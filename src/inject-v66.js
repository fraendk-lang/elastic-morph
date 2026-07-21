/* ============================================================
   v66 — Phase D: foundation (a11y, WebGL status, creator flash, version)
   ============================================================ */

const APP_VERSION = 66;

function syncReduceFlash(on) {
  S.reduceFlash = !!on;
  if ($("reduceFlash")) $("reduceFlash").checked = S.reduceFlash;
  if ($("creatorReduceFlash")) $("creatorReduceFlash").checked = S.reduceFlash;
}

function updateWebGLBadge() {
  const el = $("webglBadge");
  if (!el) return;
  if (!S.shader || !S.shader.on) {
    el.classList.remove("show");
    return;
  }
  const ok = GL.ok === true || (GL.ok === null && initGL());
  el.classList.toggle("show", !ok);
  el.textContent = ok ? "" : "⚠ WebGL Shader nicht verfügbar";
}

function focusTrapModal(overlay, enable) {
  if (!overlay) return;
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const root = overlay.querySelector("#helpCard, #welCard, .pph-card, #setCard") || overlay;
  if (enable) {
    overlay._focusReturn = document.activeElement;
    overlay._trapKey = e => {
      if (e.key !== "Tab") return;
      const nodes = [...root.querySelectorAll(sel)].filter(n => !n.disabled && n.offsetParent !== null);
      if (nodes.length < 2) return;
      const i = nodes.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!e.shiftKey && i === nodes.length - 1) { e.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener("keydown", overlay._trapKey);
    const first = root.querySelector(sel);
    if (first) setTimeout(() => first.focus(), 0);
  } else {
    if (overlay._trapKey) document.removeEventListener("keydown", overlay._trapKey);
    overlay._trapKey = null;
    if (overlay._focusReturn && overlay._focusReturn.focus) overlay._focusReturn.focus();
  }
}

function wireModalA11y(overlay, isOpen) {
  if (!overlay) return;
  const open = typeof isOpen === "function" ? isOpen() : !!isOpen;
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
  focusTrapModal(overlay, open);
}

function upgradeNavSemantics() { /* nav uses semantic <button> in HTML (v66) */ }

function patchPhaseD() {
  $("creatorReduceFlash")?.addEventListener("change", e => syncReduceFlash(e.target.checked));
  const rf = $("reduceFlash");
  if (rf) {
    const neo = rf.cloneNode(true);
    neo.checked = !!S.reduceFlash;
    rf.replaceWith(neo);
    neo.addEventListener("change", e => syncReduceFlash(e.target.checked));
  }
  if ($("creatorReduceFlash")) $("creatorReduceFlash").checked = !!S.reduceFlash;

  const _initGL = initGL;
  initGL = function () {
    const r = _initGL();
    updateWebGLBadge();
    return r;
  };

  const _renderShader = renderShader;
  renderShader = function (W, H, hue) {
    _renderShader(W, H, hue);
    updateWebGLBadge();
  };

  const _toggleHelp = toggleHelp;
  toggleHelp = function (force) {
    const el = $("helpOverlay");
    const open = force != null ? force : el.style.display !== "flex";
    _toggleHelp(force);
    wireModalA11y(el, el.style.display === "flex");
  };

  const _closeWelcome = closeWelcome;
  closeWelcome = function () {
    wireModalA11y($("welcomeOverlay"), false);
    _closeWelcome();
  };

  const _showWelcome = showWelcome;
  showWelcome = function (force) {
    _showWelcome(force);
    if ($("welcomeOverlay")?.style.display === "flex") wireModalA11y($("welcomeOverlay"), true);
  };

  const _updatePortraitProHint = updatePortraitProHint;
  updatePortraitProHint = function () {
    _updatePortraitProHint();
    const el = $("portraitProHint");
    if (el) wireModalA11y(el, el.classList.contains("show"));
  };

  const _openSetEditor = openSetEditor;
  openSetEditor = function () {
    _openSetEditor();
    wireModalA11y($("setOverlay"), true);
  };

  const _closeSetEditor = closeSetEditor;
  closeSetEditor = function () {
    wireModalA11y($("setOverlay"), false);
    _closeSetEditor();
  };

  updateWebGLBadge();
  if ($("welcomeOverlay")?.style.display === "flex") wireModalA11y($("welcomeOverlay"), true);
}

function initPhaseD() {
  patchPhaseD();
}
