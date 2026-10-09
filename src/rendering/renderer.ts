import type { CraftState } from '../physics/types';
import type { LunarTerrain } from '../terrain/lunar-terrain';
import { INITIAL_CAMERA, updateCamera, type CameraState } from './camera';
import type { TouchdownPrediction } from '../simulation/touchdown-prediction';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain?: LunarTerrain;
  private camera: CameraState = INITIAL_CAMERA;
  private landingAssist = true;
  private prediction?: TouchdownPrediction;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  setTerrain(terrain?: LunarTerrain) { this.terrain = terrain; }
  setLandingAssist(enabled: boolean) { this.landingAssist = enabled; }
  setPrediction(prediction?: TouchdownPrediction) { this.prediction = prediction; }
  resize() { const rect = this.canvas.getBoundingClientRect(); const dpr = devicePixelRatio || 1; this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  draw(craft: CraftState, time: number, terrain = this.terrain) {
    const { ctx } = this; const w = this.canvas.clientWidth; const h = this.canvas.clientHeight; ctx.clearRect(0, 0, w, h);
    this.camera = updateCamera(this.camera, craft, terrain, 1 / 60);
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#09131d'); sky.addColorStop(0.7, '#18212a'); sky.addColorStop(1, '#4a4037'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#dbe8e8'; for (let i = 0; i < 55; i++) { const x = (i * 97) % w; const y = (i * 43) % (h * 0.62); ctx.globalAlpha = 0.2 + ((i * 13) % 5) / 10; ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1); } ctx.globalAlpha = 1;
    const horizon = h * 0.77; const scale = Math.min(w / 780, h / 600) * this.camera.zoom; const worldScale = 0.4 * this.camera.zoom; const worldToScreenX = (worldX: number) => w / 2 + (worldX - this.camera.x) * worldScale; ctx.fillStyle = '#8d8172'; ctx.beginPath(); ctx.moveTo(0, horizon); for (let screenX = 0; screenX <= w; screenX += 12) { const worldX = this.camera.x + (screenX - w / 2) / worldScale; const terrainY = terrain ? terrain.heightAt(worldX) : (Math.sin(screenX * 0.018) * 9 + Math.sin(screenX * 0.063) * 4) / (scale * 0.78); ctx.lineTo(screenX, horizon - terrainY * scale * 0.78); } ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    if (terrain) {
      for (const crater of terrain.profile.craters) {
        const left = crater.x - crater.radius * 1.35; const right = crater.x + crater.radius * 1.35; const leftScreen = worldToScreenX(left); const rightScreen = worldToScreenX(right);
        if (rightScreen < -80 || leftScreen > w + 80) continue;
        const floorY = horizon - terrain.heightAt(crater.x) * scale * 0.78;
        ctx.fillStyle = 'rgba(37,28,22,.42)'; ctx.beginPath(); ctx.moveTo(leftScreen, horizon - terrain.heightAt(left) * scale * 0.78); for (let worldX = left; worldX <= right; worldX += 3) ctx.lineTo(worldToScreenX(worldX), horizon - terrain.heightAt(worldX) * scale * 0.78); ctx.lineTo(rightScreen, floorY + crater.depth * scale * 0.35); ctx.lineTo(leftScreen, floorY + crater.depth * scale * 0.35); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(240,225,190,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(leftScreen, horizon - terrain.heightAt(left) * scale * 0.78); for (let worldX = left; worldX <= crater.x - crater.radius * 0.72; worldX += 3) ctx.lineTo(worldToScreenX(worldX), horizon - terrain.heightAt(worldX) * scale * 0.78); ctx.stroke();
        ctx.strokeStyle = 'rgba(24,20,19,.65)'; ctx.beginPath(); for (let worldX = crater.x + crater.radius * 0.72; worldX <= right; worldX += 3) ctx.lineTo(worldToScreenX(worldX), horizon - terrain.heightAt(worldX) * scale * 0.78); ctx.stroke();
      }
      ctx.fillStyle = '#3b3028'; for (const obstacle of terrain.profile.obstacles) { const x = worldToScreenX(obstacle.x); const y = horizon - obstacle.y * scale * 0.78; ctx.beginPath(); ctx.ellipse(x, y, obstacle.radius * scale * 0.55, obstacle.radius * scale * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(235,220,190,.12)'; for (let screenX = 0; screenX < w; screenX += 22) { const worldX = this.camera.x + (screenX - w / 2) / worldScale; const y = horizon - terrain.heightAt(worldX) * scale * 0.78; ctx.fillRect(screenX + ((Math.floor(worldX) * 17) % 7), y + 5, 2, 1); }
      if (this.landingAssist) { ctx.lineWidth = 3; for (let screenX = 0; screenX < w; screenX += 12) { const worldX = this.camera.x + (screenX - w / 2) / worldScale; const slope = Math.abs(terrain.slopeAt(worldX)); const safe = terrain.isSafeLandingArea(worldX); const obstacle = terrain.obstaclesAt(worldX, terrain.heightAt(worldX), 0.8).length > 0; ctx.strokeStyle = safe ? 'rgba(104,197,177,.9)' : obstacle || slope > 0.36 ? 'rgba(235,107,94,.9)' : 'rgba(244,169,0,.85)'; ctx.beginPath(); ctx.moveTo(screenX, horizon - terrain.heightAt(worldX) * scale * 0.78); ctx.lineTo(screenX + 12, horizon - terrain.heightAt(worldX + 12 / worldScale) * scale * 0.78); ctx.stroke(); } }
      if (this.landingAssist) { ctx.fillStyle = 'rgba(104,197,177,.18)'; ctx.strokeStyle = 'rgba(104,197,177,.75)'; ctx.lineWidth = 1; for (const pad of terrain.profile.safePads) { const left = worldToScreenX(pad.start); const right = worldToScreenX(pad.end); const y = horizon - terrain.heightAt(pad.center) * scale * 0.78; ctx.fillRect(left, y - 5, right - left, 8); ctx.strokeRect(left, y - 5, right - left, 8); } }
    }
    if (this.prediction?.available && terrain) { const x = worldToScreenX(this.prediction.x); const y = horizon - terrain.heightAt(this.prediction.x) * scale * 0.78; ctx.strokeStyle = this.prediction.zone === 'Safe' ? '#68c5b1' : this.prediction.zone === 'Caution' ? '#f4a900' : '#eb6b5e'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x, 45); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(37,28,22,.35)'; for (let i = 0; i < 8; i++) { const x = (i * 173 + 40) % w; const y = horizon + 24 + (i % 3) * 20; ctx.beginPath(); ctx.ellipse(x, y, 28 + i * 3, 7 + i, 0, 0, Math.PI * 2); ctx.fill(); }
    const cx = worldToScreenX(craft.position.x); const cy = horizon - craft.position.y * scale * 0.78; ctx.save(); ctx.translate(cx, cy); ctx.rotate(craft.angle);
    if (craft.engineOn) { ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.moveTo(-9, 31); ctx.lineTo(9, 31); ctx.lineTo(3, 75 + Math.sin(time * 40) * 8); ctx.lineTo(0, 88 + Math.sin(time * 23) * 10); ctx.lineTo(-5, 70); ctx.fill(); ctx.fillStyle = '#f7f0d1'; ctx.beginPath(); ctx.moveTo(-4, 34); ctx.lineTo(4, 34); ctx.lineTo(0, 67 + Math.sin(time * 30) * 6); ctx.fill(); }
    ctx.strokeStyle = '#b8c1c1'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, 24); ctx.lineTo(-37, 57); ctx.lineTo(-55, 57); ctx.moveTo(24, 24); ctx.lineTo(37, 57); ctx.lineTo(55, 57); ctx.stroke(); ctx.fillStyle = '#d6d8ce'; ctx.beginPath(); ctx.moveTo(-24, -35); ctx.lineTo(24, -35); ctx.lineTo(32, 25); ctx.lineTo(-32, 25); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4c6e78'; ctx.fillRect(-20, -25, 40, 18); ctx.fillStyle = '#e4a72c'; ctx.fillRect(-28, 2, 56, 8); ctx.fillStyle = '#59605e'; ctx.fillRect(-7, 24, 14, 12); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText('NORTH // LANDING SITE 01', 18, 24);
  }
}
