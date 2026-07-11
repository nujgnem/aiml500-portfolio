import { DEFAULT_SIGNAL_SETTINGS, SIGNAL_PRESETS } from "./home-signal-field-core.mjs";

const RANGE_CONTROLS = [
  { key: "outerDensity", label: "Background density", min: "0", max: "1", step: "0.01" },
  { key: "cellSize", label: "Character cell", min: "8", max: "64", step: "1" },
  { key: "fps", label: "Motion rate", min: "0", max: "12", step: "1" },
  { key: "scanStrength", label: "Scan strength", min: "0", max: "1", step: "0.01" },
  { key: "titleDensity", label: "Title density", min: "0", max: "1", step: "0.01" },
  { key: "titleScale", label: "Title scale", min: "0.5", max: "2", step: "0.05" },
  { key: "titleBlend", label: "Title blend", min: "0", max: "1", step: "0.01" },
  { key: "orangeRatio", label: "Signal ratio", min: "0", max: "0.35", step: "0.01" },
  { key: "copyClearance", label: "Copy clearance", min: "0", max: "2.5", step: "0.05" },
];

const CONTROL_GROUPS = [
  { label: "FIELD", keys: ["outerDensity", "cellSize", "fps", "scanStrength"] },
  { label: "TYPE", keys: ["titleDensity", "titleScale", "titleBlend", "orangeRatio"] },
  { label: "PROTECTION", keys: ["copyClearance"] },
];

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function createRangeControl(documentRef, definition, settings, onInput) {
  const row = documentRef.createElement("div");
  row.className = "home-signal-lab-control";

  const label = documentRef.createElement("label");
  const id = `home-signal-lab-${definition.key}`;
  label.htmlFor = id;
  label.textContent = definition.label;

  const output = documentRef.createElement("output");
  output.htmlFor = id;
  output.textContent = formatValue(settings[definition.key]);

  const input = documentRef.createElement("input");
  input.id = id;
  input.name = definition.key;
  input.type = "range";
  input.min = definition.min;
  input.max = definition.max;
  input.step = definition.step;
  input.value = String(settings[definition.key]);
  input.addEventListener("input", () => onInput(definition.key, input, output));

  row.append(label, output, input);
  return { row, input, output };
}

function createPresetButton(documentRef, label, preset, applyPreset) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => applyPreset(preset));
  return button;
}

export function mountHomeSignalControlPanel(hero) {
  if (!hero || hero.querySelector(".home-signal-lab")) return hero?.querySelector(".home-signal-lab") ?? null;

  const documentRef = hero.ownerDocument;
  const lab = documentRef.createElement("aside");
  lab.className = "home-signal-lab";
  lab.setAttribute("aria-label", "SIGNAL LAB");

  const details = documentRef.createElement("details");
  const summary = documentRef.createElement("summary");
  summary.textContent = "SIGNAL LAB";
  details.append(summary);

  const form = documentRef.createElement("div");
  form.className = "home-signal-lab-form";
  const controls = new Map();
  let currentSettings = { ...DEFAULT_SIGNAL_SETTINGS };

  const updateRange = (settingKey, input, output) => {
    const nextValue = Number(input.value);
    if (currentSettings[settingKey] === nextValue) return;
    currentSettings = { ...currentSettings, [settingKey]: nextValue };
    output.textContent = formatValue(nextValue);
    hero.dispatchEvent(new CustomEvent("home-signal:settings", {
      detail: { [settingKey]: Number(input.value) },
    }));
  };

  CONTROL_GROUPS.forEach((group) => {
    const section = documentRef.createElement("section");
    const heading = documentRef.createElement("h2");
    heading.textContent = group.label;
    section.append(heading);

    group.keys.forEach((key) => {
      const definition = RANGE_CONTROLS.find((entry) => entry.key === key);
      const control = createRangeControl(documentRef, definition, currentSettings, updateRange);
      controls.set(key, control);
      section.append(control.row);
    });
    form.append(section);
  });

  const modeRow = documentRef.createElement("div");
  modeRow.className = "home-signal-lab-control";
  const modeLabel = documentRef.createElement("label");
  const modeId = "home-signal-lab-title-mode";
  modeLabel.htmlFor = modeId;
  modeLabel.textContent = "Title display";
  const select = documentRef.createElement("select");
  select.id = modeId;
  select.name = "titleMode";
  ["native", "ascii", "overlay"].forEach((mode) => {
    const option = documentRef.createElement("option");
    option.value = mode;
    option.textContent = mode;
    select.append(option);
  });
  select.value = currentSettings.titleMode;
  select.addEventListener("input", () => {
    if (currentSettings.titleMode === select.value) return;
    currentSettings = { ...currentSettings, titleMode: select.value };
    hero.dispatchEvent(new CustomEvent("home-signal:settings", {
      detail: { titleMode: select.value },
    }));
  });
  modeRow.append(modeLabel, select);
  form.append(modeRow);

  const presets = documentRef.createElement("div");
  presets.className = "home-signal-lab-presets";
  const presetControls = [];
  const applyPreset = (preset) => {
    currentSettings = { ...preset };
    RANGE_CONTROLS.forEach(({ key }) => {
      const control = controls.get(key);
      control.input.value = String(currentSettings[key]);
      control.output.textContent = formatValue(currentSettings[key]);
    });
    select.value = currentSettings.titleMode;
    hero.dispatchEvent(new CustomEvent("home-signal:settings", {
      detail: { ...preset },
    }));
  };
  presetControls.push(createPresetButton(documentRef, "Current", SIGNAL_PRESETS.current, applyPreset));
  presetControls.push(createPresetButton(documentRef, "Aino Dense", SIGNAL_PRESETS.ainoDense, applyPreset));
  presetControls.push(createPresetButton(documentRef, "Type-First", SIGNAL_PRESETS.typeFirst, applyPreset));
  presets.append(...presetControls);
  form.append(presets);

  const telemetry = documentRef.createElement("footer");
  telemetry.className = "home-signal-lab-telemetry";
  const status = documentRef.createElement("p");
  status.id = "home-signal-lab-status";
  status.role = "status";
  status.setAttribute("aria-live", "polite");
  const grid = documentRef.createElement("p");
  const coverage = documentRef.createElement("p");
  const cadence = documentRef.createElement("p");
  telemetry.append(status, grid, coverage, cadence);
  form.append(telemetry);

  details.append(form);
  lab.append(details);
  hero.append(lab);

  const fpsInput = controls.get("fps").input;
  const setAvailability = (detail = {}) => {
    const available = detail.available === true;
    const staticMotion = available && detail.scheduledFps === 0 && detail.requestedFps > 0;
    const allInteractive = [...controls.values()].map(({ input }) => input).concat(select, ...presetControls);
    allInteractive.forEach((control) => { control.disabled = !available; });
    fpsInput.disabled = staticMotion || !available;
    if (staticMotion) fpsInput.setAttribute("aria-describedby", status.id);
    else fpsInput.removeAttribute("aria-describedby");

    if (!available) status.textContent = "Renderer unavailable";
    else if (staticMotion) status.textContent = "Static accessibility mode — FPS control disabled";
    else status.textContent = "Renderer ready";

    grid.textContent = available ? `GRID ${detail.columns ?? "—"} × ${detail.rows ?? "—"}` : "GRID —";
    coverage.textContent = available ? `TITLE ${Math.round((detail.titleCoverage ?? 0) * 100)}%` : "TITLE —";
    cadence.textContent = available
      ? `FPS ${formatValue(detail.effectiveFps ?? 0)} / ${formatValue(detail.scheduledFps ?? 0)}`
      : "FPS —";
  };

  const field = hero.querySelector(".home-signal-field");
  setAvailability({
    available: Boolean(field && !field.hidden && hero.dataset.signalReady === "true"),
    scheduledFps: Number(field?.dataset.signalCadence),
    requestedFps: Number(field?.dataset.signalRequestedFps),
    staticReason: field?.dataset.signalStaticReason,
  });
  hero.addEventListener("home-signal:telemetry", (event) => setAvailability(event.detail));

  return lab;
}
