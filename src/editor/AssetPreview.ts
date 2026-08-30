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
  private yaw = Math.PI / 4;
  private pitch = 0.38;
  private distance = 5.2;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private idleTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x121820);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2e3945, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 3.2);
    light.position.set(4, 6, 5);
    this.scene.add(light);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.updateCamera();
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

    this.yaw = Math.PI / 4;
    this.pitch = 0.38;
    this.distance = 5.2;
    this.idleTime = 0;
    this.updateCamera();

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
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.renderer.dispose();
  }

  private tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.mixer?.update(delta);
    if (!this.dragging && this.model) {
      this.idleTime += delta;
      if (this.idleTime > 2.5) {
        this.yaw += delta * 0.12;
        this.updateCamera();
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private updateCamera(): void {
    const target = new THREE.Vector3(0, 1.05, 0);
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      Math.sin(this.yaw) * horizontal,
      target.y + Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(target);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.dragging = true;
    this.idleTime = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.yaw -= dx * 0.008;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.006, -0.15, 1.15);
    this.updateCamera();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.idleTime = 0;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.idleTime = 0;
    this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(event.deltaY * 0.001), 2.6, 9.5);
    this.updateCamera();
  };

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
