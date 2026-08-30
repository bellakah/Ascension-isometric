import * as THREE from 'three';
import '../styles.css';
import { Engine } from '../engine/Engine';
import { createShell } from '../ui/createShell';
import { WorldDatabase } from '../world/WorldDatabase';
import { WorldEnvironment } from '../world/WorldEnvironment';
import { WorldRuntime } from '../world/WorldRuntime';
import { createWorldDocument, type WorldDocument } from '../world/WorldDocument';
import { readPlaytestWorld } from '../world/PlaytestSession';
import { PlayerController } from './PlayerController';

function createPlayer(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Playtest Player';
  const material = new THREE.MeshStandardMaterial({ color: 0x4f7cac, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.15, 4, 10), material);
  body.position.y = 1.08;
  body.castShadow = true;
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 6), new THREE.MeshStandardMaterial({ color: 0xe9e1a4 }));
  marker.position.set(0, 2.35, -0.38);
  marker.rotation.x = Math.PI / 2;
  marker.castShadow = true;
  group.add(body, marker);
  return group;
}

async function resolveWorld(playtest: boolean): Promise<WorldDocument> {
  if (playtest) {
    const session = readPlaytestWorld();
    if (session) return session;
  }
  const database = new WorldDatabase();
  const currentId = await database.getCurrentId();
  if (currentId) {
    const current = await database.get(currentId);
    if (current) return current;
  }
  const first = (await database.list())[0];
  if (first) {
    const document = await database.get(first.id);
    if (document) return document;
  }
  return createWorldDocument('Mapa vazio');
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('App root not found.');
  const playtest = new URLSearchParams(window.location.search).get('playtest') === '1';
  const document = await resolveWorld(playtest);

  const shell = createShell(root, {
    mode: 'game',
    title: playtest ? `Playtest · ${document.name}` : `Ascension · ${document.name}`,
    subtitle: playtest ? 'WorldDocument ao vivo do editor' : 'Runtime do mapa atual',
    help: '<span class="key">WASD</span> move · <span class="key">mouse wheel</span> zoom · o mundo renderizado vem do mesmo WorldDocument usado pelo editor.',
  });

  const engine = new Engine(shell.canvas);
  const environment = new WorldEnvironment(engine.scene, document, false);
  const runtime = new WorldRuntime(engine.scene, { onAssetError: (message) => console.warn(message) });
  await runtime.build(document);

  const player = createPlayer();
  player.position.set(document.spawn.x, document.spawn.y, document.spawn.z);
  engine.scene.add(player);
  const playerController = new PlayerController(player);
  engine.camera.setTarget(player.position);

  shell.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    engine.camera.zoomByWheel(event.deltaY);
  }, { passive: false });

  engine.start(({ delta, elapsed }) => {
    const moved = playerController.update(delta);
    if (moved) engine.camera.setTarget(player.position);
    player.children[0]!.position.y = 1.08 + Math.sin(elapsed * 3.5) * 0.025;
  });

  window.addEventListener('beforeunload', () => {
    playerController.dispose();
    runtime.dispose();
    environment.dispose();
    engine.dispose();
    shell.dispose();
  });
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector<HTMLElement>('#app');
  if (root) root.innerHTML = `<main style="padding:24px;color:#fff;background:#111;min-height:100vh">Falha ao abrir mapa: ${error instanceof Error ? error.message : String(error)}</main>`;
});
