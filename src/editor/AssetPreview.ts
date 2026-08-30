import * as THREE from 'three';
import { loadStoredAsset, cloneAssetScene, fitObjectToUnit } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';

export class AssetPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private frame = 0;
  private loadToken = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x121820);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2e3945, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 3.2);
    light.position.set(4, 6, 5);
    this.scene.add(light);
    this.camera.position.set(3.2, 2.6, 4.2);
    this.camera.lookAt(0, 0.9, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.tick();
  }

  async show(asset: AssetRecord): Promise<void> {
    const token = ++this.loadToken;
    const loaded = await loadStoredAsset(asset);
    if (token !== this.loadToken) return;

    if (this.model) this.scene.remove(this.model);
    this.mixer = null;

    const model = cloneAssetScene(loaded.scene);
    fitObjectToUnit(model, 2.5);
    this.model = model;
    this.scene.add(model);

    if (loaded.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.clipAction(loaded.animations[0]!).play();
    }
  }

  clear(): void {
    ++this.loadToken;
    if (this.model) this.scene.remove(this.model);
    this.model = null;
    this.mixer = null;
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  private tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.mixer?.update(delta);
    if (this.model) this.model.rotation.y += delta * 0.28;
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
