import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { assetFileAliases, normalizeArchivePath, normalizedFileKey } from './assetUtils';
import type { AssetRecord } from './types';

export interface LoadedAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

function prepareObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export async function loadStoredAsset(asset: AssetRecord): Promise<LoadedAsset> {
  const manager = new THREE.LoadingManager();
  const objectUrls = new Map<string, string>();

  for (const file of asset.files) {
    const objectUrl = URL.createObjectURL(file.blob);
    for (const alias of assetFileAliases(file.name)) objectUrls.set(alias, objectUrl);
    objectUrls.set(normalizeArchivePath(file.relativePath).toLowerCase(), objectUrl);
  }

  manager.setURLModifier((url) => {
    const cleanUrl = decodeURIComponent(url.split('?')[0] ?? url).replace(/^blob:[^/]+\//, '');
    const archiveKey = normalizeArchivePath(cleanUrl).toLowerCase();
    return objectUrls.get(archiveKey) ?? objectUrls.get(normalizedFileKey(cleanUrl)) ?? url;
  });

  const entry = asset.files.find((file) =>
    file.name === asset.entryFile ||
    file.relativePath === asset.entryFile ||
    normalizeArchivePath(file.relativePath) === normalizeArchivePath(asset.entryFile),
  );
  if (!entry) throw new Error(`Arquivo principal ${asset.entryFile} não encontrado.`);

  try {
    if (asset.format === 'fbx') {
      const loader = new FBXLoader(manager);
      const group = loader.parse(await entry.blob.arrayBuffer(), '');
      prepareObject(group);
      return { scene: group, animations: group.animations ?? [] };
    }

    const loader = new GLTFLoader(manager);
    const payload = asset.format === 'glb' ? await entry.blob.arrayBuffer() : await entry.blob.text();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(payload, '', resolve, reject);
    });
    prepareObject(gltf.scene);
    return { scene: gltf.scene, animations: gltf.animations };
  } finally {
    for (const url of new Set(objectUrls.values())) URL.revokeObjectURL(url);
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
