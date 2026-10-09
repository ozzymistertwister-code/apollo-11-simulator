import { Mission } from '../simulation/mission';
import type { FlightMode } from '../config/physics';
import { assessLandingZone, targetOffset } from '../simulation/landing-guidance';
import { predictTouchdown } from '../simulation/touchdown-prediction';
import { scenarioById, SCENARIOS, type ScenarioId } from '../simulation/scenarios';
import { IndexedDbFlightRecordStore } from '../recording/flight-storage';
import { exportFlightCsv, exportFlightJson } from '../recording/flight-export';
import { FlightReplay, replayEventMarkers } from '../recording/flight-replay';
import { analyzeFlight, comparableFlights, type FlightAnalytics } from '../recording/flight-analytics';
import type { FlightRecord } from '../recording/types';
import { bindControls } from '../controls/controls';
import { Renderer } from '../rendering/renderer';
import { bindTouchControl, type TouchAction } from '../controls/touch';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="shell"><header class="topbar"><div class="brand"><span class="brand-mark">✦</span><div><span class="eyebrow">NASA // FLIGHT DIRECTOR</span><strong>APOLLO 11</strong></div></div><div class="mission-stamp"><span>MISSION ELAPSED</span><b id="mission-time">00:00</b></div><div class="status"><i></i><span id="status-label">STANDBY</span></div></header><section class="layout"><aside class="telemetry"><div class="panel-title"><span>FLIGHT DATA</span><span class="live-dot">● LIVE</span></div><div class="readout-grid"><div class="readout" data-alert="altitude"><span>ALTITUDE</span><b id="altitude">420.0</b><small>m AGL</small></div><div class="readout" data-alert="vertical"><span>V / SPEED</span><b id="vertical">−5.0</b><small>m/s</small></div><div class="readout" data-alert="horizontal"><span>H / SPEED</span><b id="horizontal">0.0</b><small>m/s</small></div><div class="readout" data-alert="fuel"><span>FUEL</span><b id="fuel">8,200</b><small>kg</small></div><div class="readout"><span>THRUST</span><b id="thrust">0</b><small>kN</small></div><div class="readout"><span>ANGLE</span><b id="angle">0.0</b><small>deg</small></div></div><div class="throttle"><div><span>MAIN ENGINE</span><b id="throttle-value">0%</b></div><div class="meter"><i id="throttle-meter"></i></div></div><div class="keys"><span>CONTROLS</span><p><kbd>W</kbd><kbd>S</kbd> THROTTLE</p><p><kbd>←</kbd><kbd>→</kbd> ATTITUDE</p><p><kbd>SPACE</kbd> PAUSE <kbd>R</kbd> RESET</p></div></aside><section class="viewport"><canvas id="scene" aria-label="Live lunar landing view"></canvas><div class="telemetry-chip"><span>DESCENT CAMERA</span><b id="camera-readout">TRACKING // 01</b></div><div class="guidance"><span>GUIDANCE</span><b id="guidance">NOMINAL</b></div></section></section><footer class="footer"><span>APOLLO 11 / LUNAR MODULE EAGLE</span><span>SIMULATION 0.1.0 · GAME VALUES, NOT HISTORICAL FLIGHT DATA</span><button id="pause">PAUSE MISSION</button></footer><div class="modal active" id="start-modal"><div class="modal-card"><span class="eyebrow">FLIGHT PLAN // 01</span><h1>One small step<br><em>starts here.</em></h1><p>Throttle the Eagle through the final descent. Keep your velocity low, stay level, and find the surface.</p><div class="mission-note"><span>LANDING SITE</span><b>TRANQUILITY BASE</b><span>PHYSICS MODEL</span><b>LUNAR / 2D / FIXED STEP</b></div><button class="primary" id="start">START MISSION <span>↗</span></button></div></div><div class="modal" id="result-modal"><div class="modal-card"><span class="eyebrow">MISSION REPORT</span><h1 id="result-title">Touchdown.</h1><p id="result-copy"></p><div class="result-stats"><span>TOUCHDOWN TIME <b id="result-time">00:00</b></span><span>FINAL V / SPEED <b id="result-vspeed">0.0 m/s</b></span></div><button class="primary" id="restart">FLY AGAIN <span>↗</span></button></div></div></main>`;

let mission = new Mission('classic'); const canvas = document.querySelector<HTMLCanvasElement>('#scene')!; const renderer = new Renderer(canvas); const $ = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!; const startModal = $('start-modal'); const resultModal = $('result-modal');
const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const modePicker = document.createElement('label');
modePicker.className = 'mode-picker';
modePicker.innerHTML = 'FLIGHT MODE <select id="flight-mode"><option value="classic">Classic — playable profile</option><option value="engineering">Engineering — documented LM limits</option></select>';
startModal.querySelector('.modal-card')?.insertBefore(modePicker, startModal.querySelector('.mission-note'));
function update() { const { craft, time, status, outcome } = mission.state; $('altitude').textContent = Math.max(0, craft.position.y).toFixed(1); $('vertical').textContent = `${craft.velocity.y >= 0 ? '+' : '−'}${Math.abs(craft.velocity.y).toFixed(1)}`; $('horizontal').textContent = `${craft.velocity.x >= 0 ? '+' : '−'}${Math.abs(craft.velocity.x).toFixed(1)}`; $('fuel').textContent = Math.round(craft.fuel).toLocaleString(); $('thrust').textContent = Math.round(craft.throttle * 45.5).toFixed(1); $('angle').textContent = `${craft.angle >= 0 ? '+' : '−'}${(Math.abs(craft.angle) * 180 / Math.PI).toFixed(1)}`; $('throttle-value').textContent = `${Math.round(craft.throttle * 100)}%`; $('throttle-meter').style.width = `${craft.throttle * 100}%`; $('mission-time').textContent = formatTime(time); $('status-label').textContent = status === 'active' ? 'DESCENT ACTIVE' : status === 'paused' ? 'PAUSED' : status === 'complete' ? (outcome === 'success' ? 'TOUCHDOWN' : 'MISSION ENDED') : 'STANDBY'; $('guidance').textContent = Math.abs(craft.velocity.y) > 8 ? 'REDUCE V / SPEED' : Math.abs(craft.angle) > 0.45 ? 'CORRECT ATTITUDE' : 'NOMINAL'; $('guidance').className = Math.abs(craft.velocity.y) > 8 || Math.abs(craft.angle) > 0.45 ? 'warning' : ''; renderer.draw(craft, time); }
let last = performance.now(); function loop(now: number) { mission.tick((now - last) / 1000); last = now; update(); if (mission.state.status === 'complete' && !resultModal.classList.contains('active')) showResult(); requestAnimationFrame(loop); } function showResult() { const outcome = mission.state.outcome; $('result-title').textContent = outcome === 'success' ? 'Touchdown.' : outcome === 'hard' ? 'Hard landing.' : 'Impact detected.'; $('result-copy').textContent = outcome === 'success' ? 'The Eagle is on the surface. A controlled descent, a clean touchdown, and Tranquility Base is yours.' : outcome === 'hard' ? 'The module reached the surface with damage. Your next descent needs less velocity and a steadier attitude.' : 'The descent exceeded the safe envelope. Reset and use the throttle earlier to bleed off vertical speed.'; $('result-time').textContent = formatTime(mission.state.time); $('result-vspeed').textContent = `${Math.abs(mission.state.craft.velocity.y).toFixed(1)} m/s`; resultModal.classList.add('active'); }
function reset() { const selected = ($('flight-mode') as HTMLSelectElement).value as FlightMode; if (mission.mode !== selected) mission = new Mission(selected); else mission.reset(); resultModal.classList.remove('active'); startModal.classList.remove('active'); mission.start(); } $('start').addEventListener('click', reset); $('restart').addEventListener('click', reset); $('pause').addEventListener('click', () => { mission.pause(); $('pause').textContent = mission.state.status === 'paused' ? 'RESUME MISSION' : 'PAUSE MISSION'; }); bindControls(mission, () => { mission.pause(); $('pause').textContent = mission.state.status === 'paused' ? 'RESUME MISSION' : 'PAUSE MISSION'; }, reset); window.addEventListener('resize', () => { renderer.resize(); update(); }); renderer.resize(); update(); requestAnimationFrame(loop);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) { const action = button.dataset.control; const press = () => { if (action === 'throttle-up') mission.adjustThrottle(0.04); if (action === 'throttle-down') mission.adjustThrottle(-0.04); if (action === 'left') mission.rotate(-0.04); if (action === 'right') mission.rotate(0.04); }; button.addEventListener('pointerdown', press); button.addEventListener('pointerup', () => undefined); }

const touchControls = document.createElement('div');
touchControls.className = 'touch-controls';
touchControls.setAttribute('aria-label', 'Touch flight controls');
touchControls.innerHTML = '<button type="button" data-control="left" aria-label="Tilt left">←<small>TILT</small></button><button type="button" data-control="throttle-down" aria-label="Decrease thrust">−<small>THRUST</small></button><output id="touch-throttle-value" aria-live="polite">0%</output><button type="button" data-control="throttle-up" aria-label="Increase thrust">+<small>THRUST</small></button><button type="button" data-control="right" aria-label="Tilt right">→<small>TILT</small></button>';
document.querySelector('.viewport')?.append(touchControls);
for (const button of touchControls.querySelectorAll<HTMLButtonElement>('button')) {
  bindTouchControl(button, button.dataset.control as TouchAction, (action, amount) => {
    if (action === 'throttle-up' || action === 'throttle-down') mission.adjustThrottle(amount);
    else mission.rotate(amount);
  });
}
const engineState = document.createElement('span');
engineState.id = 'engine-state';
engineState.className = 'engine-state';
document.querySelector('.throttle')?.append(engineState);
const fuelState = document.createElement('span');
fuelState.id = 'fuel-state';
fuelState.className = 'fuel-state';
document.querySelector('[data-alert="fuel"]')?.append(fuelState);
const updateMobileIndicators = () => {
  const { craft } = mission.state;
  const percent = `${Math.round(craft.throttle * 100)}%`;
  const touchValue = document.querySelector<HTMLOutputElement>('#touch-throttle-value');
  if (touchValue) touchValue.value = percent;
  if (engineState) engineState.textContent = craft.engineOn ? 'ENGINE ON' : craft.fuel <= 0 ? 'FUEL EXHAUSTED' : 'ENGINE OFF';
  if (fuelState) fuelState.textContent = craft.fuel <= 0 ? 'EMPTY' : craft.fuel < 1000 ? 'LOW' : 'TANK OK';
};
window.setInterval(updateMobileIndicators, 100);

const reportCard = resultModal.querySelector<HTMLElement>('.modal-card');
reportCard?.insertAdjacentHTML('beforeend', '<div class="touchdown-report"><div><span>LANDING SAFETY GRADE</span><b id="landing-safety-grade">—</b></div><div><span>TOUCHDOWN H / SPEED</span><b id="landing-hspeed">—</b></div><div><span>TOUCHDOWN ANGLE</span><b id="landing-angle">—</b></div><div><span>FUEL REMAINING</span><b id="landing-fuel">—</b></div><div><span>TOUCHDOWN MASS</span><b id="landing-mass">—</b></div><div><span>FLIGHT TIME</span><b id="landing-time">—</b></div><div class="report-wide"><span>MODULE CONDITION</span><b id="landing-condition">—</b></div></div>');
const updateLandingReport = () => {
  const { touchdown, assessment } = mission.state;
  if (!touchdown || !assessment) return;
  $('result-title').textContent = `Grade ${assessment.grade}`;
  $('result-copy').textContent = assessment.summary;
  $('result-time').textContent = formatTime(touchdown.flightTime);
  $('result-vspeed').textContent = `${touchdown.verticalSpeed >= 0 ? '+' : '−'}${Math.abs(touchdown.verticalSpeed).toFixed(1)} m/s`;
  $('landing-safety-grade').textContent = assessment.safetyGrade;
  $('landing-hspeed').textContent = `${touchdown.horizontalSpeed >= 0 ? '+' : '−'}${Math.abs(touchdown.horizontalSpeed).toFixed(1)} m/s`;
  $('landing-angle').textContent = `${(Math.abs(touchdown.angle) * 180 / Math.PI).toFixed(1)}°`;
  $('landing-fuel').textContent = `${Math.round(touchdown.fuel).toLocaleString()} kg`;
  $('landing-mass').textContent = `${Math.round(touchdown.mass).toLocaleString()} kg`;
  $('landing-time').textContent = formatTime(touchdown.flightTime);
  $('landing-condition').textContent = assessment.condition;
};
window.setInterval(updateLandingReport, 100);

const fuelReport = document.createElement('div');
fuelReport.className = 'fuel-report';
fuelReport.innerHTML = '<div><span>STARTING FUEL</span><b id="fuel-starting">—</b></div><div><span>FUEL USED</span><b id="fuel-used">—</b></div><div><span>FUEL REMAINING</span><b id="fuel-remaining">—</b></div><div><span>FUEL USED (%)</span><b id="fuel-used-percent">—</b></div><div class="fuel-grade"><span>FUEL EFFICIENCY GRADE</span><b id="fuel-grade">—</b></div><div class="fuel-bar" aria-label="Fuel used"><i id="fuel-bar-used"></i></div>';
reportCard?.append(fuelReport);
const updateFuelReport = () => {
  const fuel = mission.state.fuelTelemetry;
  if (!fuel) return;
  $('fuel-starting').textContent = `${Math.round(fuel.initialFuel).toLocaleString()} kg`;
  $('fuel-used').textContent = `${Math.round(fuel.fuelUsed).toLocaleString()} kg`;
  $('fuel-remaining').textContent = `${Math.round(fuel.remainingFuel).toLocaleString()} kg`;
  $('fuel-used-percent').textContent = `${fuel.fuelUsedPercent.toFixed(1)}%`;
  $('fuel-grade').textContent = fuel.efficiencyGrade;
  $('fuel-bar-used').style.width = `${Math.min(100, Math.max(0, fuel.fuelUsedPercent))}%`;
};
window.setInterval(updateFuelReport, 100);
const footerVersion = document.querySelector<HTMLElement>('.footer span:nth-child(2)');
if (footerVersion) footerVersion.textContent = 'SIMULATION 1.3.1 · GAME VALUES, NOT HISTORICAL FLIGHT DATA';
const keyboardStep = bindControls(() => mission, () => mission.pause(), () => reset());
window.setInterval(keyboardStep, 1000 / 60);
window.setInterval(() => renderer.setTerrain(mission.terrain), 100);
reportCard?.insertAdjacentHTML('beforeend', '<div class="surface-report"><span>LANDING RESULT</span><b id="landing-result">—</b><span>SURFACE SLOPE</span><b id="landing-slope">—</b><span>SUPPORT CONTACTS</span><b id="landing-supports">—</b></div>');
window.setInterval(() => { const touchdown = mission.state.touchdown; const assessment = mission.state.assessment; if (!touchdown || !assessment) return; $('landing-result').textContent = assessment.result; $('landing-slope').textContent = `${(Math.abs(assessment.slope) * 180 / Math.PI).toFixed(1)}°`; $('landing-supports').textContent = `${assessment.supportContacts}/2`; }, 100);

let landingAssistEnabled = true;
const guidanceDetails = document.createElement('details');
guidanceDetails.className = 'guidance-details';
guidanceDetails.open = true;
guidanceDetails.innerHTML = '<summary>PRECISION LANDING</summary><div class="guidance-grid"><button type="button" id="landing-assist">LANDING ASSIST: ON</button><span>TERRAIN SLOPE <b id="terrain-slope">—</b></span><span>LANDING ZONE <b id="landing-zone">—</b></span><span>HORIZONTAL DRIFT <b id="horizontal-drift">—</b></span><span>TARGET OFFSET <b id="target-offset">—</b></span><span class="prediction-wide">PREDICTED TOUCHDOWN <b id="predicted-touchdown">UNAVAILABLE</b></span><small id="prediction-assumption"></small></div>';
document.querySelector('.telemetry')?.append(guidanceDetails);
const landingAssistButton = guidanceDetails.querySelector<HTMLButtonElement>('#landing-assist');
landingAssistButton?.addEventListener('click', () => { landingAssistEnabled = !landingAssistEnabled; landingAssistButton.textContent = `LANDING ASSIST: ${landingAssistEnabled ? 'ON' : 'OFF'}`; mission.recordLandingAssist(landingAssistEnabled); });
const updatePrecisionGuidance = () => {
  const terrain = mission.terrain;
  renderer.setTerrain(terrain);
  renderer.setLandingAssist(landingAssistEnabled);
  if (!terrain) { renderer.setPrediction({ available: false, reason: 'UNAVAILABLE' }); $('terrain-slope').textContent = 'N/A'; $('landing-zone').textContent = 'N/A'; $('horizontal-drift').textContent = `${mission.state.craft.velocity.x >= 0 ? '+' : '−'}${Math.abs(mission.state.craft.velocity.x).toFixed(1)} m/s`; $('target-offset').textContent = 'N/A'; $('predicted-touchdown').textContent = 'UNAVAILABLE'; $('prediction-assumption').textContent = 'Classic profile: flat-ground assist unavailable.'; return; }
  const craft = mission.state.craft;
  const zone = assessLandingZone(terrain, craft.position.x);
  const prediction = predictTouchdown(craft, terrain, mission.config);
  renderer.setPrediction(prediction);
  $('terrain-slope').textContent = `${(zone.slope * 180 / Math.PI).toFixed(1)}°`;
  $('landing-zone').textContent = zone.zone.toUpperCase();
  $('landing-zone').className = zone.zone.toLowerCase();
  $('horizontal-drift').textContent = `${craft.velocity.x >= 0 ? '+' : '−'}${Math.abs(craft.velocity.x).toFixed(1)} m/s`;
  $('target-offset').textContent = `${targetOffset(terrain, craft.position.x) >= 0 ? '+' : '−'}${Math.abs(targetOffset(terrain, craft.position.x)).toFixed(1)} m`;
  $('predicted-touchdown').textContent = prediction.available ? `${prediction.x >= 0 ? '+' : '−'}${Math.abs(prediction.x).toFixed(1)} m · ${prediction.zone.toUpperCase()}` : 'UNAVAILABLE';
  $('prediction-assumption').textContent = prediction.available ? prediction.assumedControls : 'Prediction unavailable outside the modeled terrain envelope.';
};
window.setInterval(updatePrecisionGuidance, 250);

const recordStore = new IndexedDbFlightRecordStore();
let lastSavedFlightId: string | undefined;
let storedRecord: import('../recording/types').FlightRecord | undefined;
const recorderPanel = document.createElement('details');
recorderPanel.className = 'recorder-panel';
recorderPanel.innerHTML = '<summary>FLIGHT RECORDER</summary><div class="recorder-actions"><button type="button" id="export-json" disabled>EXPORT JSON</button><button type="button" id="export-csv" disabled>EXPORT CSV</button><span id="recorder-status">0 SAVED RECORDS</span></div>';
document.querySelector('.telemetry')?.append(recorderPanel);
const recorderStatus = recorderPanel.querySelector<HTMLElement>('#recorder-status')!;
const exportJsonButton = recorderPanel.querySelector<HTMLButtonElement>('#export-json')!;
const exportCsvButton = recorderPanel.querySelector<HTMLButtonElement>('#export-csv')!;
const download = (name: string, content: string, type: string) => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
const currentRecord = () => mission.state.flightRecord ?? storedRecord;
exportJsonButton.addEventListener('click', () => { const record = currentRecord(); if (record) download(`${record.id}.json`, exportFlightJson(record), 'application/json'); });
exportCsvButton.addEventListener('click', () => { const record = currentRecord(); if (record) download(`${record.id}.csv`, exportFlightCsv(record), 'text/csv'); });
const refreshRecorderStatus = async () => { try { const records = await recordStore.list(20); storedRecord = records[0]; const hasRecord = Boolean(currentRecord()); exportJsonButton.disabled = !hasRecord; exportCsvButton.disabled = !hasRecord; recorderStatus.textContent = `${records.length} SAVED RECORD${records.length === 1 ? '' : 'S'} · INDEXEDDB`; } catch { recorderStatus.textContent = 'STORAGE UNAVAILABLE'; } };
void refreshRecorderStatus();
window.setInterval(() => { const record = currentRecord(); if (!record || lastSavedFlightId === record.id) return; lastSavedFlightId = record.id; recordStore.save(record).then(() => { exportJsonButton.disabled = false; exportCsvButton.disabled = false; void refreshRecorderStatus(); }).catch(() => { recorderStatus.textContent = 'SAVE FAILED · STORAGE LIMIT OR UNAVAILABLE'; }); }, 250);

const historyPanel = document.createElement('details');
historyPanel.className = 'history-panel';
historyPanel.innerHTML = '<summary>FLIGHT HISTORY // REPLAY & ANALYTICS</summary><div class="history-toolbar"><select id="history-select" aria-label="Saved flights"><option value="">NO SAVED FLIGHTS</option></select><button type="button" id="history-refresh">REFRESH</button><button type="button" id="compare-open">COMPARE FLIGHTS</button></div><div id="history-list"></div><div id="replay-view" class="replay-view" hidden><div class="replay-toolbar"><button type="button" id="replay-toggle">PLAY</button><label>SPEED <select id="replay-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button type="button" id="replay-close">CLOSE</button></div><input id="replay-timeline" type="range" min="0" max="1" step="0.01" value="0" aria-label="Replay timeline"><div id="replay-markers" class="replay-markers"></div><canvas id="replay-canvas" width="640" height="220" aria-label="Flight replay trajectory"></canvas><div id="replay-readout" class="replay-readout"></div></div><div id="analytics-view" class="analytics-view" hidden><div id="analytics-summary" class="analytics-summary"></div><div id="chart-controls" class="chart-controls"></div><div class="chart-grid"></div></div><div id="compare-view" class="compare-view" hidden><div class="compare-toolbar"><select id="compare-a"></select><select id="compare-b"></select><button type="button" id="compare-run">RUN COMPARISON</button></div><div id="compare-warning"></div><div id="compare-results"></div><canvas id="compare-chart" width="640" height="180"></canvas></div></details>';
document.querySelector('.telemetry')?.append(historyPanel);
const historySelect = historyPanel.querySelector<HTMLSelectElement>('#history-select')!;
const historyList = historyPanel.querySelector<HTMLElement>('#history-list')!;
const replayView = historyPanel.querySelector<HTMLElement>('#replay-view')!;
const analyticsView = historyPanel.querySelector<HTMLElement>('#analytics-view')!;
const compareView = historyPanel.querySelector<HTMLElement>('#compare-view')!;
const replayCanvas = historyPanel.querySelector<HTMLCanvasElement>('#replay-canvas')!;
const replayTimeline = historyPanel.querySelector<HTMLInputElement>('#replay-timeline')!;
const replayReadout = historyPanel.querySelector<HTMLElement>('#replay-readout')!;
const replayMarkers = historyPanel.querySelector<HTMLElement>('#replay-markers')!;
let historyRecords: FlightRecord[] = [];
let activeReplay: FlightReplay | undefined;
let activeAnalytics: FlightAnalytics | undefined;
let selectedRecord: FlightRecord | undefined;
let lastReplayFrame = performance.now();
const displayValue = (value: number | null, unit = '') => value === null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(1)}${unit}`;
const recordLabel = (record: FlightRecord) => `${new Date(record.createdAt).toLocaleString()} · ${record.mode.toUpperCase()} · ${record.scenarioId ?? 'CLASSIC'} · ${record.report.outcome.toUpperCase()}`;
const drawReplay = () => {
  if (!activeReplay) return;
  const context = replayCanvas.getContext('2d'); if (!context) return;
  const sample = activeReplay.state.sample; const samples = activeReplay.record.telemetry; const padding = 28; const width = replayCanvas.width; const height = replayCanvas.height;
  context.clearRect(0, 0, width, height); context.fillStyle = '#081116'; context.fillRect(0, 0, width, height); context.strokeStyle = '#36515a'; context.beginPath(); context.moveTo(padding, height - padding); context.lineTo(width - padding, height - padding); context.stroke();
  const xs = samples.map((item) => item.positionX); const ys = samples.map((item) => item.positionY); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys); const mapX = (x: number) => padding + (x - minX) / Math.max(maxX - minX, 1) * (width - padding * 2); const mapY = (y: number) => height - padding - (y - minY) / Math.max(maxY - minY, 1) * (height - padding * 2);
  context.strokeStyle = '#68c5b1'; context.lineWidth = 2; context.beginPath(); samples.forEach((item, index) => { const x = mapX(item.positionX); const y = mapY(item.positionY); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke();
  const craftX = mapX(sample.positionX); const craftY = mapY(sample.positionY); context.save(); context.translate(craftX, craftY); context.rotate(sample.angleDeg * Math.PI / 180); context.fillStyle = '#f3c86b'; context.fillRect(-8, -5, 16, 10); context.restore(); context.fillStyle = '#9aacb0'; context.font = '10px monospace'; context.fillText('X / Y trajectory · recorded telemetry', padding, 16);
  replayReadout.textContent = `T ${formatTime(sample.time)} · ALT ${sample.altitudeAGL.toFixed(1)} m · V ${sample.verticalVelocity.toFixed(1)} m/s · THRUST ${sample.thrustKN.toFixed(1)} kN · FUEL ${sample.fuel.toFixed(0)} kg · ANGLE ${sample.angleDeg.toFixed(1)}°`;
};
const drawCharts = (record: FlightRecord) => {
  const grid = historyPanel.querySelector<HTMLElement>('.chart-grid')!; grid.innerHTML = '';
  const definitions = [{ key: 'altitudeAGL', label: 'ALTITUDE', unit: 'm' }, { key: 'verticalVelocity', label: 'VERTICAL SPEED', unit: 'm/s' }, { key: 'horizontalVelocity', label: 'HORIZONTAL SPEED', unit: 'm/s' }, { key: 'thrustKN', label: 'THRUST', unit: 'kN' }, { key: 'fuel', label: 'FUEL REMAINING', unit: 'kg' }, { key: 'angleDeg', label: 'ATTITUDE', unit: '°' }, { key: 'verticalAcceleration', label: 'VERTICAL ACCELERATION', unit: 'm/s²' }] as const;
  const controls = historyPanel.querySelector<HTMLElement>('#chart-controls')!; controls.innerHTML = '<span>GRAPHS</span>'; definitions.forEach(({ key, label, unit }) => { const toggle = document.createElement('label'); toggle.innerHTML = `<input type="checkbox" checked> ${label} (${unit})`; controls.append(toggle); const wrapper = document.createElement('label'); wrapper.className = 'chart-card'; wrapper.dataset.chart = key; wrapper.innerHTML = `<span>${label} (${unit})</span><canvas width="420" height="150" data-chart="${key}" aria-label="${label} chart"></canvas>`; grid.append(wrapper); toggle.querySelector('input')?.addEventListener('change', (event) => { wrapper.hidden = !(event.target as HTMLInputElement).checked; }); const canvas = wrapper.querySelector('canvas')!; const context = canvas.getContext('2d')!; const values = record.telemetry.map((sample) => sample[key]); const min = Math.min(...values); const max = Math.max(...values); const mapX = (index: number) => 28 + index / Math.max(values.length - 1, 1) * (canvas.width - 40); const mapY = (value: number) => canvas.height - 20 - (value - min) / Math.max(max - min, 1) * (canvas.height - 40); context.fillStyle = '#081116'; context.fillRect(0, 0, canvas.width, canvas.height); context.strokeStyle = '#30474f'; context.beginPath(); context.moveTo(28, 10); context.lineTo(28, canvas.height - 20); context.lineTo(canvas.width - 8, canvas.height - 20); context.stroke(); context.strokeStyle = '#68c5b1'; context.beginPath(); values.forEach((value, index) => { const x = mapX(index); const y = mapY(value); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); context.fillStyle = '#9aacb0'; context.font = '9px monospace'; context.fillText(`${max.toFixed(1)} ${unit}`, 32, 18); context.fillText(`${min.toFixed(1)} ${unit}`, 32, canvas.height - 24); context.fillText(`${record.telemetry.at(-1)?.time.toFixed(1) ?? '0'} s`, canvas.width - 48, canvas.height - 5); });
};
const renderAnalytics = (record: FlightRecord) => { activeAnalytics = analyzeFlight(record); const a = activeAnalytics; historyPanel.querySelector<HTMLElement>('#analytics-summary')!.innerHTML = `<span>MAX DESCENT <b>${displayValue(a.maximumDescentRate, ' m/s')}</b></span><span>BRAKING START <b>${a.brakingStartTime === null ? 'N/A' : formatTime(a.brakingStartTime)}</b></span><span>MAX THRUST <b>${displayValue(a.maximumThrust, ' kN')}</b></span><span>FUEL USED <b>${displayValue(a.fuelUsed, ' kg')}</b></span><span>ENGINE TIME <b>${displayValue(a.engineTime, ' s')}</b></span><span>DANGEROUS DESCENT <b>${displayValue(a.dangerousDescentTime, ' s')}</b></span><span>HORIZONTAL SHIFT <b>${displayValue(a.horizontalDisplacement, ' m')}</b></span><span>TOUCHDOWN V / H <b>${displayValue(a.touchdownVerticalSpeed, ' m/s')} / ${displayValue(a.touchdownHorizontalSpeed, ' m/s')}</b></span><span>SAFETY GRADE <b>${a.safetyGrade ?? 'N/A'}</b></span><span>RESULT <b>${a.outcome ?? 'N/A'}</b></span>`; drawCharts(record); };
const openReplay = (record: FlightRecord) => { selectedRecord = record; activeReplay = new FlightReplay(record); replayView.hidden = false; analyticsView.hidden = true; replayTimeline.max = String(activeReplay.duration); replayTimeline.value = '0'; replayMarkers.innerHTML = replayEventMarkers(record).map((marker) => `<i title="${marker.type}" style="left:${activeReplay!.duration ? marker.time / activeReplay!.duration * 100 : 0}%"></i>`).join(''); drawReplay(); };
const openAnalytics = (record: FlightRecord) => { selectedRecord = record; activeReplay?.pause(); replayView.hidden = true; compareView.hidden = true; analyticsView.hidden = false; renderAnalytics(record); };
const renderCompareOptions = () => { const options = historyRecords.map((record) => `<option value="${record.id}">${recordLabel(record)}</option>`).join(''); historyPanel.querySelector<HTMLSelectElement>('#compare-a')!.innerHTML = options; historyPanel.querySelector<HTMLSelectElement>('#compare-b')!.innerHTML = options; if (historyRecords[1]) historyPanel.querySelector<HTMLSelectElement>('#compare-b')!.value = historyRecords[1].id; };
const runComparison = () => { const a = historyRecords.find((record) => record.id === historyPanel.querySelector<HTMLSelectElement>('#compare-a')!.value); const b = historyRecords.find((record) => record.id === historyPanel.querySelector<HTMLSelectElement>('#compare-b')!.value); if (!a || !b) return; const aa = analyzeFlight(a); const bb = analyzeFlight(b); const equivalent = comparableFlights(a, b); historyPanel.querySelector<HTMLElement>('#compare-warning')!.textContent = equivalent ? 'COMPARISON: SAME MODE, SCENARIO, SEED, AND PHYSICS STEP' : 'WARNING: DIFFERENT MODE OR STARTING CONDITIONS — COMPARISON IS NOT FULLY EQUIVALENT'; historyPanel.querySelector<HTMLElement>('#compare-results')!.innerHTML = `<div class="compare-table"><span>METRIC</span><b>${a.id.slice(0, 8)}</b><b>${b.id.slice(0, 8)}</b><span>FLIGHT TIME</span><b>${formatTime(a.telemetry.at(-1)?.time ?? 0)}</b><b>${formatTime(b.telemetry.at(-1)?.time ?? 0)}</b><span>FUEL USED</span><b>${displayValue(aa.fuelUsed, ' kg')}</b><b>${displayValue(bb.fuelUsed, ' kg')}</b><span>TOUCHDOWN SPEED</span><b>${displayValue(aa.touchdownVerticalSpeed, ' m/s')} / ${displayValue(aa.touchdownHorizontalSpeed, ' m/s')}</b><b>${displayValue(bb.touchdownVerticalSpeed, ' m/s')} / ${displayValue(bb.touchdownHorizontalSpeed, ' m/s')}</b><span>PRECISION GRADE</span><b>${a.report.precision?.grade ?? 'N/A'}</b><b>${b.report.precision?.grade ?? 'N/A'}</b><span>MAX DESCENT</span><b>${displayValue(aa.maximumDescentRate, ' m/s')}</b><b>${displayValue(bb.maximumDescentRate, ' m/s')}</b><span>SAFETY GRADE</span><b>${aa.safetyGrade ?? 'N/A'}</b><b>${bb.safetyGrade ?? 'N/A'}</b><span>RESULT</span><b>${aa.outcome ?? 'N/A'}</b><b>${bb.outcome ?? 'N/A'}</b></div>`; const canvas = historyPanel.querySelector<HTMLCanvasElement>('#compare-chart')!; const context = canvas.getContext('2d')!; context.fillStyle = '#081116'; context.fillRect(0, 0, canvas.width, canvas.height); const maxTime = Math.max(a.telemetry.at(-1)?.time ?? 0, b.telemetry.at(-1)?.time ?? 0); const maxAltitude = Math.max(...a.telemetry.map((sample) => sample.altitudeAGL), ...b.telemetry.map((sample) => sample.altitudeAGL), 1); const drawLine = (record: FlightRecord, color: string) => { context.strokeStyle = color; context.beginPath(); record.telemetry.forEach((sample, index) => { const x = 28 + sample.time / Math.max(maxTime, 1) * (canvas.width - 40); const y = canvas.height - 20 - sample.altitudeAGL / maxAltitude * (canvas.height - 40); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); }; drawLine(a, '#68c5b1'); drawLine(b, '#f3c86b'); };
const renderHistory = () => { historySelect.innerHTML = historyRecords.length ? historyRecords.map((record) => `<option value="${record.id}">${recordLabel(record)}</option>`).join('') : '<option value="">NO SAVED FLIGHTS</option>'; historyList.innerHTML = historyRecords.map((record) => `<div class="history-row" data-record="${record.id}"><span>${recordLabel(record)}<small>${formatTime(record.telemetry.at(-1)?.time ?? 0)} · FUEL ${record.report.fuelTelemetry?.fuelUsed.toFixed(0) ?? 'N/A'} kg · GRADE ${record.report.assessment?.safetyGrade ?? 'N/A'}</small></span><button data-action="replay">REPLAY</button><button data-action="analytics">ANALYTICS</button><button data-action="delete">DELETE</button></div>`).join(''); renderCompareOptions(); historyList.querySelectorAll<HTMLElement>('.history-row').forEach((row) => { const record = historyRecords.find((item) => item.id === row.dataset.record); if (!record) return; row.querySelector('[data-action="replay"]')?.addEventListener('click', () => openReplay(record)); row.querySelector('[data-action="analytics"]')?.addEventListener('click', () => openAnalytics(record)); row.querySelector('[data-action="delete"]')?.addEventListener('click', async () => { if (window.confirm('Delete this completed flight record?')) { await recordStore.delete(record.id); historyRecords = historyRecords.filter((item) => item.id !== record.id); if (selectedRecord?.id === record.id) { selectedRecord = undefined; activeReplay = undefined; replayView.hidden = true; analyticsView.hidden = true; compareView.hidden = true; } renderHistory(); void refreshRecorderStatus(); } }); }); };
const refreshHistory = async () => { try { historyRecords = await recordStore.list(20); renderHistory(); } catch { historyList.textContent = 'HISTORY UNAVAILABLE'; } };
historySelect.addEventListener('change', () => { const record = historyRecords.find((item) => item.id === historySelect.value); if (record) openReplay(record); });
historyPanel.querySelector('#history-refresh')?.addEventListener('click', () => void refreshHistory());
historyPanel.querySelector('#compare-open')?.addEventListener('click', () => { if (historyRecords.length < 2) { historyList.textContent = 'TWO COMPLETED FLIGHTS ARE REQUIRED'; return; } activeReplay?.pause(); replayView.hidden = true; analyticsView.hidden = true; compareView.hidden = false; renderCompareOptions(); });
historyPanel.querySelector('#compare-run')?.addEventListener('click', runComparison);
historyPanel.querySelector('#replay-toggle')?.addEventListener('click', (event) => { if (!activeReplay) return; if (activeReplay.state.playing) { activeReplay.pause(); (event.currentTarget as HTMLButtonElement).textContent = 'PLAY'; } else { activeReplay.play(); (event.currentTarget as HTMLButtonElement).textContent = 'PAUSE'; } });
historyPanel.querySelector('#replay-close')?.addEventListener('click', () => { activeReplay?.pause(); replayView.hidden = true; });
historyPanel.querySelector('#replay-speed')?.addEventListener('change', (event) => { activeReplay?.setSpeed(Number((event.target as HTMLSelectElement).value) as 0.5 | 1 | 2 | 4); });
replayTimeline.addEventListener('input', () => { activeReplay?.seek(Number(replayTimeline.value)); drawReplay(); });
const replayLoop = (now: number) => { const dt = (now - lastReplayFrame) / 1000; lastReplayFrame = now; if (activeReplay) { activeReplay.tick(dt); replayTimeline.value = String(activeReplay.state.time); drawReplay(); } requestAnimationFrame(replayLoop); }; requestAnimationFrame(replayLoop);
void refreshHistory();

const scenarioPicker = document.createElement('label');
scenarioPicker.className = 'scenario-picker mode-picker';
scenarioPicker.innerHTML = `SCENARIO <select id="scenario-select">${SCENARIOS.map((scenario) => `<option value="${scenario.id}">${scenario.label}</option>`).join('')}</select><small id="scenario-description">${SCENARIOS[0].description}</small>`;
startModal.querySelector('.modal-card')?.insertBefore(scenarioPicker, startModal.querySelector('.mission-note'));
const scenarioSelect = scenarioPicker.querySelector<HTMLSelectElement>('#scenario-select')!;
const scenarioDescription = scenarioPicker.querySelector<HTMLElement>('#scenario-description')!;
scenarioSelect.addEventListener('change', () => { scenarioDescription.textContent = scenarioById(scenarioSelect.value as ScenarioId).description; });
const launchSelectedScenario = () => {
  const selectedMode = ($('flight-mode') as HTMLSelectElement).value as FlightMode;
  const scenario = scenarioById(scenarioSelect.value as ScenarioId);
  if (selectedMode === 'engineering') mission = new Mission('engineering', scenario.difficulty, scenario.seed, scenario.id, scenario.targetX);
  else mission = new Mission('classic');
  mission.start();
  resultModal.classList.remove('active');
  startModal.classList.remove('active');
};
$('start').addEventListener('click', launchSelectedScenario);
$('restart').addEventListener('click', launchSelectedScenario);
reportCard?.insertAdjacentHTML('beforeend', '<details class="mission-report-v13" open><summary>MISSION REPORT // v1.3</summary><div class="report-section"><strong>FLIGHT PERFORMANCE</strong><span>FLIGHT TIME <b id="report-flight-time">—</b></span><span>TOUCHDOWN VERTICAL SPEED <b id="report-vspeed">—</b></span><span>TOUCHDOWN HORIZONTAL SPEED <b id="report-hspeed">—</b></span><span>TOUCHDOWN ANGLE <b id="report-angle">—</b></span><span>FUEL USED <b id="report-fuel-used">—</b></span><span>FUEL REMAINING <b id="report-fuel-remaining">—</b></span></div><div class="report-section"><strong>LANDING SITE ASSESSMENT</strong><span>TERRAIN SLOPE <b id="report-slope">—</b></span><span>LANDING ZONE SAFETY <b id="report-zone">—</b></span><span>DISTANCE TO TARGET <b id="report-distance">—</b></span><span>OBSTACLE CONTACT <b id="report-obstacle">—</b></span><span>LANDING GEAR STATUS <b id="report-gear">—</b></span></div><div class="report-section"><strong>MISSION RESULT</strong><span>LANDING SAFETY GRADE <b id="report-safety-grade">—</b></span><span>FUEL EFFICIENCY GRADE <b id="report-fuel-grade">—</b></span><span>PRECISION GRADE <b id="report-precision-grade">—</b></span><span>MODULE CONDITION <b id="report-condition">—</b></span><span class="report-wide">MISSION CONTROL ASSESSMENT <b id="report-assessment">—</b></span></div></details>');
window.setInterval(() => {
  const { touchdown, assessment, fuelTelemetry, precision } = mission.state;
  if (!touchdown || !assessment) return;
  const zone = mission.terrain ? assessLandingZone(mission.terrain, touchdown.position.x).zone : 'N/A';
  $('report-flight-time').textContent = formatTime(touchdown.flightTime);
  $('report-vspeed').textContent = `${Math.abs(touchdown.verticalSpeed).toFixed(2)} m/s`;
  $('report-hspeed').textContent = `${Math.abs(touchdown.horizontalSpeed).toFixed(2)} m/s`;
  $('report-angle').textContent = `${(Math.abs(touchdown.angle) * 180 / Math.PI).toFixed(2)}°`;
  $('report-fuel-used').textContent = fuelTelemetry ? `${Math.round(fuelTelemetry.fuelUsed).toLocaleString()} kg` : '—';
  $('report-fuel-remaining').textContent = `${Math.round(touchdown.fuel).toLocaleString()} kg`;
  $('report-slope').textContent = `${(Math.abs(assessment.slope) * 180 / Math.PI).toFixed(2)}°`;
  $('report-zone').textContent = zone;
  $('report-distance').textContent = precision?.distance === null || precision?.distance === undefined ? 'N/A' : `${precision.distance.toFixed(2)} m`;
  $('report-obstacle').textContent = mission.terrain ? (touchdown.obstacleContact ? 'YES' : 'NO') : 'N/A';
  $('report-gear').textContent = assessment.gearStatus;
  $('report-safety-grade').textContent = assessment.safetyGrade;
  $('report-fuel-grade').textContent = fuelTelemetry?.efficiencyGrade ?? 'N/A';
  $('report-precision-grade').textContent = precision?.grade ?? 'N/A';
  $('report-condition').textContent = assessment.condition;
  $('report-assessment').textContent = assessment.summary;
}, 100);
