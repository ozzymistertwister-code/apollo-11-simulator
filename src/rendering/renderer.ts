import type { CraftState } from '../physics/types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  resize() { const rect = this.canvas.getBoundingClientRect(); const dpr = devicePixelRatio || 1; this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  draw(craft: CraftState, time: number) {
    const { ctx } = this; const w = this.canvas.clientWidth; const h = this.canvas.clientHeight; ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#09131d'); sky.addColorStop(0.7, '#18212a'); sky.addColorStop(1, '#4a4037'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#dbe8e8'; for (let i = 0; i < 55; i++) { const x = (i * 97) % w; const y = (i * 43) % (h * 0.62); ctx.globalAlpha = 0.2 + ((i * 13) % 5) / 10; ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1); } ctx.globalAlpha = 1;
    const horizon = h * 0.77; ctx.fillStyle = '#8d8172'; ctx.beginPath(); ctx.moveTo(0, horizon); for (let x = 0; x <= w; x += 18) ctx.lineTo(x, horizon + Math.sin(x * 0.018) * 9 + Math.sin(x * 0.063) * 4); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = 'rgba(37,28,22,.35)'; for (let i = 0; i < 8; i++) { const x = (i * 173 + 40) % w; const y = horizon + 24 + (i % 3) * 20; ctx.beginPath(); ctx.ellipse(x, y, 28 + i * 3, 7 + i, 0, 0, Math.PI * 2); ctx.fill(); }
    const scale = Math.min(w / 780, h / 600); const cx = w / 2 + craft.position.x * 0.4; const cy = horizon - craft.position.y * scale * 0.78; ctx.save(); ctx.translate(cx, cy); ctx.rotate(craft.angle);
    if (craft.engineOn) { ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.moveTo(-9, 31); ctx.lineTo(9, 31); ctx.lineTo(3, 75 + Math.sin(time * 40) * 8); ctx.lineTo(0, 88 + Math.sin(time * 23) * 10); ctx.lineTo(-5, 70); ctx.fill(); ctx.fillStyle = '#f7f0d1'; ctx.beginPath(); ctx.moveTo(-4, 34); ctx.lineTo(4, 34); ctx.lineTo(0, 67 + Math.sin(time * 30) * 6); ctx.fill(); }
    ctx.strokeStyle = '#b8c1c1'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, 24); ctx.lineTo(-37, 57); ctx.lineTo(-55, 57); ctx.moveTo(24, 24); ctx.lineTo(37, 57); ctx.lineTo(55, 57); ctx.stroke(); ctx.fillStyle = '#d6d8ce'; ctx.beginPath(); ctx.moveTo(-24, -35); ctx.lineTo(24, -35); ctx.lineTo(32, 25); ctx.lineTo(-32, 25); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4c6e78'; ctx.fillRect(-20, -25, 40, 18); ctx.fillStyle = '#e4a72c'; ctx.fillRect(-28, 2, 56, 8); ctx.fillStyle = '#59605e'; ctx.fillRect(-7, 24, 14, 12); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText('NORTH // LANDING SITE 01', 18, 24);
  }
}
