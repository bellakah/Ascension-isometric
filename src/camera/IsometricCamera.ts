import * as THREE from 'three';
import { calculateOrthographicFrustum, ISOMETRIC_ELEVATION_RADIANS } from './isometricMath';

const MIN_VIEW_HEIGHT = 8;
const MAX_VIEW_HEIGHT = 80;

export class IsometricCamera {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3();

  private azimuth = Math.PI / 4;
  private readonly elevation = ISOMETRIC_ELEVATION_RADIANS;
  private distance = 35;
  private viewHeight = 26;
  private width = 1;
  private height = 1;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    this.camera.up.set(0, 1, 0);
    this.syncPose();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.syncProjection();
  }

  setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.syncPose();
  }

  zoomByWheel(deltaY: number): void {
    const factor = Math.exp(deltaY * 0.001);
    this.viewHeight = THREE.MathUtils.clamp(this.viewHeight * factor, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT);
    this.syncProjection();
  }

  rotateQuarter(turns: number): void {
    this.azimuth += turns * (Math.PI / 2);
    this.syncPose();
  }

  panScreen(dx: number, dy: number): void {
    const worldPerPixel = this.viewHeight / Math.max(1, this.height);
    const forward = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
    const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
    this.target.addScaledVector(right, -dx * worldPerPixel);
    this.target.addScaledVector(forward, dy * worldPerPixel);
    this.syncPose();
  }

  private syncProjection(): void {
    const frustum = calculateOrthographicFrustum(this.width, this.height, this.viewHeight);
    this.camera.left = frustum.left;
    this.camera.right = frustum.right;
    this.camera.top = frustum.top;
    this.camera.bottom = frustum.bottom;
    this.camera.updateProjectionMatrix();
  }

  private syncPose(): void {
    const horizontalDistance = Math.cos(this.elevation) * this.distance;
    const y = Math.sin(this.elevation) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * horizontalDistance,
      this.target.y + y,
      this.target.z + Math.cos(this.azimuth) * horizontalDistance,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
