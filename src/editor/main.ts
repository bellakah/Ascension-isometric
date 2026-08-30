import '../styles.css';
import './editor.css';
import { AssetBrowser } from './AssetBrowser';
import { EditorAssetPlacement } from './EditorAssetPlacement';
import { Engine } from '../engine/Engine';
import { createDemoWorld } from '../world/createDemoWorld';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found.');

root.innerHTML = `
  <main class="editor-shell">
    <section class="editor-viewport-wrap">
      <canvas class="viewport editor-viewport" tabindex="0" aria-label="Viewport 3D do editor"></canvas>
      <header class="editor-topbar">
        <div class="brand">
          <div class="brand-mark">A</div>
          <div class="brand-copy">
            <h1 class="brand-title">Ascension World Editor</h1>
            <p class="brand-subtitle">Etapa 2 · Asset System</p>
          </div>
        </div>
        <div class="editor-top-actions">
          <span class="editor-status" data-tone="normal">Editor pronto.</span>
          <a class="editor-button" href="/">Jogar</a>
        </div>
      </header>
      <aside class="editor-toolrail" aria-label="Ferramentas">
        <button class="tool-button active" type="button" title="Selecionar">↖<span>Selecionar</span></button>
        <button class="tool-button" type="button" title="Assets" data-open-assets>▦<span>Assets</span></button>
      </aside>
      <div class="editor-hint"><strong>Q/E</strong> gira 90° · <strong>scroll</strong> zoom · <strong>botão direito</strong> move câmera</div>
    </section>
    <section class="asset-dock" aria-label="Biblioteca de assets"></section>
  </main>`;

const canvas = root.querySelector<HTMLCanvasElement>('.editor-viewport');
const viewportWrap = root.querySelector<HTMLElement>('.editor-viewport-wrap');
const assetDock = root.querySelector<HTMLElement>('.asset-dock');
const status = root.querySelector<HTMLElement>('.editor-status');
if (!canvas || !viewportWrap || !assetDock || !status) throw new Error('Editor shell failed to initialize.');
const statusElement: HTMLElement = status;

function setStatus(message: string, tone: 'normal' | 'success' | 'error' = 'normal'): void {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
}

const engine = new Engine(canvas);
createDemoWorld(engine.scene);
engine.camera.setTarget(engine.camera.target.set(0, 0, 0));

const placement = new EditorAssetPlacement(engine, canvas, (message) => setStatus(message));
const browser = new AssetBrowser({
  root: assetDock,
  dropTarget: root,
  onPlace: (asset) => void placement.activate(asset).catch((error: unknown) => {
    setStatus(`Não foi possível preparar ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }),
  onStatus: setStatus,
});
void browser.initialize().catch((error: unknown) => {
  setStatus(`Falha ao abrir a biblioteca local: ${error instanceof Error ? error.message : String(error)}`, 'error');
});

let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 2) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  engine.camera.panScreen(dx, dy);
});
canvas.addEventListener('pointerup', (event) => {
  if (event.button !== 2) return;
  dragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  engine.camera.zoomByWheel(event.deltaY);
}, { passive: false });

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (event.code === 'KeyQ') engine.camera.rotateQuarter(-1);
  if (event.code === 'KeyE') engine.camera.rotateQuarter(1);
});

root.querySelector<HTMLElement>('[data-open-assets]')?.addEventListener('click', () => {
  assetDock.classList.toggle('collapsed');
});

engine.start();
window.addEventListener('beforeunload', () => {
  placement.dispose();
  browser.dispose();
  engine.dispose();
});
