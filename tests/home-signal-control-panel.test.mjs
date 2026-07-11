import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panelUrl = new URL("../scripts/home-signal-control-panel.mjs", import.meta.url);
const rendererUrl = new URL("../scripts/home-signal-field.mjs", import.meta.url);
const stylesUrl = new URL("../styles.css", import.meta.url);
const redesignVerifierUrl = new URL("../scripts/verify_redesign.ps1", import.meta.url);
const siteVerifierUrl = new URL("../scripts/verify_site.ps1", import.meta.url);

test("exports a single mount function for the local SIGNAL LAB", async () => {
  const panel = await readFile(panelUrl, "utf8");

  assert.match(panel, /export function mountHomeSignalControlPanel\(hero\)/);
  assert.match(panel, /home-signal-lab/);
  assert.match(panel, /setAttribute\("aria-label", "SIGNAL LAB"\)/);
  assert.match(panel, /createElement\("summary"\)/);
  assert.match(panel, /summary\.textContent = "SIGNAL LAB"/);
});

test("defines every approved control with a visible numeric output", async () => {
  const panel = await readFile(panelUrl, "utf8");

  for (const [key, min, max, step] of [
    ["outerDensity", "0", "1", "0.01"],
    ["cellSize", "8", "64", "1"],
    ["fps", "0", "12", "1"],
    ["scanStrength", "0", "1", "0.01"],
    ["titleDensity", "0", "1", "0.01"],
    ["titleScale", "0.5", "2", "0.05"],
    ["titleBlend", "0", "1", "0.01"],
    ["orangeRatio", "0", "0.35", "0.01"],
    ["copyClearance", "0", "2.5", "0.05"],
  ]) {
    assert.match(panel, new RegExp(`key: ["']${key}["'][\\s\\S]*?min: ["']${min}["'][\\s\\S]*?max: ["']${max}["'][\\s\\S]*?step: ["']${step}["']`));
  }
  assert.match(panel, /createElement\("output"\)/);
  assert.match(panel, /titleMode/);
  assert.match(panel, /\["native", "ascii", "overlay"\]/);
});

test("bridges partial settings, full presets, and telemetry through the hero", async () => {
  const panel = await readFile(panelUrl, "utf8");

  assert.match(panel, /hero\.dispatchEvent\(new CustomEvent\("home-signal:settings", \{\s*detail: \{ \[settingKey\]: Number\(input\.value\) \}/);
  assert.match(panel, /hero\.dispatchEvent\(new CustomEvent\("home-signal:settings", \{\s*detail: \{ titleMode: select\.value \}/);
  assert.match(panel, /SIGNAL_PRESETS\.current/);
  assert.match(panel, /SIGNAL_PRESETS\.ainoDense/);
  assert.match(panel, /SIGNAL_PRESETS\.typeFirst/);
  assert.match(panel, /Current/);
  assert.match(panel, /Aino Dense/);
  assert.match(panel, /Type-First/);
  assert.match(panel, /hero\.addEventListener\("home-signal:telemetry"/);
  assert.match(panel, /const staticMotion = available && detail\.scheduledFps === 0 && detail\.requestedFps > 0;/);
  assert.match(panel, /fpsInput\.disabled = staticMotion/);
  assert.match(panel, /Renderer unavailable/);
});

test("keeps intentional zero-FPS adjustment available but explains accessibility static mode", async () => {
  const panel = await readFile(panelUrl, "utf8");

  assert.match(panel, /const staticMotion = available && detail\.scheduledFps === 0 && detail\.requestedFps > 0;/);
  assert.match(panel, /status\.role = "status";/);
  assert.match(panel, /status\.setAttribute\("aria-live", "polite"\);/);
  assert.match(panel, /fpsInput\.setAttribute\("aria-describedby", status\.id\);/);
  assert.match(panel, /fpsInput\.removeAttribute\("aria-describedby"\);/);
});

test("reads delayed local static-state telemetry from renderer data without locking intentional zero FPS", async () => {
  const panel = await readFile(panelUrl, "utf8");
  const renderer = await readFile(rendererUrl, "utf8");

  assert.match(renderer, /canvas\.dataset\.signalRequestedFps = String\(state\.settings\.fps\);/);
  assert.match(renderer, /canvas\.dataset\.signalStaticReason = staticReason;/);
  assert.match(renderer, /requestedFps: state\.settings\.fps/);
  assert.match(panel, /requestedFps: Number\(field\?\.dataset\.signalRequestedFps\)/);
  assert.match(panel, /staticReason: field\?\.dataset\.signalStaticReason/);
  assert.match(panel, /const staticMotion = available && detail\.scheduledFps === 0 && detail\.requestedFps > 0;/);
});

test("keeps the panel free of persistence and Canvas APIs", async () => {
  const panel = await readFile(panelUrl, "utf8");

  assert.doesNotMatch(panel, /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie|URLSearchParams)\b/i);
  assert.doesNotMatch(panel, /\b(?:HTMLCanvasElement|getContext|createElement\(["']canvas["']\))\b/i);
});

test("loads the local panel before font resolution and exposes fallback state before mounting", async () => {
  const renderer = await readFile(rendererUrl, "utf8");

  assert.match(renderer, /if \(isLocalSignalHost\(window\.location\.hostname\)\) \{[\s\S]*?import\("\.\/home-signal-control-panel\.mjs"\)/);
  assert.match(renderer, /if \(!context \|\| !maskContext\) \{[\s\S]*?canvas\.dataset\.signalState = "fallback";[\s\S]*?mountLocalSignalPanel\(\);[\s\S]*?return;/);
  assert.match(renderer, /setRuntimeData\("initializing"\);\s*mountLocalSignalPanel\(\);\s*void titleFontReady/);
  assert.match(renderer, /hero\.addEventListener\("home-signal:settings"/);
  assert.match(renderer, /hero\.dispatchEvent\(new CustomEvent\("home-signal:telemetry", \{ detail \}\)\);/);
});

test("styles the SIGNAL LAB as a fixed lower-right collapsible local overlay", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.home-signal-lab\s*\{[\s\S]*?position:\s*fixed[\s\S]*?(?:right:\s*[^;]+;[\s\S]*?bottom:\s*[^;]+;|inset:\s*auto\s+[^;]+\s+[^;]+\s+auto;)[\s\S]*?z-index:\s*\d+/);
  assert.match(styles, /\.home-signal-lab details\s*\{[\s\S]*?max-height:\s*[^;]+;/);
  assert.match(styles, /\.home-signal-lab details\[open\]\s*\{[\s\S]*?max-height:\s*[^;]+;/);
  assert.match(styles, /\.home-signal-lab summary\s*\{[\s\S]*?cursor:\s*pointer[\s\S]*?text-transform:\s*uppercase/);
});

test("keeps SIGNAL LAB controls accessible and styles the title mode selector", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.home-signal-lab :is\(summary, button, input, select\):focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--signal\)/);
  assert.match(styles, /\.home-signal-lab select\[name="titleMode"\]\s*\{[\s\S]*?background:\s*var\(--canvas\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.home-signal-lab\s*\{[\s\S]*?(?:right:|inset:)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-signal-lab[\s\S]*?transition:\s*none !important/);
});

test("static verifiers enforce local-only SIGNAL LAB loading without HTML markup", async () => {
  const [redesignVerifier, siteVerifier] = await Promise.all([
    readFile(redesignVerifierUrl, "utf8"),
    readFile(siteVerifierUrl, "utf8"),
  ]);

  assert.match(redesignVerifier, /home-signal-control-panel\.mjs/);
  assert.match(redesignVerifier, /isLocalSignalHost[\s\S]*?home-signal-control-panel/);
  assert.match(redesignVerifier, /home-signal-lab/);
  assert.match(redesignVerifier, /MAX_SIGNAL_CELLS = 6400/);
  assert.match(redesignVerifier, /canvas\\\.dataset\\\.signalState = "fallback"/);
  assert.match(siteVerifier, /\/scripts\/home-signal-control-panel\.mjs/);
});
