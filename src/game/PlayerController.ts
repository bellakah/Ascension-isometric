import * as THREE from 'three';
import { normalizeMovementInput } from './movement';

export interface PlayerMotionState { moved: boolean; sprinting: boolean; }

export class PlayerController {
  private readonly pressed = new Set<string>();
  private attackQueued = false;
  private blockHeld = false;

  constructor(private readonly player: THREE.Object3D) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  update(delta: number, movementMultiplier = 1): PlayerMotionState {
    const x = (this.pressed.has('KeyD') ? 1 : 0) - (this.pressed.has('KeyA') ? 1 : 0);
    const z = (this.pressed.has('KeyS') ? 1 : 0) - (this.pressed.has('KeyW') ? 1 : 0);
    const move = normalizeMovementInput(x, z);
    const moved = move.x !== 0 || move.z !== 0;
    const sprinting = moved && (this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'));
    if (!moved) return { moved: false, sprinting: false };
    const speed = (sprinting ? 8.5 : 5.2) * Math.max(0, movementMultiplier);
    this.player.position.x += move.x * speed * delta;
    this.player.position.z += move.z * speed * delta;
    this.player.rotation.y = Math.atan2(move.x, move.z);
    return { moved: true, sprinting };
  }

  consumeAttackPressed(): boolean {
    const queued = this.attackQueued;
    this.attackQueued = false;
    return queued;
  }

  get isBlockHeld(): boolean { return this.blockHeld; }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
    if (event.code === 'KeyJ' && !event.repeat) this.attackQueued = true;
    if (event.code === 'KeyK') this.blockHeld = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
    if (event.code === 'KeyK') this.blockHeld = false;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.attackQueued = true;
    if (event.button === 2) this.blockHeld = true;
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) this.blockHeld = false;
  };

  private readonly onContextMenu = (event: MouseEvent): void => event.preventDefault();
}
