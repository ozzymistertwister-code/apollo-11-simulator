import { Mission } from '../simulation/mission';
import type { FlightMode } from '../config/physics';
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
if (footerVersion) footerVersion.textContent = 'SIMULATION 1.3.0 · GAME VALUES, NOT HISTORICAL FLIGHT DATA';
const keyboardStep = bindControls(() => mission, () => mission.pause(), () => reset());
window.setInterval(keyboardStep, 1000 / 60);
window.setInterval(() => renderer.setTerrain(mission.terrain), 100);
reportCard?.insertAdjacentHTML('beforeend', '<div class="surface-report"><span>LANDING RESULT</span><b id="landing-result">—</b><span>SURFACE SLOPE</span><b id="landing-slope">—</b><span>SUPPORT CONTACTS</span><b id="landing-supports">—</b></div>');
window.setInterval(() => { const touchdown = mission.state.touchdown; const assessment = mission.state.assessment; if (!touchdown || !assessment) return; $('landing-result').textContent = assessment.result; $('landing-slope').textContent = `${(Math.abs(assessment.slope) * 180 / Math.PI).toFixed(1)}°`; $('landing-supports').textContent = `${assessment.supportContacts}/2`; }, 100);
