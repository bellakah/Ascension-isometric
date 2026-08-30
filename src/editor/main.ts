import '../styles.css';
import { Engine } from '../engine/Engine';
import { createShell } from '../ui/createShell';
import { createDemoWorld } from '../world/createDemoWorld';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found.');

const shell = createShell(root, {
  mode: 'editor',
  title: 'Ascension World Editor',
  subtitle: 'Editor e jogo compartilham o mesmo runtime',
  help: '<span class="key">mouse wheel</span> zoom · <span class="key">arraste com botão direito</span> para mover a câmera · <span class="key">Q/E</span> gira a visão em 90°. Ferramentas de seleção e importação entram nas próximas etapas.',
});

const engine = new Engine(shell.canvas);
createDemoWorld(engine.scene);
engine.camera.setTarget(engine.camera.target.set(0, 0, 0));

let dragging = false;
let lastX = 0;
let lastY = 0;

shell.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
shell.canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 2) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  shell.canvas.setPointerCapture(event.pointerId);
});
shell.canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  engine.camera.panScreen(dx, dy);
});
shell.canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  if (shell.canvas.hasPointerCapture(event.pointerId)) shell.canvas.releasePointerCapture(event.pointerId);
});
shell.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  engine.camera.zoomByWheel(event.deltaY);
}, { passive: false });
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyQ') engine.camera.rotateQuarter(-1);
  if (event.code === 'KeyE') engine.camera.rotateQuarter(1);
});

engine.start();
window.addEventListener('beforeunload', () => {
  engine.dispose();
  shell.dispose();
});
