import {
  DEFAULT_SIGNAL_SETTINGS,
  OUTER_GLYPHS,
  TITLE_GLYPHS,
  accentAllowed,
  accentBudgetFor,
  classifyCell,
  getSignalRenderPlan,
  glyphFor,
  hashToUnit,
  isLocalSignalHost,
  isOccupied,
  normalizeSignalSettings,
  parseCssNumber,
} from "./home-signal-field-core.mjs";

const FONT_TIMEOUT_MS = 1500;
const SCAN_PERIOD_MS = 14000;

function hashCell(row, column, phase, salt = 0) {
  let value = (
    Math.imul(row + 1, 374761393)
    ^ Math.imul(column + 1, 668265263)
    ^ Math.imul(phase + 1, 1442695041)
    ^ Math.imul(salt + 1, 1597334677)
  ) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function transformedText(text, transform) {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform !== "capitalize") return text;

  return text.replace(/(^|\s)(\S)/g, (_, prefix, character) => `${prefix}${character.toUpperCase()}`);
}

function fontFromStyle(style) {
  if (style.font) return style.font;

  return [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ].filter(Boolean).join(" ");
}

function textAnchorX(lineBounds, heroBounds, textAlign, direction) {
  const left = lineBounds.left - heroBounds.left;
  const right = lineBounds.right - heroBounds.left;
  const isRightAligned = textAlign === "right"
    || (textAlign === "end" && direction !== "rtl")
    || (textAlign === "start" && direction === "rtl");

  if (textAlign === "center") return (left + right) * 0.5;
  return isRightAligned ? right : left;
}

function textBaselineY(lineBounds, heroBounds, fontSize, lineHeight) {
  const lineBoxHeight = lineBounds.height || lineHeight;
  return (lineBounds.top - heroBounds.top) + ((lineBoxHeight - fontSize) * 0.5) + (fontSize * 0.8);
}

function hasOpaqueMaskPixel(imageData, width, left, top, right, bottom) {
  const startX = Math.max(0, Math.floor(left));
  const startY = Math.max(0, Math.floor(top));
  const endX = Math.min(width, Math.ceil(right));
  const endY = Math.min(imageData.height, Math.ceil(bottom));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (imageData.data[((y * width) + x) * 4 + 3] >= 128) return true;
    }
  }

  return false;
}

function initializeHomeSignalField() {
  const hero = document.querySelector(".home-hero");
  const canvas = document.querySelector(".home-signal-field");
  const title = document.querySelector(".home-title");
  const identity = document.querySelector(".home-identity");
  const statement = document.querySelector(".home-statement");

  if (!hero || !canvas || !title) return;

  const localHost = isLocalSignalHost(window.location.hostname);
  let mountLocalSignalPanel = () => {};
  if (isLocalSignalHost(window.location.hostname)) {
    let panelMountRequested = false;
    mountLocalSignalPanel = () => {
      if (panelMountRequested) return;
      panelMountRequested = true;
      void import("./home-signal-control-panel.mjs")
        .then(({ mountHomeSignalControlPanel }) => mountHomeSignalControlPanel(hero))
        .catch(() => {});
    };
  }

  const context = canvas.getContext("2d");
  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  if (!context || !maskContext) {
    if (localHost) {
      window.dispatchEvent(new CustomEvent("home-signal:telemetry", { detail: { available: false } }));
    }
    canvas.hidden = true;
    canvas.dataset.signalState = "fallback";
    delete hero.dataset.signalReady;
    if (localHost) {
      hero.dispatchEvent(new CustomEvent("home-signal:telemetry", { detail: { available: false } }));
    }
    mountLocalSignalPanel();
    return;
  }

  canvas.hidden = true;
  delete hero.dataset.signalReady;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrowQuery = window.matchMedia("(max-width: 900px)");
  const state = {
    config: null,
    settings: DEFAULT_SIGNAL_SETTINGS,
    renderPlan: null,
    frameId: null,
    lastDrawAt: -Infinity,
    loop: false,
    rootStarts: 0,
    cancels: 0,
    maskDirty: true,
    fallback: false,
    ...(localHost ? { completedFrameTimes: [] } : {}),
  };

  const titleLines = () => {
    const lines = [...title.querySelectorAll(".home-title-line")];
    return lines.length ? lines : [title];
  };

  const readColor = (computed, name, fallback) => (
    computed.getPropertyValue(name).trim() || fallback
  );

  const refreshConfig = () => {
    const computed = getComputedStyle(hero);

    state.config = {
      ...state.settings,
      colors: {
        canvas: readColor(computed, "--canvas", "#F4F3EF"),
        ink: readColor(computed, "--ink", "#090909"),
        muted: readColor(computed, "--muted", "#77736D"),
        signal: readColor(computed, "--signal", "#FF3B14"),
      },
    };
    state.maskDirty = true;
    canvas.dataset.signalDensity = String(state.settings.cellSize);
  };

  const setRuntimeData = (signalState) => {
    canvas.dataset.signalState = signalState;
    canvas.dataset.signalCadence = String(state.renderPlan?.scheduledFps ?? 0);
    canvas.dataset.signalDensity = String(state.renderPlan?.cellSize ?? state.settings.cellSize);
    canvas.dataset.signalLoop = state.loop ? "1" : "0";
    canvas.dataset.signalRootStarts = String(state.rootStarts);
    canvas.dataset.signalCancels = String(state.cancels);
  };

  const persistLocalPanelState = (staticReason) => {
    if (!localHost || !state.renderPlan) return;
    canvas.dataset.signalCadence = String(state.renderPlan.scheduledFps);
    canvas.dataset.signalRequestedFps = String(state.settings.fps);
    if (staticReason) canvas.dataset.signalStaticReason = staticReason;
    else delete canvas.dataset.signalStaticReason;
  };

  const restoreNativeTitleInk = () => {
    title.style.removeProperty("color");
    title.style.removeProperty("-webkit-text-fill-color");
    title.style.removeProperty("-webkit-text-stroke");
    title.style.removeProperty("opacity");
  };

  const applyTitleMode = () => {
    if (state.config.titleMode === "native") {
      title.style.color = state.config.colors.ink;
      title.style.webkitTextFillColor = state.config.colors.ink;
      title.style.webkitTextStroke = "0 transparent";
      title.style.opacity = "1";
      return;
    }

    title.style.webkitTextStroke = "0 transparent";
    if (state.config.titleMode === "overlay") {
      title.style.color = state.config.colors.ink;
      title.style.webkitTextFillColor = state.config.colors.ink;
      title.style.opacity = "0.18";
      return;
    }

    title.style.color = "transparent";
    title.style.webkitTextFillColor = "transparent";
    title.style.opacity = "1";
  };

  const dispatchTelemetry = (detail) => {
    if (!localHost) return;
    window.dispatchEvent(new CustomEvent("home-signal:telemetry", { detail }));
    hero.dispatchEvent(new CustomEvent("home-signal:telemetry", { detail }));
  };

  const clearForFallback = () => {
    if (state.frameId !== null) {
      cancelAnimationFrame(state.frameId);
      state.frameId = null;
      state.cancels += 1;
    }
    state.loop = false;
    state.fallback = true;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    dispatchTelemetry({ available: false });
    canvas.hidden = true;
    delete hero.dataset.signalReady;
    restoreNativeTitleInk();
    setRuntimeData("fallback");
  };

  const buildMask = (bounds) => {
    const width = Math.max(1, Math.ceil(bounds.width));
    const height = Math.max(1, Math.ceil(bounds.height));
    if (mask.width !== width || mask.height !== height) {
      mask.width = width;
      mask.height = height;
    }
    maskContext.clearRect(0, 0, width, height);
    if (state.config.titleMode === "native") {
      state.maskDirty = false;
      return;
    }

    const heroBounds = hero.getBoundingClientRect();
    titleLines().forEach((line) => {
      const style = getComputedStyle(line);
      const lineBounds = line.getBoundingClientRect();
      const fontSize = parseCssNumber(style.fontSize, 16);
      const lineHeight = parseCssNumber(style.lineHeight, fontSize);
      const text = transformedText(line.textContent.trim(), style.textTransform);
      const font = fontFromStyle(style);
      if (!text || !font) return;

      maskContext.save();
      maskContext.font = font;
      maskContext.fillStyle = "#000";
      maskContext.textAlign = style.textAlign;
      maskContext.direction = style.direction;
      maskContext.textBaseline = "alphabetic";
      if ("letterSpacing" in maskContext) maskContext.letterSpacing = style.letterSpacing;
      if ("fontKerning" in maskContext) maskContext.fontKerning = style.fontKerning;
      const x = textAnchorX(lineBounds, heroBounds, style.textAlign, style.direction);
      const baseline = textBaselineY(lineBounds, heroBounds, fontSize, lineHeight);
      maskContext.translate(x, baseline);
      maskContext.scale(state.config.titleScale, state.config.titleScale);
      maskContext.fillText(text, 0, 0);
      maskContext.restore();
    });

    state.maskDirty = false;
  };

  const copyClearanceRects = (bounds, cellSize) => [identity, statement]
    .filter(Boolean)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const padding = state.config.copyClearance * cellSize;
      return {
        left: rect.left - bounds.left - padding,
        top: rect.top - bounds.top - padding,
        right: rect.right - bounds.left + padding,
        bottom: rect.bottom - bounds.top + padding,
      };
    });

  const isInsideClearance = (x, y, rectangles) => rectangles.some((rectangle) => (
    x >= rectangle.left
      && x <= rectangle.right
      && y >= rectangle.top
      && y <= rectangle.bottom
  ));

  const drawScan = (bounds, time) => {
    const phase = (time % SCAN_PERIOD_MS) / SCAN_PERIOD_MS;
    const x = phase * bounds.width;
    const y = (1 - phase) * bounds.height;
    const verticalHalfLength = Math.min(72, bounds.height * 0.1);
    context.save();
    context.strokeStyle = state.config.colors.signal;
    context.globalAlpha = state.config.scanStrength;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, Math.max(0, y - verticalHalfLength));
    context.lineTo(x, Math.min(bounds.height, y + verticalHalfLength));
    context.moveTo(0, y);
    context.lineTo(bounds.width, y);
    context.stroke();
    context.restore();
  };

  const draw = (time = 0) => {
    const bounds = hero.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1 || !state.config) return;

    state.renderPlan = getSignalRenderPlan({
      width: bounds.width,
      height: bounds.height,
      requestedCellSize: state.config.cellSize,
      requestedFps: motionQuery.matches || narrowQuery.matches || document.hidden ? 0 : state.config.fps,
    });
    const { cellSize, columns, rows } = state.renderPlan;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(bounds.width * pixelRatio);
    const pixelHeight = Math.round(bounds.height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      state.maskDirty = true;
    }
    if (state.maskDirty) buildMask(bounds);
    applyTitleMode();

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.fillStyle = state.config.colors.canvas;
    context.fillRect(0, 0, bounds.width, bounds.height);

    const maskData = maskContext.getImageData(0, 0, mask.width, mask.height);
    const clearance = copyClearanceRects(bounds, cellSize);
    const phase = Math.floor(time / (1000 / Math.max(state.renderPlan.scheduledFps, 1)));
    const cells = [];
    let titleCellCount = 0;
    let titleGlyphCount = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const left = column * cellSize;
        const top = row * cellSize;
        const x = left + (cellSize * 0.5);
        const y = top + (cellSize * 0.5);
        const titleMask = state.config.titleMode !== "native"
          && hasOpaqueMaskPixel(maskData, mask.width, left, top, left + cellSize, top + cellSize);
        const role = classifyCell({
          maskAlpha: titleMask ? 128 : 0,
          inCopyClearance: isInsideClearance(x, y, clearance),
        });
        if (role === "clear") continue;

        if (role === "title") titleCellCount += 1;
        cells.push({ column, role, row, x, y });
      }
    }

    const accentBudget = accentBudgetFor(titleCellCount, "title");
    let accentsUsed = 0;
    context.font = `${Math.max(10, cellSize * 0.58)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    cells.forEach((cell) => {
      const value = hashCell(cell.row, cell.column, phase);
      const density = cell.role === "title" ? state.config.titleDensity : state.config.outerDensity;
      if (!isOccupied(hashToUnit(value), density)) return;

      const accentCandidate = cell.role === "title"
        && hashToUnit(hashCell(cell.row, cell.column, phase, 1)) < state.config.orangeRatio;
      const accent = accentAllowed({
        used: accentsUsed,
        budget: accentBudget,
        candidate: accentCandidate,
      });
      if (accent) accentsUsed += 1;

      const glyphSet = cell.role === "title" ? TITLE_GLYPHS : OUTER_GLYPHS;
      const glyph = glyphFor(cell.role, value % glyphSet.length);
      context.fillStyle = accent
        ? state.config.colors.signal
        : (value % 3 === 0 ? state.config.colors.ink : state.config.colors.muted);
      context.globalAlpha = cell.role === "title" ? state.config.titleBlend : 0.58;
      context.fillText(glyph, cell.x, cell.y);
      if (cell.role === "title") titleGlyphCount += 1;
    });

    context.globalAlpha = 1;
    drawScan(bounds, time);

    if (localHost) {
      const cutoff = time - 1000;
      state.completedFrameTimes = state.completedFrameTimes.filter((timestamp) => timestamp > cutoff);
      const isStatic = state.renderPlan.scheduledFps === 0;
        if (!isStatic) state.completedFrameTimes.push(time);
        const staticReason = isStatic && state.settings.fps > 0
          ? (motionQuery.matches ? "reduced-motion" : narrowQuery.matches ? "narrow-viewport" : "document-hidden")
          : "";
        persistLocalPanelState(staticReason);
        dispatchTelemetry({
        available: true,
        columns,
        rows,
        requestedCellSize: state.settings.cellSize,
        effectiveCellSize: cellSize,
        titleCoverage: state.config.titleMode === "native" || titleCellCount === 0
          ? 0
          : titleGlyphCount / titleCellCount,
        requestedFps: state.settings.fps,
        cadenceCapFps: state.renderPlan.cadenceCapFps,
          scheduledFps: state.renderPlan.scheduledFps,
          effectiveFps: isStatic ? 0 : state.completedFrameTimes.length,
          staticReason,
        });
    }
  };

  const cancelLoop = (nextState = "static") => {
    if (state.frameId !== null) {
      cancelAnimationFrame(state.frameId);
      state.frameId = null;
    }
    if (state.loop) state.cancels += 1;
    state.loop = false;
    setRuntimeData(nextState);
  };

  const startLoop = () => {
    if (state.loop || document.hidden || motionQuery.matches || narrowQuery.matches || !state.renderPlan?.scheduledFps) return;

    state.loop = true;
    state.rootStarts += 1;
    setRuntimeData("animated");
    const render = (time) => {
      state.frameId = null;
      if (!state.loop) return;
      const frameInterval = 1000 / state.renderPlan.scheduledFps;
      if (time - state.lastDrawAt >= frameInterval) {
        draw(time);
        state.lastDrawAt = time;
      }
      if (!state.loop) return;
      state.frameId = requestAnimationFrame(render);
    };
    state.frameId = requestAnimationFrame(render);
  };

  const applyRuntimeMode = ({ forceStaticDraw = false } = {}) => {
    if (state.fallback) return;
    try {
      cancelLoop(document.hidden ? "paused" : "static");
      refreshConfig();
      if (document.hidden && !forceStaticDraw) return;

      const now = performance.now();
      draw(now);
      state.lastDrawAt = now;
      if (!motionQuery.matches && !narrowQuery.matches) startLoop();
    } catch {
      clearForFallback();
    }
  };

  const applySettings = (event) => {
    state.settings = normalizeSignalSettings(event.detail, state.settings);
    state.maskDirty = true;
    applyRuntimeMode({ forceStaticDraw: true });
  };

  if (localHost) {
    window.addEventListener("home-signal:settings", applySettings);
    hero.addEventListener("home-signal:settings", applySettings);
  }

  const titleFontReady = async () => {
    if (!document.fonts || typeof document.fonts.check !== "function") return false;
    const fontPromise = Promise.resolve(document.fonts.ready).then(() => true, () => false);
    const timeout = new Promise((resolve) => window.setTimeout(() => resolve(false), FONT_TIMEOUT_MS));
    if (!await Promise.race([fontPromise, timeout])) return false;

    return titleLines().every((line) => {
      const style = getComputedStyle(line);
      const font = fontFromStyle(style);
      const sample = transformedText(line.textContent.trim(), style.textTransform);
      return style.fontFamily.toLowerCase().includes("archivo")
        && Boolean(sample)
        && document.fonts.check(font, sample);
    });
  };

  const addQueryListener = (query, listener) => {
    if (query.addEventListener) query.addEventListener("change", listener);
    else query.addListener(listener);
  };

  setRuntimeData("initializing");
  mountLocalSignalPanel();
  void titleFontReady().then((ready) => {
    if (!ready) {
      clearForFallback();
      return;
    }

    canvas.hidden = false;
    hero.dataset.signalReady = "true";
    refreshConfig();
    applyRuntimeMode();
    window.addEventListener("resize", applyRuntimeMode);
    document.addEventListener("visibilitychange", applyRuntimeMode);
    addQueryListener(motionQuery, applyRuntimeMode);
    addQueryListener(narrowQuery, applyRuntimeMode);
  }).catch(clearForFallback);
}

if (document.querySelector(".home-hero")) {
  initializeHomeSignalField();
}
