import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { normalizedFileKey } from './assetUtils';
import type { AssetRecord } from './types';

export interface LoadedAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export async function loadStoredAsset(asset: AssetRecord): Promise<LoadedAsset> {
  const manager = new THREE.LoadingManager();
  const objectUrls = new Map<string, string>();

  for (const file of asset.files) {
    const objectUrl = URL.createObjectURL(file.blob);
    objectUrls.set(normalizedFileKey(file.name), objectUrl);
    objectUrls.set(normalizedFileKey(file.relativePath), objectUrl);
  }

  manager.setURLModifier((url) => {
    const cleanUrl = decodeURIComponent(url.split('?')[0] ?? url);
    return objectUrls.get(normalizedFileKey(cleanUrl)) ?? url;
  });

  const loader = new GLTFLoader(manager);
  const entry = asset.files.find((file) => file.name === asset.entryFile || file.relativePath === asset.entryFile);
  if (!entry) throw new Error(`Arquivo principal ${asset.entryFile} não encontrado.`);

  try {
    const payload = asset.format === 'glb' ? await entry.blob.arrayBuffer() : await entry.blob.text();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(payload, '', resolve, reject);
    });
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return { scene: gltf.scene, animations: gltf.animations };
  } finally {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  }
}

export function cloneAssetScene(scene: THREE.Object3D): THREE.Object3D {
  return cloneSkeleton(scene);
}

export function fitObjectToUnit(object: THREE.Object3D, targetSize = 2): void {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / maxAxis;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(object);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= normalizedBounds.min.y;
}
