import type { Mission } from '../simulation/mission';

export function bindControls(mission: Mission, onPause: () => void, onReset: () => void) {
  const held = new Set<string>();
  window.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'KeyR') onReset();
    if (event.code === 'Space' && !event.repeat) onPause();
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  return () => {
    if (held.has('KeyW')) mission.adjustThrottle(0.65 / 60);
    if (held.has('KeyS')) mission.adjustThrottle(-0.65 / 60);
    if (held.has('ArrowLeft')) mission.rotate(-0.42 / 60);
    if (held.has('ArrowRight')) mission.rotate(0.42 / 60);
  };
}
