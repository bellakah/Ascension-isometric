import * as THREE from 'three';
import { normalizeMovementInput } from './movement';

export interface PlayerMotionState { moved: boolean; sprinting: boolean; }

export class PlayerController {
  private readonly pressed = new Set<string>();
  constructor(private readonly player: THREE.Object3D) { window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); }
  update(delta: number): PlayerMotionState {
    const x = (this.pressed.has('KeyD') ? 1 : 0) - (this.pressed.has('KeyA') ? 1 : 0);
    const z = (this.pressed.has('KeyS') ? 1 : 0) - (this.pressed.has('KeyW') ? 1 : 0);
    const move = normalizeMovementInput(x, z);
    const moved = move.x !== 0 || move.z !== 0;
    const sprinting = moved && (this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'));
    if (!moved) return { moved: false, sprinting: false };
    const speed = sprinting ? 8.5 : 5.2;
    this.player.position.x += move.x * speed * delta;
    this.player.position.z += move.z * speed * delta;
    this.player.rotation.y = Math.atan2(move.x, move.z);
    return { moved: true, sprinting };
  }
  dispose(): void { window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); }
  private readonly onKeyDown = (event: KeyboardEvent): void => { this.pressed.add(event.code); };
  private readonly onKeyUp = (event: KeyboardEvent): void => { this.pressed.delete(event.code); };
}
