import * as THREE from 'three';
import { normalizeMovementInput } from './movement';

export class PlayerController {
  private readonly pressed = new Set<string>();

  constructor(private readonly player: THREE.Object3D) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(delta: number): boolean {
    const x = (this.pressed.has('KeyD') ? 1 : 0) - (this.pressed.has('KeyA') ? 1 : 0);
    const z = (this.pressed.has('KeyS') ? 1 : 0) - (this.pressed.has('KeyW') ? 1 : 0);
    const move = normalizeMovementInput(x, z);
    if (move.x === 0 && move.z === 0) return false;

    const speed = 6;
    this.player.position.x += move.x * speed * delta;
    this.player.position.z += move.z * speed * delta;
    this.player.rotation.y = Math.atan2(move.x, move.z);
    return true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };
}
