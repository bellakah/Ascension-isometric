import * as THREE from 'three';
import '../styles.css';
import './combat.css';
import { OpenWorldCamera } from '../camera/OpenWorldCamera';
import { CharacterActor } from '../character/CharacterActor';
import { CombatStateMachine, type CombatAttackDurations, type CombatState } from '../character/CombatStateMachine';
import { CharacterDatabase } from '../character/CharacterDatabase';
import type { CharacterPreset } from '../character/CharacterPreset';
import { Engine } from '../engine/Engine';
import { createShell } from '../ui/createShell';
import { WorldDatabase } from '../world/WorldDatabase';
import { WorldEnvironment } from '../world/WorldEnvironment';
import { WorldRuntime } from '../world/WorldRuntime';
import { createWorldDocument, type WorldDocument } from '../world/WorldDocument';
import { readPlaytestWorld } from '../world/PlaytestSession';
import { PlayerController } from './PlayerController';

function createFallbackPlayer(): THREE.Group {
  const group = new THREE.Group(); group.name = 'Fallback Player';
  const material = new THREE.MeshStandardMaterial({ color: 0x4f7cac, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.15, 4, 10), material); body.position.y = 1.08; body.castShadow = true;
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 6), new THREE.MeshStandardMaterial({ color: 0xe9e1a4 })); marker.position.set(0, 2.35, -0.38); marker.rotation.x = Math.PI / 2; marker.castShadow = true;
  group.add(body, marker); return group;
}

async function resolveWorld(playtest: boolean): Promise<WorldDocument> {
  if (playtest) { const session = readPlaytestWorld(); if (session) return session; }
  const database = new WorldDatabase(); const currentId = await database.getCurrentId();
  if (currentId) { const current = await database.get(currentId); if (current) return current; }
  const first = (await database.list())[0]; if (first) { const world = await database.get(first.id); if (world) return world; }
  return createWorldDocument('Mapa vazio');
}

function attackClipForState(preset: CharacterPreset, state: CombatState): string {
  if (state === 'attack-1') return preset.combat.clips.attack1; if (state === 'attack-2') return preset.combat.clips.attack2; if (state === 'attack-3') return preset.combat.clips.attack3; return '';
}

function stateLabel(state: CombatState): string {
  if (state === 'attack-1') return 'Combo 1'; if (state === 'attack-2') return 'Combo 2'; if (state === 'attack-3') return 'Combo 3'; if (state === 'block') return 'Defendendo'; if (state === 'recover') return 'Recuperando'; return 'Livre';
}

async function bootstrap(): Promise<void> {
  const root = globalThis.document.querySelector<HTMLElement>('#app'); if (!root) throw new Error('App root not found.');
  const playtest = new URLSearchParams(window.location.search).get('playtest') === '1'; const worldDocument = await resolveWorld(playtest);
  const characterDatabase = new CharacterDatabase(); const activeCharacter = await characterDatabase.getActive();
  const shell = createShell(root, {
    mode: 'game', title: playtest ? `Playtest · ${worldDocument.name}` : `Ascension · ${worldDocument.name}`,
    subtitle: activeCharacter ? `Personagem: ${activeCharacter.name} · ${activeCharacter.combat.profile}` : 'Nenhum preset ativo · usando personagem placeholder',
    help: '<span class="key">WASD</span> move relativo à câmera · <span class="key">Shift</span> corre · <span class="key">RMB+arrastar</span> gira câmera · <span class="key">Wheel</span> zoom · <span class="key">LMB/J</span> ataca · <span class="key">K</span> defende.',
  });
  const gameCamera = new OpenWorldCamera();
  gameCamera.connect(shell.canvas);
  const engine = new Engine(shell.canvas, gameCamera);
  const environment = new WorldEnvironment(engine.scene, worldDocument, false);
  gameCamera.setTerrainHeightResolver((x, z) => environment.terrainHeight(x, z));
  const runtime = new WorldRuntime(engine.scene, { onAssetError: (message) => console.warn(message), heightAt: (x, z) => environment.terrainHeight(x, z) });
  await runtime.build(worldDocument);

  let characterActor: CharacterActor | null = null; let fallbackPlayer: THREE.Group | null = null; let player: THREE.Object3D;
  if (activeCharacter?.base) { characterActor = new CharacterActor({ onWarning: (message) => console.warn(message) }); await characterActor.build(activeCharacter); player = characterActor.root; }
  else { fallbackPlayer = createFallbackPlayer(); player = fallbackPlayer; }
  const spawnY = environment.terrainHeight(worldDocument.spawn.x, worldDocument.spawn.z);
  player.position.set(worldDocument.spawn.x, spawnY, worldDocument.spawn.z); engine.scene.add(player);
  gameCamera.update(player.position, 0);
  const playerController = new PlayerController(player, { document: worldDocument, heightAt: (x, z) => environment.terrainHeight(x, z) });
  const combat = new CombatStateMachine(); const combatHud = document.createElement('div'); combatHud.className = 'combat-hud'; root.append(combatHud);

  const durations: CombatAttackDurations = activeCharacter && characterActor ? {
    attack1: characterActor.clipDuration(activeCharacter.combat.clips.attack1), attack2: characterActor.clipDuration(activeCharacter.combat.clips.attack2), attack3: characterActor.clipDuration(activeCharacter.combat.clips.attack3),
  } : { attack1: 0, attack2: 0, attack3: 0 };

  engine.start(({ delta, elapsed }) => {
    const motion = playerController.update(delta, combat.movementMultiplier, gameCamera.yaw);
    const frame = combat.update(delta, { attackPressed: playerController.consumeAttackPressed(), blockHeld: playerController.isBlockHeld, moved: motion.moved, sprinting: motion.sprinting }, durations);
    gameCamera.update(player.position, delta);
    if (characterActor && activeCharacter) {
      if (frame.changed) {
        const attackClip = attackClipForState(activeCharacter, frame.state);
        if (attackClip) characterActor.playOneShot(attackClip, 0.08);
        else if (frame.state === 'block') { if (!characterActor.playClip(activeCharacter.combat.clips.block, 0.08)) characterActor.setMotion('idle', 0.08); }
        else if (frame.state === 'recover') characterActor.setMotion('idle', 0.1);
      }
      if (frame.state === 'locomotion') characterActor.setMotion(motion.sprinting ? 'run' : motion.moved ? 'walk' : 'idle'); characterActor.update(delta);
    } else if (fallbackPlayer?.children[0]) fallbackPlayer.children[0].position.y = 1.08 + Math.sin(elapsed * 3.5) * 0.025;
    const profile = activeCharacter?.combat.profile ?? 'placeholder'; combatHud.innerHTML = `<strong>${stateLabel(frame.state)}</strong><span>${profile} · movimento ${Math.round(frame.movementMultiplier * 100)}%</span>`; combatHud.dataset.state = frame.state;
  });

  window.addEventListener('beforeunload', () => { playerController.dispose(); gameCamera.dispose(); characterActor?.dispose(); runtime.dispose(); environment.dispose(); combatHud.remove(); engine.dispose(); shell.dispose(); });
}

void bootstrap().catch((error: unknown) => {
  console.error(error); const root = globalThis.document.querySelector<HTMLElement>('#app'); if (root) root.innerHTML = `<main style="padding:24px;color:#fff;background:#111;min-height:100vh">Falha ao abrir mapa/personagem: ${error instanceof Error ? error.message : String(error)}</main>`;
});
