import '../styles.css';
import { Engine } from '../engine/Engine';
import { createShell } from '../ui/createShell';
import { createDemoWorld } from '../world/createDemoWorld';
import { PlayerController } from './PlayerController';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found.');

const shell = createShell(root, {
  mode: 'game',
  title: 'Ascension Isometric',
  subtitle: 'Browser-first RPG/MMO foundation',
  help: '<span class="key">WASD</span> move o personagem · <span class="key">mouse wheel</span> aproxima/afasta · use o botão Editor para abrir o mesmo mundo no modo de edição.',
});

const engine = new Engine(shell.canvas);
const world = createDemoWorld(engine.scene);
const playerController = new PlayerController(world.player);
engine.camera.setTarget(world.player.position);

shell.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  engine.camera.zoomByWheel(event.deltaY);
}, { passive: false });

engine.start(({ delta, elapsed }) => {
  const moved = playerController.update(delta);
  if (moved) engine.camera.setTarget(world.player.position);
  world.player.position.y = Math.sin(elapsed * 3.5) * 0.025;
});

window.addEventListener('beforeunload', () => {
  playerController.dispose();
  engine.dispose();
  shell.dispose();
});
