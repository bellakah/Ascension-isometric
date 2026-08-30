import * as THREE from 'three';
import { cloneAssetScene, fitObjectToUnit } from './AssetLoader';

export function renderAssetThumbnail(source: THREE.Object3D, width = 280, height = 180): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171d25);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x36414d, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(4, 7, 5);
  scene.add(key);

  const model = cloneAssetScene(source);
  fitObjectToUnit(model, 2.4);
  scene.add(model);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x222b36, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.01, 100);
  camera.position.set(3.4, 2.7, 4.2);
  camera.lookAt(0, 0.9, 0);

  renderer.render(scene, camera);
  const thumbnail = canvas.toDataURL('image/webp', 0.82);
  renderer.dispose();
  floor.geometry.dispose();
  (floor.material as THREE.Material).dispose();
  return thumbnail;
}
