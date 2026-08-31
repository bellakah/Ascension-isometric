import * as THREE from 'three';
import {
  OPEN_WORLD_DEFAULT_DISTANCE,
  OPEN_WORLD_DEFAULT_PITCH,
  OPEN_WORLD_DEFAULT_YAW,
  OPEN_WORLD_FOV,
  clampOpenWorldDistance,
  clampOpenWorldPitch,
  createChasePivot,
  orbitPosition,
  stepChasePivot,
} from './openWorldCameraMath';

export type TerrainHeightResolver = (x: number, z: number) => number;

const LOOK_SENSITIVITY = 0.0045;
const EYE_HEIGHT = 1.8;
const CAMERA_GROUND_CLEARANCE = 0.65;
const LEAD_TIME = 0.13;
const LEAD_MAX = 1;
const LEAD_EASE = 4;

export function isOpenWorldOrbitGesture(button: number, altKey: boolean): boolean {
  return button === 2 || button === 1 || (button === 0 && altKey);
}

export class OpenWorldCamera {
  readonly camera = new THREE.PerspectiveCamera(OPEN_WORLD_FOV, 1, 0.1, 1000);

  yaw = OPEN_WORLD_DEFAULT_YAW;
  pitch = OPEN_WORLD_DEFAULT_PITCH;
  distance = OPEN_WORLD_DEFAULT_DISTANCE;

  private readonly pivot = createChasePivot();
  private readonly lookAt = new THREE.Vector3();
  private terrainHeight: TerrainHeightResolver | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private dragging = false;
  private dragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private previousTargetX = 0;
  private previousTargetZ = 0;
  private targetInitialized = false;
  private leadX = 0;
  private leadZ = 0;

  constructor() {
    this.camera.up.set(0, 1, 0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  connect(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.disconnect();
    this.canvas = canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Capture at document level so the native browser menu cannot escape when
    // the pointer is over a transparent HUD/overlay above the WebGL canvas.
    document.addEventListener('contextmenu', this.onContextMenu, true);

    // Pointer capture normally keeps delivering drag events to the canvas, but
    // listening on window as well makes orbit reliable across overlays and when
    // the cursor crosses the viewport boundary during a fast drag.
    window.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);
    window.addEventListener('pointercancel', this.onPointerUp, true);
    window.addEventListener('blur', this.onWindowBlur);
  }

  disconnect(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('contextmenu', this.onContextMenu, true);
    window.removeEventListener('pointermove', this.onPointerMove, true);
    window.removeEventListener('pointerup', this.onPointerUp, true);
    window.removeEventListener('pointercancel', this.onPointerUp, true);
    window.removeEventListener('blur', this.onWindowBlur);
    this.endDrag();
    this.canvas = null;
  }

  setTerrainHeightResolver(resolver: TerrainHeightResolver | null): void {
    this.terrainHeight = resolver;
  }

  update(target: THREE.Vector3, delta: number): void {
    stepChasePivot(this.pivot, target.x, target.y, target.z, delta);
    this.updateLead(target, delta);

    const pivotX = this.pivot.x + this.leadX;
    const pivotZ = this.pivot.z + this.leadZ;
    const eyeY = this.pivot.y + EYE_HEIGHT;
    const orbit = orbitPosition(pivotX, eyeY, pivotZ, this.yaw, this.pitch, this.distance);
    const minimumCameraY = this.terrainHeight ? this.terrainHeight(orbit.x, orbit.z) + CAMERA_GROUND_CLEARANCE : -Infinity;

    this.camera.position.set(orbit.x, Math.max(orbit.y, minimumCameraY), orbit.z);
    this.lookAt.set(pivotX, eyeY, pivotZ);
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();
  }

  zoomBy(delta: number): void {
    this.distance = clampOpenWorldDistance(this.distance + delta);
  }

  rotateBy(yawDelta: number, pitchDelta = 0): void {
    this.yaw -= yawDelta;
    this.pitch = clampOpenWorldPitch(this.pitch + pitchDelta);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  dispose(): void {
    this.disconnect();
  }

  private updateLead(target: THREE.Vector3, delta: number): void {
    const dt = Math.min(0.25, Math.max(0, delta));
    if (!this.targetInitialized || dt <= 0) {
      this.previousTargetX = target.x;
      this.previousTargetZ = target.z;
      this.targetInitialized = true;
      return;
    }

    const dx = target.x - this.previousTargetX;
    const dz = target.z - this.previousTargetZ;
    this.previousTargetX = target.x;
    this.previousTargetZ = target.z;
    if (Math.hypot(dx, dz) > 6) { this.leadX = 0; this.leadZ = 0; return; }

    const vx = dx / Math.max(1e-4, dt);
    const vz = dz / Math.max(1e-4, dt);
    const speed = Math.hypot(vx, vz);
    const leadDistance = Math.min(LEAD_MAX, speed * LEAD_TIME);
    const targetLeadX = speed > 0.05 ? vx / speed * leadDistance : 0;
    const targetLeadZ = speed > 0.05 ? vz / speed * leadDistance : 0;
    const ease = 1 - Math.exp(-LEAD_EASE * dt);
    this.leadX += (targetLeadX - this.leadX) * ease;
    this.leadZ += (targetLeadZ - this.leadZ) * ease;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!isOpenWorldOrbitGesture(event.button, event.altKey) || !this.canvas) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
    this.dragPointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Window-level drag listeners below remain a reliable fallback.
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();
    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = clampOpenWorldPitch(this.pitch + dy * LOOK_SENSITIVITY);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    this.endDrag(event.pointerId);
  };

  private readonly onWindowBlur = (): void => this.endDrag();

  private endDrag(pointerId: number | null = this.dragPointerId): void {
    if (this.canvas && pointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      this.canvas.style.cursor = '';
    }
    this.dragging = false;
    this.dragPointerId = null;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoomBy(Math.sign(event.deltaY) * 1.4);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
}
