export const OUTER_GLYPHS = ".:+*";
export const TITLE_GLYPHS = "@#8%&";

const NUMERIC_SETTING_LIMITS = Object.freeze({
  outerDensity: [0, 1],
  cellSize: [8, 64],
  fps: [0, 12],
  scanStrength: [0, 1],
  titleDensity: [0, 1],
  titleScale: [0.5, 2],
  titleBlend: [0, 1],
  orangeRatio: [0, 0.35],
  copyClearance: [0, 2.5],
});

const TITLE_MODES = new Set(["native", "ascii", "overlay"]);
const MAX_SIGNAL_CELLS = 6400;

export const DEFAULT_SIGNAL_SETTINGS = Object.freeze({
  outerDensity: 0.14,
  cellSize: 44,
  fps: 7,
  scanStrength: 0.34,
  titleDensity: 0.78,
  titleScale: 1,
  titleBlend: 1,
  orangeRatio: 0.02,
  copyClearance: 1.25,
  titleMode: "ascii",
});

export const SIGNAL_PRESETS = Object.freeze({
  current: Object.freeze({ ...DEFAULT_SIGNAL_SETTINGS }),
  ainoDense: Object.freeze({
    outerDensity: 0.65,
    cellSize: 14,
    fps: 8,
    scanStrength: 0.45,
    titleDensity: 0.98,
    titleScale: 0.85,
    titleBlend: 0.82,
    orangeRatio: 0.08,
    copyClearance: 1,
    titleMode: "ascii",
  }),
  typeFirst: Object.freeze({
    outerDensity: 0.18,
    cellSize: 20,
    fps: 8,
    scanStrength: 0.25,
    titleDensity: 0.98,
    titleScale: 0.72,
    titleBlend: 1,
    orangeRatio: 0.03,
    copyClearance: 1.25,
    titleMode: "ascii",
  }),
});

function clamp(value, [minimum, maximum]) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validPreviousSettings(previousSettings) {
  const previous = previousSettings && typeof previousSettings === "object" ? previousSettings : {};
  const settings = { ...DEFAULT_SIGNAL_SETTINGS };

  for (const [key, limits] of Object.entries(NUMERIC_SETTING_LIMITS)) {
    if (Number.isFinite(previous[key])) settings[key] = clamp(previous[key], limits);
  }

  if (TITLE_MODES.has(previous.titleMode)) settings.titleMode = previous.titleMode;
  return settings;
}

export function normalizeSignalSettings(partial, previousSettings = DEFAULT_SIGNAL_SETTINGS) {
  const settings = validPreviousSettings(previousSettings);
  if (!partial || typeof partial !== "object") return settings;

  for (const [key, limits] of Object.entries(NUMERIC_SETTING_LIMITS)) {
    if (Object.hasOwn(partial, key) && Number.isFinite(partial[key])) {
      settings[key] = clamp(partial[key], limits);
    }
  }

  if (Object.hasOwn(partial, "titleMode") && TITLE_MODES.has(partial.titleMode)) {
    settings.titleMode = partial.titleMode;
  }

  return settings;
}

export function normalizeLocalHostname(hostname) {
  const host = String(hostname ?? "").trim().toLowerCase();
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function isLocalSignalHost(hostname) {
  const host = normalizeLocalHostname(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function getSignalRenderPlan({ width, height, requestedCellSize, requestedFps }) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const safeRequestedCellSize = clamp(
    Number.isFinite(requestedCellSize) && requestedCellSize > 0
      ? requestedCellSize
      : DEFAULT_SIGNAL_SETTINGS.cellSize,
    NUMERIC_SETTING_LIMITS.cellSize,
  );
  const requestedFpsValue = Number.isFinite(requestedFps) && requestedFps > 0 ? requestedFps : 0;
  let cellSize = Math.max(safeRequestedCellSize, Math.sqrt((safeWidth * safeHeight) / MAX_SIGNAL_CELLS));
  let columns = Math.ceil(safeWidth / cellSize);
  let rows = Math.ceil(safeHeight / cellSize);

  while (columns * rows > MAX_SIGNAL_CELLS) {
    cellSize += 0.25;
    columns = Math.ceil(safeWidth / cellSize);
    rows = Math.ceil(safeHeight / cellSize);
  }

  const cells = columns * rows;
  const cadenceCapFps = cells > 5000 ? 8 : cells > 3200 ? 10 : 12;

  return {
    cellSize,
    columns,
    rows,
    cells,
    cadenceCapFps,
    scheduledFps: requestedFpsValue === 0 ? 0 : Math.min(requestedFpsValue, cadenceCapFps),
  };
}

export function classifyCell({ maskAlpha, inCopyClearance }) {
  if (inCopyClearance) return "clear";
  return maskAlpha >= 128 ? "title" : "outer";
}

export function isOccupied(normalizedHash, density) {
  return normalizedHash < density;
}

export function glyphFor(role, index) {
  const glyphs = role === "title" ? TITLE_GLYPHS : OUTER_GLYPHS;
  return glyphs[index % glyphs.length];
}

export function accentAllowed({ used, budget, candidate }) {
  return candidate && used < budget;
}

export const ORANGE_RATIO = 0.02;

export function hashToUnit(hash) {
  return hash / 0xffffffff;
}

export function accentBudgetFor(cellCount, region) {
  return region === "title" ? Math.floor(cellCount * ORANGE_RATIO) : 0;
}

export function parseCssNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
