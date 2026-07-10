const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("js");

if (reduceMotion) document.documentElement.classList.add("motion-reduced");

const current = new URL(window.location.href).pathname.split("/").pop() || "index.html";

document.querySelectorAll("[data-nav-page]").forEach((link) => {
  const routeAliases = link.dataset.navPage.split(/\s+/);

  if (routeAliases.includes(current)) {
    link.setAttribute("aria-current", "page");
    link.querySelector(".status-dot")?.removeAttribute("hidden");
  }
});

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, instance) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      entry.target.classList.add("is-visible");
      instance.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}

function initializeHomeSignalField() {
  const canvas = document.querySelector(".home-signal-field");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrowQuery = window.matchMedia("(max-width: 900px)");
  const ASCII_GLYPHS = ["·", ":", "+", "#"];
  const MAX_FPS = 8;
  const FRAME_INTERVAL = 1000 / MAX_FPS;
  const CELL_SIZE_DESKTOP = 44;
  const CELL_SIZE_NARROW = 54;
  const MAX_ORANGE_RATIO = 0.02;
  const SAFE_ZONE_RATIO = 0.42;
  const SAFE_ZONE_RATIO_NARROW = 1;
  let frameId = null;
  let isLooping = false;
  let lastDrawAt = -Infinity;
  let rootStarts = 0;
  let cancels = 0;

  const readColor = (name, fallback) => (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  );

  const colors = {
    canvas: readColor("--canvas", "#F4F3EF"),
    ink: readColor("--ink", "#090909"),
    muted: readColor("--muted", "#77736D"),
    signal: readColor("--signal", "#FF3B14")
  };

  const setState = (mode, loop) => {
    canvas.dataset.signalMode = mode;
    canvas.dataset.signalLoop = loop ? "1" : "0";
    canvas.dataset.signalCadence = String(MAX_FPS);
    canvas.dataset.signalDensity = narrowQuery.matches ? String(CELL_SIZE_NARROW) : String(CELL_SIZE_DESKTOP);
    canvas.dataset.signalRootStarts = String(rootStarts);
    canvas.dataset.signalCancels = String(cancels);
  };

  const hashCell = (row, column, phase) => {
    let value = (Math.imul(row + 1, 374761393) ^ Math.imul(column + 1, 668265263) ^ Math.imul(phase + 1, 1442695041)) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };

  const draw = (time = 0) => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(bounds.width * pixelRatio);
    const pixelHeight = Math.round(bounds.height * pixelRatio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.fillStyle = colors.canvas;
    context.globalAlpha = 1;
    context.fillRect(0, 0, bounds.width, bounds.height);
    const cellSize = narrowQuery.matches ? CELL_SIZE_NARROW : CELL_SIZE_DESKTOP;
    const columns = Math.ceil(bounds.width / cellSize);
    const rows = Math.ceil(bounds.height / cellSize);
    const phase = Math.floor(time / FRAME_INTERVAL);
    const cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = hashCell(row, column, phase);
        if (value % 5 > 1) continue;
        const x = (column * cellSize) + (cellSize * 0.5);
        const y = (row * cellSize) + (cellSize * 0.5);
        cells.push({ value, x, y });
      }
    }

    const accentBudget = Math.floor(cells.length * MAX_ORANGE_RATIO);
    const safeZoneRatio = narrowQuery.matches ? SAFE_ZONE_RATIO_NARROW : SAFE_ZONE_RATIO;
    let accents = 0;
    context.font = "12px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    cells.forEach(({ value, x, y }) => {
      const accent = x >= bounds.width * safeZoneRatio && value % 101 === 0 && accents < accentBudget;
      if (accent) accents += 1;
      const glyph = ASCII_GLYPHS[value % ASCII_GLYPHS.length];
      context.fillStyle = accent ? colors.signal : (value % 3 === 0 ? colors.ink : colors.muted);
      context.globalAlpha = accent ? 0.82 : 0.55;
      context.fillText(glyph, x, y);
    });
    context.globalAlpha = 1;
  };

  const cancelLoop = () => {
    if (!isLooping) return;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    isLooping = false;
    cancels += 1;
    setState("static", false);
  };

  const startLoop = () => {
    if (isLooping) return;

    isLooping = true;
    rootStarts += 1;
    setState("animated", true);

    const render = (time) => {
      frameId = null;
      if (!isLooping) return;
      if (time - lastDrawAt >= FRAME_INTERVAL) {
        draw(time);
        lastDrawAt = time;
      }
      if (!isLooping) return;
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
  };

  const applyMotionPreference = () => {
    cancelLoop();
    const isStatic = motionQuery.matches || narrowQuery.matches;
    setState(isStatic ? "static" : "animated", false);
    draw(0);
    lastDrawAt = performance.now();
    if (isStatic) {
      return;
    }

    startLoop();
  };

  window.addEventListener("resize", () => {
    if (motionQuery.matches || narrowQuery.matches) {
      draw(0);
      return;
    }
    const now = performance.now();
    draw(now);
    lastDrawAt = now;
  });

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener("change", applyMotionPreference);
  } else {
    motionQuery.addListener(applyMotionPreference);
  }
  if (narrowQuery.addEventListener) {
    narrowQuery.addEventListener("change", applyMotionPreference);
  } else {
    narrowQuery.addListener(applyMotionPreference);
  }

  applyMotionPreference();
}

initializeHomeSignalField();

