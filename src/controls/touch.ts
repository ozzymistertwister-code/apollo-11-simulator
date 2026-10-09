export type TouchAction = 'throttle-up' | 'throttle-down' | 'left' | 'right';

type TouchHandler = (action: TouchAction, amount: number) => void;

/** Binds a button to a small tap step plus a frame-independent hold repeat. */
export function bindTouchControl(button: HTMLButtonElement, action: TouchAction, onAction: TouchHandler) {
  let activePointer: number | undefined;
  let holdTimer: number | undefined;
  let lastFrame = 0;
  const tapStep = action === 'throttle-up' || action === 'throttle-down' ? 0.04 : 0.04;
  const holdRate = action === 'throttle-up' || action === 'throttle-down' ? 0.6 : 0.75;

  const direction = action === 'throttle-down' || action === 'left' ? -1 : 1;
  const stop = () => {
    activePointer = undefined;
    if (holdTimer !== undefined) window.cancelAnimationFrame(holdTimer);
    holdTimer = undefined;
    button.classList.remove('is-held');
  };
  const repeat = (now: number) => {
    if (activePointer === undefined) return;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
    lastFrame = now;
    if (dt > 0) onAction(action, direction * holdRate * dt);
    holdTimer = window.requestAnimationFrame(repeat);
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (activePointer !== undefined) return;
    activePointer = event.pointerId;
    lastFrame = performance.now();
    button.setPointerCapture(event.pointerId);
    button.classList.add('is-held');
    onAction(action, direction * tapStep);
    holdTimer = window.requestAnimationFrame(repeat);
  }, { passive: false });
  button.addEventListener('pointerup', (event) => { if (event.pointerId === activePointer) stop(); });
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
  button.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse' && event.pointerId === activePointer) stop(); });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
