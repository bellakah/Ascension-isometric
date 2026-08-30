import * as THREE from 'three';
import { CharacterActor } from '../character/CharacterActor';
import type { CharacterPreset } from '../character/CharacterPreset';

export class CharacterPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  private readonly actor = new CharacterActor();
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;
  private lastTime = performance.now();
  private dragging = false;
  private lastX = 0;
  private yaw = Math.PI;
  private distance = 4.2;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(0x101820);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x344050, 2.2);
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 5, 4); key.castShadow = true;
    const fill = new THREE.DirectionalLight(0x9fc7ff, 1.2); fill.position.set(-4, 2, -3);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.5, 48), new THREE.MeshStandardMaterial({ color: 0x27323d, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.scene.add(hemi, key, fill, ground, this.actor.root);
    this.camera.position.set(0, 1.5, 4.2); this.camera.lookAt(0, 1, 0);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas); this.resize();
    canvas.addEventListener('pointerdown', this.handlePointerDown); canvas.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp); canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.tick();
  }

  async show(preset: CharacterPreset): Promise<void> { await this.actor.build(preset); this.actor.root.rotation.y = this.yaw; }
  playClip(name: string): boolean { return this.actor.playClip(name, 0.15); }
  clear(): void { this.actor.dispose(); }
  dispose(): void {
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.actor.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown); this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp); this.canvas.removeEventListener('wheel', this.handleWheel); this.renderer.dispose();
  }
  private tick = (): void => { const now = performance.now(); const delta = Math.min((now - this.lastTime) / 1000, 0.05); this.lastTime = now; this.actor.update(delta); this.actor.root.rotation.y = this.yaw; this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.tick); };
  private resize(): void { const width = Math.max(1, this.canvas.clientWidth); const height = Math.max(1, this.canvas.clientHeight); this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  private syncCamera(): void { this.camera.position.set(0, 1.25, this.distance); this.camera.lookAt(0, 1.05, 0); }
  private handlePointerDown = (event: PointerEvent): void => { if (event.button !== 0) return; this.dragging = true; this.lastX = event.clientX; this.canvas.setPointerCapture(event.pointerId); };
  private handlePointerMove = (event: PointerEvent): void => { if (!this.dragging) return; const dx = event.clientX - this.lastX; this.lastX = event.clientX; this.yaw += dx * 0.012; };
  private handlePointerUp = (event: PointerEvent): void => { if (!this.dragging) return; this.dragging = false; if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); };
  private handleWheel = (event: WheelEvent): void => { event.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.0035, 2.5, 7); this.syncCamera(); };
}
