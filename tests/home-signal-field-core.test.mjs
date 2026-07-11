import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DEFAULT_SIGNAL_SETTINGS,
  OUTER_GLYPHS,
  SIGNAL_PRESETS,
  TITLE_GLYPHS,
  ORANGE_RATIO,
  accentAllowed,
  accentBudgetFor,
  classifyCell,
  getSignalRenderPlan,
  glyphFor,
  hashToUnit,
  isLocalSignalHost,
  isOccupied,
  normalizeLocalHostname,
  normalizeSignalSettings,
  parseCssNumber,
} from "../scripts/home-signal-field-core.mjs";

test("exports the exact outer and title glyph strings", () => {
  assert.equal(OUTER_GLYPHS, ".:+*");
  assert.equal(TITLE_GLYPHS, "@#8%&");
});

test("classifies the alpha threshold at 128", () => {
  assert.equal(classifyCell({ maskAlpha: 128, inCopyClearance: false }), "title");
  assert.equal(classifyCell({ maskAlpha: 127, inCopyClearance: false }), "outer");
});

test("gives copy clearance precedence over a title mask", () => {
  assert.equal(classifyCell({ maskAlpha: 255, inCopyClearance: true }), "clear");
});

test("uses the density boundary for occupancy", () => {
  assert.equal(isOccupied(0.139, 0.14), true);
  assert.equal(isOccupied(0.14, 0.14), false);
});

test("selects glyphs deterministically and wraps their indexes", () => {
  assert.equal(glyphFor("outer", 0), ".");
  assert.equal(glyphFor("outer", 5), ":");
  assert.equal(glyphFor("title", 0), "@");
  assert.equal(glyphFor("title", 6), "#");
});

test("allows accents only for candidates below the budget", () => {
  assert.equal(accentAllowed({ used: 1, budget: 2, candidate: true }), true);
  assert.equal(accentAllowed({ used: 2, budget: 2, candidate: true }), false);
  assert.equal(accentAllowed({ used: 0, budget: 2, candidate: false }), false);
});

test("sets a two-percent title accent budget and no outer budget", () => {
  assert.equal(ORANGE_RATIO, 0.02);
  assert.equal(accentBudgetFor(99, "title"), 1);
  assert.equal(accentBudgetFor(100, "title"), 2);
  assert.equal(accentBudgetFor(100, "outer"), 0);
});

test("normalizes both hash endpoints", () => {
  assert.equal(hashToUnit(0), 0);
  assert.equal(hashToUnit(0xffffffff), 1);
});

test("parses positive CSS numbers and falls back for invalid values", () => {
  assert.equal(parseCssNumber("12.5px", 8), 12.5);
  assert.equal(parseCssNumber("0", 8), 8);
  assert.equal(parseCssNumber("-3", 8), 8);
  assert.equal(parseCssNumber("invalid", 8), 8);
});

test("defines immutable current and Aino Dense Signal Lab presets", () => {
  assert.equal(Object.isFrozen(DEFAULT_SIGNAL_SETTINGS), true);
  assert.equal(Object.isFrozen(SIGNAL_PRESETS), true);
  assert.equal(Object.isFrozen(SIGNAL_PRESETS.current), true);
  assert.equal(Object.isFrozen(SIGNAL_PRESETS.ainoDense), true);
  assert.equal(Object.isFrozen(SIGNAL_PRESETS.typeFirst), true);
  assert.deepEqual(SIGNAL_PRESETS.current, DEFAULT_SIGNAL_SETTINGS);
  assert.equal(DEFAULT_SIGNAL_SETTINGS.orangeRatio, 0.02);
  assert.equal(DEFAULT_SIGNAL_SETTINGS.fps, 7);

  assert.deepEqual(SIGNAL_PRESETS.ainoDense, {
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
  });
});

test("normalizes only supported Signal Lab settings into a fresh object", () => {
  const changed = normalizeSignalSettings({ outerDensity: 0.65, cellSize: 14 }, DEFAULT_SIGNAL_SETTINGS);
  const retained = normalizeSignalSettings({
    outerDensity: Number.NaN,
    cellSize: Number.POSITIVE_INFINITY,
    unknownKey: 99,
  }, changed);

  assert.notEqual(changed, DEFAULT_SIGNAL_SETTINGS);
  assert.notEqual(retained, changed);
  assert.deepEqual(changed, { ...DEFAULT_SIGNAL_SETTINGS, outerDensity: 0.65, cellSize: 14 });
  assert.equal(retained.outerDensity, 0.65);
  assert.equal(retained.cellSize, 14);
  assert.equal("unknownKey" in retained, false);
});

test("clamps numeric settings and retains the previous title mode for invalid input", () => {
  const normalized = normalizeSignalSettings({
    outerDensity: -1,
    cellSize: 999,
    fps: -2,
    scanStrength: 2,
    titleDensity: -1,
    titleScale: 4,
    titleBlend: 2,
    orangeRatio: 1,
    copyClearance: 3,
    titleMode: "invalid",
  }, { ...DEFAULT_SIGNAL_SETTINGS, titleMode: "overlay" });

  assert.deepEqual(normalized, {
    ...DEFAULT_SIGNAL_SETTINGS,
    outerDensity: 0,
    cellSize: 64,
    fps: 0,
    scanStrength: 1,
    titleDensity: 0,
    titleScale: 2,
    titleBlend: 1,
    orangeRatio: 0.35,
    copyClearance: 2.5,
    titleMode: "overlay",
  });
});

test("recognizes only normalized local Signal Lab hosts", () => {
  assert.equal(normalizeLocalHostname(" [::1] "), "::1");
  assert.equal(normalizeLocalHostname("LOCALHOST"), "localhost");
  assert.equal(isLocalSignalHost("[::1]"), true);
  assert.equal(isLocalSignalHost("[::1"), false);
  assert.equal(isLocalSignalHost("::1]"), false);
  assert.equal(isLocalSignalHost("127.0.0.1"), true);
  assert.equal(isLocalSignalHost("localhost"), true);
  assert.equal(isLocalSignalHost("portfolio.example"), false);
  assert.equal(isLocalSignalHost("localhost.example"), false);
});

test("plans static and capped rendering cadence at each cell-budget threshold", () => {
  const planAt = (cells, requestedFps = 12) => getSignalRenderPlan({
    width: cells * 10,
    height: 1,
    requestedCellSize: 10,
    requestedFps,
  });

  assert.deepEqual(planAt(3200), {
    cellSize: 10,
    columns: 3200,
    rows: 1,
    cells: 3200,
    cadenceCapFps: 12,
    scheduledFps: 12,
  });
  assert.equal(planAt(3201).cadenceCapFps, 10);
  assert.equal(planAt(3201).scheduledFps, 10);
  assert.equal(planAt(5000).cadenceCapFps, 10);
  assert.equal(planAt(5001).cadenceCapFps, 8);
  assert.equal(planAt(5001).scheduledFps, 8);
  assert.equal(planAt(3200, 0).scheduledFps, 0);
});

test("raises tiny requested cell sizes until square and uneven viewports fit the cell budget", () => {
  const small = getSignalRenderPlan({ width: 10, height: 10, requestedCellSize: 1, requestedFps: 8 });
  const large = getSignalRenderPlan({ width: 10, height: 10, requestedCellSize: 999, requestedFps: 8 });
  const square = getSignalRenderPlan({ width: 800, height: 800, requestedCellSize: 1, requestedFps: 8 });
  const uneven = getSignalRenderPlan({ width: 5000, height: 100, requestedCellSize: 1, requestedFps: 8 });

  assert.equal(small.cellSize, 8);
  assert.equal(large.cellSize, 64);
  assert.ok(square.cells <= 6400);
  assert.ok(uneven.cells <= 6400);
  assert.ok(square.cellSize >= 8);
  assert.ok(uneven.cellSize >= 8);
});

test("renderer mask honors each title line's computed alignment and direction", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");

  assert.match(renderer, /maskContext\.textAlign\s*=\s*style\.textAlign/);
  assert.match(renderer, /maskContext\.direction\s*=\s*style\.direction/);
  assert.match(renderer, /const x = textAnchorX\(lineBounds, heroBounds, style\.textAlign, style\.direction\)/);
  assert.match(renderer, /const baseline = textBaselineY\(lineBounds, heroBounds, fontSize, lineHeight\)/);
});

test("renderer font check prefers the browser-valid computed font shorthand", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");

  assert.match(renderer, /function fontFromStyle\(style\) \{\s*if \(style\.font\) return style\.font;/);
  assert.match(renderer, /style\.fontStretch/);
});

test("renderer scopes Signal Lab telemetry and frame tracking to local hosts with its full payload contract", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");
  const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(renderer, /DEFAULT_SIGNAL_SETTINGS/);
  assert.match(renderer, /normalizeSignalSettings/);
  assert.match(renderer, /isLocalSignalHost\(window\.location\.hostname\)/);
  assert.match(renderer, /getSignalRenderPlan/);
  assert.match(renderer, /state\.settings/);
  assert.match(renderer, /\.\.\.\(localHost \? \{ completedFrameTimes: \[\] \} : \{\}\),/);
  assert.match(renderer, /const dispatchTelemetry = \(detail\) => \{\s*if \(!localHost\) return;\s*window\.dispatchEvent\(new CustomEvent\("home-signal:telemetry", \{ detail \}\)\);/);
  assert.match(renderer, /if \(localHost\) \{\s*window\.addEventListener\("home-signal:settings",/);
  assert.match(renderer, /if \(localHost\) \{\s*const cutoff = time - 1000;[\s\S]*?dispatchTelemetry\(\{\s*available: true,/);
  assert.match(renderer, /requestedCellSize: state\.settings\.cellSize/);
  assert.match(renderer, /effectiveCellSize: cellSize/);
  assert.match(renderer, /titleCoverage: state\.config\.titleMode === "native" \|\| titleCellCount === 0\s*\? 0/);
  assert.match(renderer, /requestedFps: state\.settings\.fps/);
  assert.match(renderer, /cadenceCapFps: state\.renderPlan\.cadenceCapFps/);
  assert.match(renderer, /scheduledFps: state\.renderPlan\.scheduledFps/);
  assert.match(renderer, /effectiveFps: isStatic \? 0 : state\.completedFrameTimes\.length/);
  assert.match(renderer, /requestedFps: motionQuery\.matches \|\| narrowQuery\.matches \|\| document\.hidden \? 0 : state\.config\.fps/);
  assert.match(renderer, /applyRuntimeMode\(\{ forceStaticDraw: true \}\);/);
  assert.doesNotMatch(homepage, /scripts\/home-signal-lab\.mjs/);
  assert.doesNotMatch(homepage, /id=["']signal-lab["']/);
});

test("renderer reports a local unavailable state for synchronous Canvas initialization failure", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");

  assert.match(renderer, /const localHost = isLocalSignalHost\(window\.location\.hostname\);[\s\S]*?if \(!context \|\| !maskContext\) \{\s*if \(localHost\) \{\s*window\.dispatchEvent\(new CustomEvent\("home-signal:telemetry", \{ detail: \{ available: false \} \}\)\);\s*\}\s*canvas\.hidden = true;[\s\S]*?return;/);
});

test("renderer failure paths preserve the native-text hero without a scan", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(homepage, /<canvas class="home-signal-field" aria-hidden="true" hidden/);
  assert.match(renderer, /canvas\.hidden = true;/);
  assert.match(renderer, /delete hero\.dataset\.signalReady;/);
  assert.match(renderer, /if \(!context \|\| !maskContext\) \{/);
  assert.doesNotMatch(css, /\.home-page \.home-hero::before/);
  assert.match(css, /\.home-page \.home-hero:not\(\[data-signal-ready="true"\]\) \.home-signal-ticker span\s*\{[\s\S]*animation:\s*none/);
});

test("scan crosshair is renderer-only, short vertically, and ticker stays visible when motion is reduced", async () => {
  const renderer = await readFile(new URL("../scripts/home-signal-field.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(renderer, /const verticalHalfLength = Math\.min\(72, bounds\.height \* 0\.1\);/);
  assert.match(renderer, /context\.moveTo\(x, Math\.max\(0, y - verticalHalfLength\)\);/);
  assert.match(renderer, /context\.lineTo\(x, Math\.min\(bounds\.height, y \+ verticalHalfLength\)\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-page \.home-signal-ticker span\s*\{[\s\S]*animation:\s*none !important/);
  assert.doesNotMatch(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-signal-ticker\s*\{\s*display:\s*none/);
});
