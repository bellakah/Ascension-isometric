import * as THREE from 'three';
import { IsometricCamera } from '../camera/IsometricCamera';

export interface EngineFrame {
  delta: number;
  elapsed: number;
}

export interface EngineCamera {
  readonly camera: THREE.Camera;
  resize(width: number, height: number): void;
}

export type FrameHandler = (frame: EngineFrame) => void;

export class Engine<TCamera extends EngineCamera = IsometricCamera> {
  readonly scene = new THREE.Scene();
  readonly camera: TCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly clock = new THREE.Clock();
  private frameHandler: FrameHandler | null = null;
  private animationFrame = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(readonly canvas: HTMLCanvasElement, camera?: TCamera) {
    this.camera = camera ?? (new IsometricCamera() as unknown as TCamera);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x9fc2da);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  start(handler?: FrameHandler): void {
    this.frameHandler = handler ?? null;
    this.clock.start();
    const tick = (): void => {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;
      this.frameHandler?.({ delta, elapsed });
      this.renderer.render(this.scene, this.camera.camera);
      this.animationFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.resize(width, height);
  }
}
