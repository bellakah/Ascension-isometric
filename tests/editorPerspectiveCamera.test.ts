import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorPerspectiveCamera } from '../src/camera/EditorPerspectiveCamera';
import {
  OPEN_WORLD_DEFAULT_DISTANCE,
  OPEN_WORLD_DEFAULT_PITCH,
  OPEN_WORLD_DEFAULT_YAW,
  OPEN_WORLD_FOV,
} from '../src/camera/openWorldCameraMath';

describe('EditorPerspectiveCamera', () => {
  it('starts with the exact gameplay perspective defaults', () => {
    const camera = new EditorPerspectiveCamera();
    expect(camera.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(camera.camera.fov).toBe(OPEN_WORLD_FOV);
    expect(camera.yaw).toBe(OPEN_WORLD_DEFAULT_YAW);
    expect(camera.pitch).toBe(OPEN_WORLD_DEFAULT_PITCH);
    expect(camera.distance).toBe(OPEN_WORLD_DEFAULT_DISTANCE);
  });

  it('orbits, pans and can return to the gameplay composition', () => {
    const camera = new EditorPerspectiveCamera();
    camera.resize(1600, 900);
    const initialPosition = camera.camera.position.clone();
    camera.orbitScreen(80, -30);
    expect(camera.camera.position.distanceTo(initialPosition)).toBeGreaterThan(0.1);

    const initialTarget = camera.target.clone();
    camera.panScreen(100, 40);
    expect(camera.target.distanceTo(initialTarget)).toBeGreaterThan(0.01);

    camera.zoomByWheel(1);
    expect(camera.distance).toBeGreaterThan(OPEN_WORLD_DEFAULT_DISTANCE);
    camera.resetGameView();
    expect(camera.yaw).toBe(OPEN_WORLD_DEFAULT_YAW);
    expect(camera.pitch).toBe(OPEN_WORLD_DEFAULT_PITCH);
    expect(camera.distance).toBe(OPEN_WORLD_DEFAULT_DISTANCE);
  });
});
