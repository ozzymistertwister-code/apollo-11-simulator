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
import { assignLegacyPilotName, enrichCompletedRecord, isLegacyRecord, pilotNameForRecord } from '../recording/record-metadata';
import { loadPilotName, normalizePilotName, savePilotName, validatePilotName, type PilotIdentity } from '../pilot/pilot-identity';
import { fetchLeaderboard, fetchPublicFlight, submitPublicFlight } from '../online/flight-api';
import { filterHallOfFame, sortHallOfFame } from '../online/hall-of-fame';
import { bindControls } from '../controls/controls';
import { Renderer } from '../rendering/renderer';
import { bindTouchControl, type TouchAction } from '../controls/touch';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="shell home-state"><header class="topbar"><div class="brand"><span class="brand-mark">✦</span><div><span class="eyebrow">NASA // FLIGHT DIRECTOR</span><strong>APOLLO 11</strong></div></div><div class="mission-stamp"><span>MISSION ELAPSED</span><b id="mission-time">00:00</b></div><div class="status"><i></i><span id="status-label">STANDBY</span></div></header><section class="layout"><aside class="telemetry"><div class="panel-title"><span>FLIGHT DATA</span><span class="live-dot">● LIVE</span></div><div class="readout-grid"><div class="readout" data-alert="altitude"><span>ALTITUDE</span><b id="altitude">420.0</b><small>m AGL</small></div><div class="readout" data-alert="vertical"><span>V / SPEED</span><b id="vertical">−5.0</b><small>m/s</small></div><div class="readout" data-alert="horizontal"><span>H / SPEED</span><b id="horizontal">0.0</b><small>m/s</small></div><div class="readout" data-alert="fuel"><span>FUEL</span><b id="fuel">8,200</b><small>kg</small></div><div class="readout"><span>THRUST</span><b id="thrust">0</b><small>kN</small></div><div class="readout"><span>ANGLE</span><b id="angle">0.0</b><small>deg</small></div></div><div class="throttle"><div><span>MAIN ENGINE</span><b id="throttle-value">0%</b></div><div class="meter"><i id="throttle-meter"></i></div></div><div class="keys"><span>CONTROLS</span><p><kbd>W</kbd><kbd>S</kbd> THROTTLE</p><p><kbd>←</kbd><kbd>→</kbd> ATTITUDE</p><p><kbd>SPACE</kbd> PAUSE <kbd>R</kbd> RESET</p></div></aside><section class="viewport"><canvas id="scene" aria-label="Live lunar landing view"></canvas><div class="telemetry-chip"><span>DESCENT CAMERA</span><b id="camera-readout">TRACKING // 01</b></div><div class="guidance"><span>GUIDANCE</span><b id="guidance">NOMINAL</b></div></section></section><footer class="footer"><span>APOLLO 11 / LUNAR MODULE EAGLE</span><span>SIMULATION 0.1.0 · GAME VALUES, NOT HISTORICAL FLIGHT DATA</span><button id="home-footer">HALL OF FAME</button><button id="pause">PAUSE MISSION</button></footer><div class="modal active" id="start-modal"><div class="modal-card"><span class="eyebrow">MISSION CONTROL // HOME</span><h1>APOLLO 11<br><em>HALL OF FAME</em></h1><p>Review confirmed landings, open a saved Replay, or prepare a new descent. The flight computer remains idle until you launch a mission.</p><div id="home-hall"></div><div class="home-actions"><button class="primary" id="start">START NEW MISSION <span>↗</span></button><button class="secondary" id="home-history">FLIGHT HISTORY <span>↗</span></button></div></div></div><div class="modal" id="result-modal"><div class="modal-card"><span class="eyebrow">MISSION REPORT</span><h1 id="result-title">Touchdown.</h1><p id="result-copy"></p><div class="result-stats"><span>TOUCHDOWN TIME <b id="result-time">00:00</b></span><span>FINAL V / SPEED <b id="result-vspeed">0.0 m/s</b></span></div><button class="primary" id="restart">FLY AGAIN <span>↗</span></button><button class="secondary" id="result-home">RETURN TO HALL OF FAME <span>↗</span></button></div></div></main>`;

let mission = new Mission('classic'); const canvas = document.querySelector<HTMLCanvasElement>('#scene')!; const renderer = new Renderer(canvas); const $ = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!; const startModal = $('start-modal'); const resultModal = $('result-modal');
const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const modePicker = document.createElement('label');
modePicker.className = 'mode-picker';
modePicker.innerHTML = 'FLIGHT MODE <select id="flight-mode"><option value="classic">Classic — playable profile</option><option value="engineering">Engineering — documented LM limits</option></select>';
startModal.querySelector('.modal-card')?.insertBefore(modePicker, startModal.querySelector('.mission-note'));
const pilotPanel = document.createElement('div');
pilotPanel.className = 'pilot-panel';
pilotPanel.innerHTML = '<label for="pilot-name">PILOT NAME / CALLSIGN</label><input id="pilot-name" maxlength="24" autocomplete="nickname" placeholder="Optional for local flight"><small id="pilot-name-hint">2–24 letters, numbers, spaces, hyphens, or underscores.</small><label class="pilot-consent"><input id="pilot-consent" type="checkbox"> I consent to display this callsign and result publicly.</label><small id="pilot-share-hint">A name is required only for the shared leaderboard. No email or password is collected.</small>';
startModal.querySelector('.modal-card')?.insertBefore(pilotPanel, startModal.querySelector('.mission-note'));
const pilotNameInput = pilotPanel.querySelector<HTMLInputElement>('#pilot-name')!;
const pilotConsentInput = pilotPanel.querySelector<HTMLInputElement>('#pilot-consent')!;
const pilotNameHint = pilotPanel.querySelector<HTMLElement>('#pilot-name-hint')!;
pilotNameInput.value = loadPilotName();
let pilotIdentity: PilotIdentity | undefined;
const readPilotIdentity = (): PilotIdentity | undefined => {
  const name = normalizePilotName(pilotNameInput.value);
  const error = validatePilotName(name);
  if (!name && !pilotConsentInput.checked) { pilotNameHint.textContent = 'Local flight only. Enter a callsign to submit to the shared leaderboard.'; return undefined; }
  if (error) { pilotNameHint.textContent = error; pilotNameInput.focus(); return undefined; }
  if (pilotConsentInput.checked && !name) { pilotNameHint.textContent = 'A valid callsign is required for public sharing.'; pilotNameInput.focus(); return undefined; }
  savePilotName(name); pilotNameHint.textContent = pilotConsentInput.checked ? 'Ready for public leaderboard submission.' : 'Local callsign saved on this device.'; return { name, publicConsent: pilotConsentInput.checked };
};
pilotNameInput.addEventListener('input', () => { if (pilotNameInput.value) validatePilotName(normalizePilotName(pilotNameInput.value)); });
function update() { const { craft, time, status, outcome } = mission.state; $('altitude').textContent = Math.max(0, craft.position.y).toFixed(1); $('vertical').textContent = `${craft.velocity.y >= 0 ? '+' : '−'}${Math.abs(craft.velocity.y).toFixed(1)}`; $('horizontal').textContent = `${craft.velocity.x >= 0 ? '+' : '−'}${Math.abs(craft.velocity.x).toFixed(1)}`; $('fuel').textContent = Math.round(craft.fuel).toLocaleString(); $('thrust').textContent = Math.round(craft.throttle * 45.5).toFixed(1); $('angle').textContent = `${craft.angle >= 0 ? '+' : '−'}${(Math.abs(craft.angle) * 180 / Math.PI).toFixed(1)}`; $('throttle-value').textContent = `${Math.round(craft.throttle * 100)}%`; $('throttle-meter').style.width = `${craft.throttle * 100}%`; $('mission-time').textContent = formatTime(time); $('status-label').textContent = status === 'active' ? 'DESCENT ACTIVE' : status === 'paused' ? 'PAUSED' : status === 'complete' ? (outcome === 'success' ? 'TOUCHDOWN' : 'MISSION ENDED') : 'STANDBY'; $('guidance').textContent = Math.abs(craft.velocity.y) > 8 ? 'REDUCE V / SPEED' : Math.abs(craft.angle) > 0.45 ? 'CORRECT ATTITUDE' : 'NOMINAL'; $('guidance').className = Math.abs(craft.velocity.y) > 8 || Math.abs(craft.angle) > 0.45 ? 'warning' : ''; renderer.draw(craft, time); }
let last = performance.now(); function loop(now: number) { mission.tick((now - last) / 1000); last = now; update(); if (mission.state.status === 'complete' && !resultModal.classList.contains('active')) showResult(); requestAnimationFrame(loop); } function showResult() { const outcome = mission.state.outcome; $('result-title').textContent = outcome === 'success' ? 'Touchdown.' : outcome === 'hard' ? 'Hard landing.' : 'Impact detected.'; $('result-copy').textContent = outcome === 'success' ? 'The Eagle is on the surface. A controlled descent, a clean touchdown, and Tranquility Base is yours.' : outcome === 'hard' ? 'The module reached the surface with damage. Your next descent needs less velocity and a steadier attitude.' : 'The descent exceeded the safe envelope. Reset and use the throttle earlier to bleed off vertical speed.'; $('result-time').textContent = formatTime(mission.state.time); $('result-vspeed').textContent = `${Math.abs(mission.state.craft.velocity.y).toFixed(1)} m/s`; const successful = outcome === 'success'; publishPanel.hidden = !successful; if (successful) { resultPilotInput.value = pilotIdentity?.name ?? loadPilotName(); resultPilotConsent.checked = pilotIdentity?.publicConsent ?? false; publishStatus.textContent = resultPilotConsent.checked ? 'READY TO PUBLISH · SERVER CONFIRMATION REQUIRED' : 'ENTER A CALLSIGN AND CONSENT TO PUBLISH THIS RESULT'; publishButton.disabled = false; publishButton.textContent = 'SAVE TO HALL OF FAME'; publishButton.classList.remove('published'); } resultModal.classList.add('active'); }
let homeState = true;
const showHome = () => { homeState = true; document.querySelector('.shell')?.classList.add('home-state'); resultModal.classList.remove('active'); startModal.classList.add('active'); historyPanel?.removeAttribute('open'); startModal.querySelector<HTMLElement>('.home-actions')?.removeAttribute('hidden'); };
function reset() { const selected = ($('flight-mode') as HTMLSelectElement).value as FlightMode; if (mission.mode !== selected) mission = new Mission(selected); else mission.reset(); resultModal.classList.remove('active'); startModal.classList.remove('active'); document.querySelector('.shell')?.classList.remove('home-state'); homeState = false; mission.start(); }
$('start').addEventListener('click', () => {
  if (!homeState) { reset(); return; }
  homeState = false;
  document.querySelector('.shell')?.classList.remove('home-state');
  startModal.querySelector<HTMLElement>('.home-actions')?.setAttribute('hidden', 'true');
  let launchButton = startModal.querySelector<HTMLButtonElement>('#launch-mission');
  if (!launchButton) {
    launchButton = document.createElement('button');
    launchButton.className = 'primary';
    launchButton.id = 'launch-mission';
    launchButton.innerHTML = 'LAUNCH MISSION <span>↗</span>';
    startModal.querySelector('.modal-card')?.append(launchButton);
    launchButton.addEventListener('click', reset);
  }
});
$('restart').addEventListener('click', reset);
$('result-home').addEventListener('click', showHome);
$('home-footer').addEventListener('click', showHome);
$('pause').addEventListener('click', () => { mission.pause(); $('pause').textContent = mission.state.status === 'paused' ? 'RESUME MISSION' : 'PAUSE MISSION'; });
bindControls(mission, () => { mission.pause(); $('pause').textContent = mission.state.status === 'paused' ? 'RESUME MISSION' : 'PAUSE MISSION'; }, reset);
window.addEventListener('resize', () => { renderer.resize(); update(); });
renderer.resize(); update(); requestAnimationFrame(loop);

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
if (footerVersion) footerVersion.textContent = 'APOLLO 11 // v1.4.6 · GAME VALUES, NOT HISTORICAL FLIGHT DATA';
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
const submittedFlightIds = new Set<string>((() => { try { return JSON.parse(localStorage.getItem('apollo11-submitted-flight-ids') ?? '[]') as string[]; } catch { return []; } })());
const markSubmitted = (id: string) => { submittedFlightIds.add(id); try { localStorage.setItem('apollo11-submitted-flight-ids', JSON.stringify([...submittedFlightIds].slice(-20))); } catch { /* Local storage is optional. */ } };
const download = (name: string, content: string, type: string) => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
const currentRecord = () => mission.state.flightRecord ?? storedRecord;
exportJsonButton.addEventListener('click', () => { const record = currentRecord(); if (record) download(`${record.id}.json`, exportFlightJson(record), 'application/json'); });
exportCsvButton.addEventListener('click', () => { const record = currentRecord(); if (record) download(`${record.id}.csv`, exportFlightCsv(record), 'text/csv'); });
const refreshRecorderStatus = async () => { try { const records = await recordStore.list(20); storedRecord = records[0]; const hasRecord = Boolean(currentRecord()); exportJsonButton.disabled = !hasRecord; exportCsvButton.disabled = !hasRecord; recorderStatus.textContent = `${records.length} SAVED RECORD${records.length === 1 ? '' : 'S'} · INDEXEDDB`; } catch { recorderStatus.textContent = 'STORAGE UNAVAILABLE'; } };
void refreshRecorderStatus();
window.setInterval(() => { const record = currentRecord(); if (!record || lastSavedFlightId === record.id) return; lastSavedFlightId = record.id; const persistedRecord = enrichCompletedRecord(record, pilotIdentity); recordStore.save(persistedRecord).then(async () => { exportJsonButton.disabled = false; exportCsvButton.disabled = false; recorderStatus.textContent = 'LOCAL SAVE COMPLETE · PUBLISH FROM MISSION REPORT'; void refreshRecorderStatus(); }).catch(() => { recorderStatus.textContent = 'SAVE FAILED · STORAGE LIMIT OR UNAVAILABLE'; }); }, 250);

const publishPanel = document.createElement('div');
publishPanel.className = 'publish-panel';
publishPanel.hidden = true;
publishPanel.innerHTML = '<strong>SAVE TO HALL OF FAME</strong><label for="result-pilot-name">PILOT</label><input id="result-pilot-name" maxlength="24" autocomplete="nickname"><label class="pilot-consent"><input id="result-pilot-consent" type="checkbox"> I consent to display this callsign and result publicly.</label><button type="button" class="primary" id="publish-result">SAVE TO HALL OF FAME <span>↗</span></button><button type="button" class="secondary" id="publish-replay">VIEW REPLAY <span>↗</span></button><small id="publish-status">A server confirmation is required before publication is reported.</small>';
resultModal.querySelector('.modal-card')?.append(publishPanel);
const resultPilotInput = publishPanel.querySelector<HTMLInputElement>('#result-pilot-name')!;
const resultPilotConsent = publishPanel.querySelector<HTMLInputElement>('#result-pilot-consent')!;
const publishButton = publishPanel.querySelector<HTMLButtonElement>('#publish-result')!;
const publishReplayButton = publishPanel.querySelector<HTMLButtonElement>('#publish-replay')!;
const publishStatus = publishPanel.querySelector<HTMLElement>('#publish-status')!;
const publishRecord = async (record: FlightRecord, identity: PilotIdentity, statusElement: HTMLElement, button: HTMLButtonElement) => {
  button.disabled = true; statusElement.textContent = 'CONTACTING SERVER…';
  try {
    const result = await submitPublicFlight(record, identity);
    const persisted = await fetchPublicFlight(result.id);
    markSubmitted(record.id);
    statusElement.textContent = result.verified ? `SERVER CONFIRMED · VERIFIED${result.rank ? ` · PLACE ${result.rank}` : ''}` : `${result.reason ?? 'SERVER CONFIRMED · PUBLISHED COMMUNITY'}${result.communityRank ? ` · COMMUNITY RANK #${result.communityRank}` : ''} · RECORD READ BACK OK`;
    button.textContent = result.verified ? 'PUBLISHED · VERIFIED' : 'SAVED · PENDING VERIFICATION';
    button.classList.add('published');
    void refreshHall();
    return persisted;
  } catch { statusElement.textContent = 'SERVER UNAVAILABLE · LOCAL RECORD KEPT · RETRY LATER'; button.disabled = false; return undefined; }
};
const identityFromResultPanel = (): PilotIdentity | undefined => {
  const name = normalizePilotName(resultPilotInput.value);
  const error = validatePilotName(name);
  if (error) { publishStatus.textContent = error; resultPilotInput.focus(); return undefined; }
  if (!resultPilotConsent.checked) { publishStatus.textContent = 'PUBLIC CONSENT IS REQUIRED TO PUBLISH'; return undefined; }
  savePilotName(name); pilotNameInput.value = name; pilotConsentInput.checked = true; return { name, publicConsent: true };
};
publishButton.addEventListener('click', async () => { const record = mission.state.flightRecord; if (!record || record.report.outcome !== 'success') return; const identity = identityFromResultPanel(); if (!identity) return; await publishRecord(enrichCompletedRecord(record, identity), identity, publishStatus, publishButton); });
publishReplayButton.addEventListener('click', () => { const record = mission.state.flightRecord; if (!record) return; resultModal.classList.remove('active'); historyPanel.open = true; openReplay(enrichCompletedRecord(record, pilotIdentity)); });

const historyPanel = document.createElement('details');
historyPanel.className = 'history-panel';
historyPanel.innerHTML = '<summary>FLIGHT HISTORY // REPLAY & ANALYTICS</summary><div class="history-toolbar"><select id="history-select" aria-label="Saved flights"><option value="">NO SAVED FLIGHTS</option></select><button type="button" id="history-refresh">REFRESH</button><button type="button" id="compare-open">COMPARE FLIGHTS</button></div><div id="history-list"></div><div id="replay-view" class="replay-view" hidden><div class="replay-toolbar"><button type="button" id="replay-toggle">PLAY</button><label>SPEED <select id="replay-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button type="button" id="replay-close">CLOSE</button></div><input id="replay-timeline" type="range" min="0" max="1" step="0.01" value="0" aria-label="Replay timeline"><div id="replay-markers" class="replay-markers"></div><canvas id="replay-canvas" width="640" height="220" aria-label="Flight replay trajectory"></canvas><div id="replay-readout" class="replay-readout"></div></div><div id="analytics-view" class="analytics-view" hidden><div id="analytics-summary" class="analytics-summary"></div><div id="chart-controls" class="chart-controls"></div><div class="chart-grid"></div></div><div id="compare-view" class="compare-view" hidden><div class="compare-toolbar"><select id="compare-a"></select><select id="compare-b"></select><button type="button" id="compare-run">RUN COMPARISON</button></div><div id="compare-warning"></div><div id="compare-results"></div><canvas id="compare-chart" width="640" height="180"></canvas></div></details>';
document.querySelector('.telemetry')?.append(historyPanel);
document.querySelector('#home-history')?.addEventListener('click', () => { homeState = false; document.querySelector('.shell')?.classList.remove('home-state'); startModal.classList.remove('active'); historyPanel.open = true; });
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
const recordLabel = (record: FlightRecord) => `${pilotNameForRecord(record)} · ${new Date(record.createdAt).toLocaleString()} · ${record.mode.toUpperCase()} · ${record.scenarioId ?? 'CLASSIC'} · ${record.report.outcome.toUpperCase()}${isLegacyRecord(record) ? ' · LEGACY' : ''}`;
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
const leaderboardPanel = document.createElement('details');
leaderboardPanel.className = 'leaderboard-panel';
leaderboardPanel.innerHTML = '<summary>GLOBAL LEADERBOARD</summary><div id="leaderboard-status">LOADING</div><div id="leaderboard-list"></div>';
document.querySelector('.telemetry')?.append(leaderboardPanel);
const leaderboardStatus = leaderboardPanel.querySelector<HTMLElement>('#leaderboard-status')!;
const leaderboardList = leaderboardPanel.querySelector<HTMLElement>('#leaderboard-list')!;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const refreshLeaderboard = async () => { try { const data = await fetchLeaderboard({ ranking: 'community', mode: 'engineering' }); leaderboardStatus.textContent = `${data.entries.length} COMMUNITY ENGINEERING ENTRIES`; leaderboardList.innerHTML = data.entries.length ? data.entries.map((entry, index) => `<div class="leaderboard-row"><b>${index + 1}</b><span>${escapeHtml(entry.pilotName)}<small>${entry.scenarioId ?? 'CLASSIC'} · ${entry.safetyGrade} · COMMUNITY / UNVERIFIED</small></span><strong>${entry.outcome.toUpperCase()}</strong></div>`).join('') : '<p class="leaderboard-empty">No Community Engineering results yet.</p>'; } catch { leaderboardStatus.textContent = 'SERVER UNAVAILABLE · LOCAL PLAY CONTINUES'; leaderboardList.innerHTML = ''; } };
void refreshLeaderboard();
window.setInterval(() => void refreshLeaderboard(), 30000);
const hallPanel = document.createElement('details');
hallPanel.className = 'hall-panel';
hallPanel.open = true;
hallPanel.innerHTML = '<summary>COMMUNITY TOP 10 // UNVERIFIED</summary><div class="hall-filters"><label>RANKING <select id="hall-ranking"><option value="community" selected>COMMUNITY / UNVERIFIED</option><option value="verified">VERIFIED ONLY</option></select></label><label>MODE <select id="hall-mode"><option value="engineering" selected>Engineering</option><option value="classic">Classic</option></select></label><label>SCENARIO <select id="hall-scenario"><option value="">ALL SCENARIOS</option></select></label><label>DIFFICULTY <select id="hall-difficulty"><option value="">ALL LEVELS</option><option value="easy">EASY</option><option value="normal">NORMAL</option><option value="hard">HARD</option></select></label><button type="button" id="hall-refresh">REFRESH</button></div><div id="hall-status">LOADING</div><div id="hall-list"></div><div id="hall-detail" class="hall-detail" hidden></div></details>';
document.querySelector('#home-hall')?.append(hallPanel);
const hallMode = hallPanel.querySelector<HTMLSelectElement>('#hall-mode')!;
const hallRanking = hallPanel.querySelector<HTMLSelectElement>('#hall-ranking')!;
const hallScenario = hallPanel.querySelector<HTMLSelectElement>('#hall-scenario')!;
const hallDifficulty = hallPanel.querySelector<HTMLSelectElement>('#hall-difficulty')!;
const hallStatus = hallPanel.querySelector<HTMLElement>('#hall-status')!;
const hallList = hallPanel.querySelector<HTMLElement>('#hall-list')!;
const hallDetail = hallPanel.querySelector<HTMLElement>('#hall-detail')!;
SCENARIOS.forEach((scenario) => { const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.label; hallScenario.append(option); });
const formatPublicDate = (value?: string) => { if (!value) return 'N/A'; if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium' }); return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
const publicValue = (value: number | null | undefined, unit = '') => value === null || value === undefined || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(1)}${unit}`;
const renderHallDetail = (entry: Awaited<ReturnType<typeof fetchPublicFlight>>) => { hallDetail.hidden = false; hallDetail.innerHTML = `<button type="button" class="hall-close" id="hall-close">CLOSE</button><h3>${escapeHtml(entry.pilotName)}${entry.recordType === 'diagnostic' ? ' · TEST / DIAGNOSTIC' : ''}</h3><div class="hall-detail-grid"><strong>PILOT</strong><span>${formatPublicDate(entry.createdAt)} · v${escapeHtml(entry.simulatorVersion ?? 'N/A')}</span><strong>MISSION</strong><span>${entry.mode.toUpperCase()} · ${escapeHtml(entry.scenarioId ?? 'CLASSIC')} · ${entry.outcome.toUpperCase()} · ${formatTime(entry.flightTime)}</span><strong>LANDING</strong><span>V ${publicValue(entry.touchdownVerticalSpeed, ' m/s')} · H ${publicValue(entry.touchdownHorizontalSpeed, ' m/s')} · ANGLE ${publicValue(entry.touchdownAngle, '°')} · ${escapeHtml(entry.moduleCondition ?? 'N/A')} · GRADE ${entry.safetyGrade}</span><strong>FUEL</strong><span>START ${publicValue(entry.initialFuel, ' kg')} · USED ${publicValue(entry.fuelUsed, ' kg')} · REMAINING ${publicValue(entry.remainingFuel, ' kg')} · GRADE ${entry.efficiencyGrade}</span><strong>PRECISION</strong><span>DISTANCE ${publicValue(entry.targetDistance, ' m')} · SLOPE ${publicValue(entry.terrainSlope, '°')} · GRADE ${entry.precisionGrade}</span>${entry.recordType === 'diagnostic' ? `<strong>SOURCE</strong><span>${escapeHtml(entry.source ?? 'USER_PROVIDED_MISSION_REPORT_SCREENSHOT')} · UNVERIFIED · REPLAY UNAVAILABLE</span>` : ''}</div><div class="hall-detail-actions"><button type="button" id="hall-telemetry">VIEW TELEMETRY</button><button type="button" id="hall-replay">WATCH REPLAY</button></div><small id="hall-detail-status">${entry.recordType === 'diagnostic' ? 'TEST / DIAGNOSTIC RECORD · REPLAY UNAVAILABLE' : entry.flightRecord ? 'PUBLIC FLIGHT RECORD AVAILABLE' : 'PUBLIC TELEMETRY RECORD UNAVAILABLE'}</small>`; hallDetail.querySelector('#hall-close')?.addEventListener('click', () => { hallDetail.hidden = true; }); const canReplay = entry.recordType !== 'diagnostic' && Boolean(entry.replayAvailable !== false && entry.flightRecord && entry.flightRecord.recordVersion === 1 && entry.flightRecord.simulatorVersion.startsWith('1.4')); hallDetail.querySelector<HTMLButtonElement>('#hall-telemetry')!.disabled = !canReplay; hallDetail.querySelector<HTMLButtonElement>('#hall-replay')!.disabled = !canReplay; hallDetail.querySelector('#hall-telemetry')?.addEventListener('click', () => { if (!entry.flightRecord) return; historyPanel.open = true; openAnalytics(entry.flightRecord); }); hallDetail.querySelector('#hall-replay')?.addEventListener('click', () => { if (!entry.flightRecord) return; historyPanel.open = true; openReplay(entry.flightRecord); }); };
const refreshHall = async () => { hallStatus.textContent = 'LOADING'; hallList.innerHTML = ''; hallDetail.hidden = true; try { const filters = { ranking: hallRanking.value as 'community' | 'verified', mode: hallMode.value as 'classic' | 'engineering', scenarioId: hallScenario.value || undefined, difficulty: hallDifficulty.value as 'easy' | 'normal' | 'hard' || undefined }; const data = await fetchLeaderboard(filters); const entries = sortHallOfFame(filterHallOfFame(data.entries, filters)); const community = filters.ranking === 'community'; hallPanel.querySelector('summary')!.textContent = community ? 'COMMUNITY TOP 10 // UNVERIFIED' : 'VERIFIED TOP 10'; hallStatus.textContent = entries.length ? `${entries.length} ${community ? 'COMMUNITY / UNVERIFIED' : 'VERIFIED'} RESULTS · TOP 10` : data.pendingCount && community ? `NO COMMUNITY RESULTS · ${data.pendingCount} SAVED` : community ? 'NO FLIGHTS RECORDED YET' : 'NO VERIFIED FLIGHTS RECORDED YET'; hallList.innerHTML = entries.length ? entries.map((entry, index) => `<button type="button" class="hall-row" data-hall-id="${escapeHtml(entry.id ?? '')}"><b>${index + 1}</b><span>${escapeHtml(entry.pilotName)}<small>${entry.safetyGrade} · V ${publicValue(entry.touchdownVerticalSpeed, ' m/s')} · FUEL ${publicValue(entry.fuelUsed, ' kg')} / REM ${publicValue(entry.remainingFuel, ' kg')} · ${community ? 'COMMUNITY / UNVERIFIED' : 'VERIFIED'}</small></span><time>${formatPublicDate(entry.createdAt)}</time></button>`).join('') : `<p class="hall-empty">${community && data.pendingCount ? 'SAVED RESULTS ARE WAITING FOR COMMUNITY RANKING' : community ? 'NO FLIGHTS RECORDED YET' : 'NO VERIFIED FLIGHTS RECORDED YET'}</p>`; hallList.querySelectorAll<HTMLButtonElement>('.hall-row').forEach((row) => row.addEventListener('click', async () => { const id = row.dataset.hallId; if (!id) return; hallStatus.textContent = 'LOADING DETAILS'; try { renderHallDetail(await fetchPublicFlight(id)); } catch (error) { hallDetail.hidden = false; hallDetail.textContent = error instanceof Error ? error.message : 'PUBLIC FLIGHT UNAVAILABLE'; } })); } catch { hallStatus.textContent = 'HALL OF FAME UNAVAILABLE · LOCAL PLAY CONTINUES'; hallList.innerHTML = '<p class="hall-empty">SERVER UNAVAILABLE — START A LOCAL MISSION</p>'; } };
hallRanking.addEventListener('change', () => void refreshHall()); hallMode.addEventListener('change', () => void refreshHall()); hallScenario.addEventListener('change', () => void refreshHall()); hallDifficulty.addEventListener('change', () => void refreshHall()); hallPanel.querySelector('#hall-refresh')?.addEventListener('click', () => void refreshHall()); void refreshHall();
const diagnosticPanel = document.createElement('details');
diagnosticPanel.className = 'hall-panel diagnostic-panel';
diagnosticPanel.innerHTML = '<summary>TEST / DIAGNOSTIC RECORDS</summary><div id="diagnostic-status">LOADING</div><div id="diagnostic-list"></div>';
document.querySelector('#home-hall')?.append(diagnosticPanel);
const diagnosticStatus = diagnosticPanel.querySelector<HTMLElement>('#diagnostic-status')!;
const diagnosticList = diagnosticPanel.querySelector<HTMLElement>('#diagnostic-list')!;
const refreshDiagnostics = async () => { try { const data = await fetchLeaderboard({ ranking: 'community', recordType: 'diagnostic', mode: 'classic' }); diagnosticStatus.textContent = data.entries.length ? `${data.entries.length} TEST RECORD${data.entries.length === 1 ? '' : 'S'}` : 'NO DIAGNOSTIC RECORDS'; diagnosticList.innerHTML = data.entries.map((entry) => `<button type="button" class="hall-row" data-diagnostic-id="${escapeHtml(entry.id ?? '')}"><b>TEST</b><span>${escapeHtml(entry.pilotName)}<small>${entry.safetyGrade} · ${escapeHtml(entry.source ?? 'DIAGNOSTIC')} · UNVERIFIED</small></span><time>${formatPublicDate(entry.createdAt)}</time></button>`).join(''); diagnosticList.querySelectorAll<HTMLButtonElement>('[data-diagnostic-id]').forEach((row) => row.addEventListener('click', async () => { try { renderHallDetail(await fetchPublicFlight(row.dataset.diagnosticId!)); } catch { diagnosticStatus.textContent = 'DIAGNOSTIC RECORD UNAVAILABLE'; } })); } catch { diagnosticStatus.textContent = 'DIAGNOSTIC VIEW UNAVAILABLE'; } };
void refreshDiagnostics();
const myFlightsPanel = document.createElement('details');
myFlightsPanel.className = 'my-flights-panel';
myFlightsPanel.innerHTML = '<summary>MY FLIGHTS // LOCAL DEVICE</summary><div id="my-flights-list">LOADING</div>';
document.querySelector('.telemetry')?.append(myFlightsPanel);
const myFlightsList = myFlightsPanel.querySelector<HTMLElement>('#my-flights-list')!;
const renderMyFlights = () => { myFlightsList.innerHTML = historyRecords.length ? historyRecords.map((record) => `<div class="my-flight-row"><span>${pilotNameForRecord(record)} · ${formatPublicDate(record.createdAt)} · ${record.mode.toUpperCase()} · ${record.report.outcome.toUpperCase()}<small>${record.scenarioId ?? 'CLASSIC'} · ${isLegacyRecord(record) ? 'LEGACY · NOT VERIFIED' : submittedFlightIds.has(record.id) ? 'PUBLISHED COMMUNITY' : 'LOCAL ONLY'}</small></span><button type="button" data-my-flight="${escapeHtml(record.id)}">OPEN REPLAY</button>${pilotNameForRecord(record) === 'UNKNOWN PILOT' ? `<button type="button" data-set-pilot="${escapeHtml(record.id)}">SET PILOT NAME</button>` : ''}${record.report.outcome === 'success' && !submittedFlightIds.has(record.id) ? `<button type="button" data-publish-flight="${escapeHtml(record.id)}">PUBLISH TO COMMUNITY HALL OF FAME</button>` : ''}</div>`).join('') : '<p class="leaderboard-empty">No local completed flights.</p>'; myFlightsList.querySelectorAll<HTMLButtonElement>('[data-my-flight]').forEach((button) => button.addEventListener('click', () => { const record = historyRecords.find((item) => item.id === button.dataset.myFlight); if (record) { historyPanel.open = true; openReplay(record); } })); myFlightsList.querySelectorAll<HTMLButtonElement>('[data-set-pilot]').forEach((button) => button.addEventListener('click', async () => { const record = historyRecords.find((item) => item.id === button.dataset.setPilot); if (!record) return; const entered = window.prompt('PILOT NAME / CALLSIGN', ''); if (entered === null) return; const name = normalizePilotName(entered); const error = validatePilotName(name); if (error) { window.alert(error); return; } const updated = assignLegacyPilotName(record, name); await recordStore.save(updated); historyRecords = historyRecords.map((item) => item.id === updated.id ? updated : item); renderHistory(); renderMyFlights(); })); myFlightsList.querySelectorAll<HTMLButtonElement>('[data-publish-flight]').forEach((button) => button.addEventListener('click', async () => { const record = historyRecords.find((item) => item.id === button.dataset.publishFlight); if (!record) return; let name = pilotNameForRecord(record); if (name === 'UNKNOWN PILOT') { const entered = window.prompt('PILOT NAME / CALLSIGN', ''); if (entered === null) return; name = normalizePilotName(entered); const error = validatePilotName(name); if (error) { window.alert(error); return; } } if (!window.confirm(`Publish ${name}'s landing to Community Hall of Fame?`)) return; const identity = { name, publicConsent: true } as PilotIdentity; const updated = assignLegacyPilotName(record, name); await recordStore.save(updated); const status = document.createElement('span'); status.className = 'my-flight-status'; status.textContent = 'CONTACTING SERVER…'; button.after(status); await publishRecord(updated, identity, status, button); historyRecords = historyRecords.map((item) => item.id === updated.id ? updated : item); renderHistory(); renderMyFlights(); })); };
renderMyFlights(); window.setInterval(renderMyFlights, 2000);

const scenarioPicker = document.createElement('label');
scenarioPicker.className = 'scenario-picker mode-picker';
scenarioPicker.innerHTML = `SCENARIO <select id="scenario-select">${SCENARIOS.map((scenario) => `<option value="${scenario.id}">${scenario.label}</option>`).join('')}</select><small id="scenario-description">${SCENARIOS[0].description}</small>`;
startModal.querySelector('.modal-card')?.insertBefore(scenarioPicker, startModal.querySelector('.mission-note'));
const scenarioSelect = scenarioPicker.querySelector<HTMLSelectElement>('#scenario-select')!;
const scenarioDescription = scenarioPicker.querySelector<HTMLElement>('#scenario-description')!;
scenarioSelect.addEventListener('change', () => { scenarioDescription.textContent = scenarioById(scenarioSelect.value as ScenarioId).description; });
const launchSelectedScenario = () => {
  const identity = readPilotIdentity();
  if (pilotConsentInput.checked && !identity) return;
  pilotIdentity = identity;
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
