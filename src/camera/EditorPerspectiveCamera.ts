import * as THREE from 'three';
import {
  OPEN_WORLD_DEFAULT_DISTANCE,
  OPEN_WORLD_DEFAULT_PITCH,
  OPEN_WORLD_DEFAULT_YAW,
  OPEN_WORLD_FOV,
  clampOpenWorldDistance,
  clampOpenWorldPitch,
  orbitPosition,
} from './openWorldCameraMath';

const LOOK_SENSITIVITY = 0.0045;
const MIN_EDITOR_DISTANCE = 3;
const MAX_EDITOR_DISTANCE = 120;

/**
 * Perspective camera used by the World Editor.
 *
 * Its default composition intentionally matches the gameplay camera: same
 * PerspectiveCamera FOV, yaw, pitch and distance. Unlike OpenWorldCamera it
 * orbits an editor target instead of following a character spring arm.
 */
export class EditorPerspectiveCamera {
  readonly camera = new THREE.PerspectiveCamera(OPEN_WORLD_FOV, 1, 0.1, 2000);
  readonly target = new THREE.Vector3();

  yaw = OPEN_WORLD_DEFAULT_YAW;
  pitch = OPEN_WORLD_DEFAULT_PITCH;
  distance = OPEN_WORLD_DEFAULT_DISTANCE;

  private width = 1;
  private height = 1;

  constructor() {
    this.camera.up.set(0, 1, 0);
    this.syncPose();
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.syncPose();
  }

  /** Restore the exact baseline composition used by gameplay. */
  resetGameView(): void {
    this.yaw = OPEN_WORLD_DEFAULT_YAW;
    this.pitch = OPEN_WORLD_DEFAULT_PITCH;
    this.distance = OPEN_WORLD_DEFAULT_DISTANCE;
    this.syncPose();
  }

  orbitScreen(dx: number, dy: number): void {
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = clampOpenWorldPitch(this.pitch + dy * LOOK_SENSITIVITY);
    this.syncPose();
  }

  zoomByWheel(deltaY: number): void {
    // Use the same wheel cadence as gameplay while allowing an extended editor
    // overview range. Pressing Game Cam always restores the exact game distance.
    const next = this.distance + Math.sign(deltaY) * 1.4;
    this.distance = THREE.MathUtils.clamp(next, MIN_EDITOR_DISTANCE, MAX_EDITOR_DISTANCE);
    this.syncPose();
  }

  rotateQuarter(turns: number): void {
    this.yaw += turns * (Math.PI / 2);
    this.syncPose();
  }

  panScreen(dx: number, dy: number): void {
    const visibleHeight = 2 * Math.max(0.01, this.distance) * Math.tan(THREE.MathUtils.degToRad(OPEN_WORLD_FOV) / 2);
    const worldPerPixel = visibleHeight / this.height;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * worldPerPixel);
    this.target.addScaledVector(forward, dy * worldPerPixel);
    this.syncPose();
  }

  /** Set a game-valid distance programmatically (used by tests/tools). */
  setGameplayDistance(distance: number): void {
    this.distance = clampOpenWorldDistance(distance);
    this.syncPose();
  }

  private syncPose(): void {
    const orbit = orbitPosition(this.target.x, this.target.y, this.target.z, this.yaw, this.pitch, this.distance);
    this.camera.position.set(orbit.x, orbit.y, orbit.z);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
