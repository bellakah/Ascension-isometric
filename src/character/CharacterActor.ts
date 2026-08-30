import * as THREE from 'three';
import { AssetDatabase } from '../assets/AssetDatabase';
import { loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type {
  CharacterAssetRef,
  CharacterEquipmentAttachment,
  CharacterEquipmentSlot,
  CharacterPreset,
} from './CharacterPreset';

export type CharacterMotion = 'idle' | 'walk' | 'run';
export interface CharacterActorOptions { onWarning?(message: string): void; }
interface LoadedVisual { root: THREE.Object3D; asset: AssetRecord; }

function hasBone(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((child) => { if (child instanceof THREE.Bone) found = true; });
  return found;
}

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if (!found && child instanceof THREE.Bone && child.name === name) found = child;
  });
  return found;
}

function allowedHeadInfluence(mesh: THREE.SkinnedMesh, vertexIndex: number): number {
  const skinIndex = mesh.geometry.getAttribute('skinIndex');
  const skinWeight = mesh.geometry.getAttribute('skinWeight');
  if (!skinIndex || !skinWeight) return 0;
  const allowed = new Set<number>();
  mesh.skeleton.bones.forEach((bone, index) => { if (bone.name === 'Head' || bone.name === 'neck_01') allowed.add(index); });
  const indices = [skinIndex.getX(vertexIndex), skinIndex.getY(vertexIndex), skinIndex.getZ(vertexIndex), skinIndex.getW(vertexIndex)];
  const weights = [skinWeight.getX(vertexIndex), skinWeight.getY(vertexIndex), skinWeight.getZ(vertexIndex), skinWeight.getW(vertexIndex)];
  let total = 0;
  for (let index = 0; index < 4; index += 1) if (allowed.has(indices[index] ?? -1)) total += weights[index] ?? 0;
  return total;
}

function isolateHeadGeometry(mesh: THREE.SkinnedMesh): void {
  const name = mesh.name.toLowerCase();
  if (name.includes('eye') || name.includes('brow') || name.includes('face')) return;
  if (!mesh.geometry.getAttribute('skinIndex') || !mesh.geometry.getAttribute('skinWeight')) return;
  const source = mesh.geometry;
  const sourceIndex = source.getIndex();
  const vertexCount = source.getAttribute('position')?.count ?? 0;
  if (vertexCount === 0) return;
  const triangleIndices: number[] = [];
  const readIndex = (offset: number): number => sourceIndex ? sourceIndex.getX(offset) : offset;
  const indexCount = sourceIndex?.count ?? vertexCount;
  for (let offset = 0; offset + 2 < indexCount; offset += 3) {
    const a = readIndex(offset); const b = readIndex(offset + 1); const c = readIndex(offset + 2);
    const influence = [allowedHeadInfluence(mesh, a), allowedHeadInfluence(mesh, b), allowedHeadInfluence(mesh, c)];
    if (influence.filter((value) => value >= 0.35).length >= 2) triangleIndices.push(a, b, c);
  }
  const geometry = source.clone();
  geometry.setIndex(triangleIndices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry = geometry;
  if (triangleIndices.length === 0) mesh.visible = false;
}

function isolateBaseToHead(root: THREE.Object3D): void {
  root.traverse((child) => { if (child instanceof THREE.SkinnedMesh) isolateHeadGeometry(child); });
}

function assetRefs(preset: CharacterPreset): CharacterAssetRef[] {
  const refs: CharacterAssetRef[] = [];
  if (preset.base) refs.push(preset.base);
  const visuals = preset.visuals;
  if (visuals.outfit) refs.push(visuals.outfit);
  else for (const slot of ['body', 'arms', 'legs', 'feet', 'headgear', 'accessory'] as const) { const item = visuals[slot]; if (item) refs.push(item); }
  if (visuals.hair) refs.push(visuals.hair);
  return refs;
}

function hasClothing(preset: CharacterPreset): boolean {
  return Boolean(preset.visuals.outfit || preset.visuals.body || preset.visuals.arms || preset.visuals.legs || preset.visuals.feet || preset.visuals.headgear || preset.visuals.accessory);
}

function configureShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function applyAttachmentTransform(root: THREE.Object3D, attachment: CharacterEquipmentAttachment): void {
  root.position.set(attachment.transform.position.x, attachment.transform.position.y, attachment.transform.position.z);
  root.rotation.set(
    THREE.MathUtils.degToRad(attachment.transform.rotationDegrees.x),
    THREE.MathUtils.degToRad(attachment.transform.rotationDegrees.y),
    THREE.MathUtils.degToRad(attachment.transform.rotationDegrees.z),
  );
  root.scale.set(attachment.transform.scale.x, attachment.transform.scale.y, attachment.transform.scale.z);
}

export class CharacterActor {
  readonly root = new THREE.Group();
  private readonly database = new AssetDatabase();
  private readonly mixers: THREE.AnimationMixer[] = [];
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly currentActions: THREE.AnimationAction[] = [];
  private preset: CharacterPreset | null = null;
  private currentClipName = '';

  constructor(private readonly options: CharacterActorOptions = {}) { this.root.name = 'Character Actor'; }

  async build(preset: CharacterPreset): Promise<void> {
    this.clear();
    this.preset = preset;
    const visualRoot = new THREE.Group();
    visualRoot.name = `${preset.name} Visual`;
    this.root.add(visualRoot);
    const loadedVisuals: LoadedVisual[] = [];
    for (const item of assetRefs(preset)) {
      const asset = await this.database.get(item.assetId);
      if (!asset) { this.options.onWarning?.(`Asset de personagem ausente: ${item.assetName}.`); continue; }
      try {
        const loaded = await loadStoredAsset(asset);
        loaded.scene.name = asset.name;
        configureShadows(loaded.scene);
        loadedVisuals.push({ root: loaded.scene, asset });
      } catch (error) {
        this.options.onWarning?.(`Falha ao carregar ${asset.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (preset.baseMode === 'head-only' && hasClothing(preset)) {
      const baseVisual = loadedVisuals.find((entry) => entry.asset.id === preset.base?.assetId);
      if (baseVisual) isolateBaseToHead(baseVisual.root);
    }
    for (const visual of loadedVisuals) visualRoot.add(visual.root);
    visualRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(visualRoot);
    if (!bounds.isEmpty()) visualRoot.position.y -= bounds.min.y;

    const baseVisual = loadedVisuals.find((entry) => entry.asset.id === preset.base?.assetId);
    const rigRoot = baseVisual?.root ?? loadedVisuals.find((entry) => hasBone(entry.root))?.root;
    if (rigRoot) await this.attachEquipment(preset, rigRoot);
    else if (Object.keys(preset.equipment).length > 0) this.options.onWarning?.('Não foi possível localizar um rig para anexar equipamentos.');

    for (const libraryRef of preset.animationLibraries) {
      const asset = await this.database.get(libraryRef.assetId);
      if (!asset) { this.options.onWarning?.(`Biblioteca de animação ausente: ${libraryRef.assetName}.`); continue; }
      try {
        const loaded = await loadStoredAsset(asset);
        for (const clip of loaded.animations) if (!this.clips.has(clip.name)) this.clips.set(clip.name, clip);
      } catch (error) {
        this.options.onWarning?.(`Falha ao carregar animações de ${asset.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const visual of loadedVisuals) if (hasBone(visual.root)) this.mixers.push(new THREE.AnimationMixer(visual.root));
    this.setMotion('idle', 0);
  }

  get animationNames(): string[] { return [...this.clips.keys()].sort((a, b) => a.localeCompare(b)); }
  get currentPreset(): CharacterPreset | null { return this.preset; }

  setMotion(motion: CharacterMotion, fadeSeconds = 0.18): void {
    if (this.preset) this.playClip(this.preset.clips[motion], fadeSeconds);
  }

  playClip(name: string, fadeSeconds = 0.18): boolean {
    return this.startClip(name, fadeSeconds, false) > 0;
  }

  playOneShot(name: string, fadeSeconds = 0.08): number {
    return this.startClip(name, fadeSeconds, true);
  }

  clipDuration(name: string): number {
    return this.clips.get(name)?.duration ?? 0;
  }

  update(delta: number): void { for (const mixer of this.mixers) mixer.update(delta); }
  dispose(): void { this.clear(); }

  private startClip(name: string, fadeSeconds: number, oneShot: boolean): number {
    if (!name) return 0;
    const clip = this.clips.get(name);
    if (!clip) return 0;
    if (!oneShot && this.currentClipName === name) return clip.duration;
    for (const action of this.currentActions) fadeSeconds > 0 ? action.fadeOut(fadeSeconds) : action.stop();
    this.currentActions.length = 0;
    for (const mixer of this.mixers) {
      const action = mixer.clipAction(clip);
      action.reset();
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      if (oneShot) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      if (fadeSeconds > 0) action.fadeIn(fadeSeconds);
      action.play();
      this.currentActions.push(action);
    }
    this.currentClipName = name;
    return this.currentActions.length > 0 ? clip.duration : 0;
  }

  private async attachEquipment(preset: CharacterPreset, rigRoot: THREE.Object3D): Promise<void> {
    for (const slot of ['mainHand', 'offHand', 'back'] as const satisfies readonly CharacterEquipmentSlot[]) {
      const attachment = preset.equipment[slot];
      if (!attachment) continue;
      const socket = findBone(rigRoot, attachment.socket);
      if (!socket) {
        this.options.onWarning?.(`Socket ${attachment.socket} não encontrado para ${attachment.asset.assetName}.`);
        continue;
      }
      const asset = await this.database.get(attachment.asset.assetId);
      if (!asset) {
        this.options.onWarning?.(`Equipamento ausente: ${attachment.asset.assetName}.`);
        continue;
      }
      try {
        const loaded = await loadStoredAsset(asset);
        const equipmentRoot = loaded.scene;
        equipmentRoot.name = `${slot}: ${asset.name}`;
        configureShadows(equipmentRoot);
        applyAttachmentTransform(equipmentRoot, attachment);
        socket.add(equipmentRoot);
      } catch (error) {
        this.options.onWarning?.(`Falha ao carregar equipamento ${asset.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private clear(): void {
    for (const action of this.currentActions) action.stop();
    this.currentActions.length = 0;
    for (const mixer of this.mixers) mixer.stopAllAction();
    this.mixers.length = 0;
    this.clips.clear();
    this.currentClipName = '';
    this.preset = null;
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]!);
  }
}
