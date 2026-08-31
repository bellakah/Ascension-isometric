import * as THREE from 'three';
import { resolveHorizontalMove } from '../world/WorldCollision';
import type { WorldDocument } from '../world/WorldDocument';
import { cameraRelativeMovement } from './movement';

export interface PlayerMotionState { moved: boolean; sprinting: boolean; }
export interface PlayerNavigation { document: WorldDocument; heightAt(x: number, z: number): number; playerRadius?: number; }

export class PlayerController {
  private readonly pressed = new Set<string>();
  private attackQueued = false;
  private blockHeld = false;

  constructor(private readonly player: THREE.Object3D, private readonly navigation?: PlayerNavigation) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('contextmenu', this.onContextMenu, true);
  }

  update(delta: number, movementMultiplier = 1, cameraYaw = Math.PI): PlayerMotionState {
    const strafe = (this.pressed.has('KeyD') ? 1 : 0) - (this.pressed.has('KeyA') ? 1 : 0);
    const forward = (this.pressed.has('KeyW') ? 1 : 0) - (this.pressed.has('KeyS') ? 1 : 0);
    const move = cameraRelativeMovement(strafe, forward, cameraYaw); const wantsMove = move.x !== 0 || move.z !== 0;
    const sprinting = wantsMove && (this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'));
    if (!wantsMove) { if (this.navigation) this.player.position.y = this.navigation.heightAt(this.player.position.x, this.player.position.z); return { moved: false, sprinting: false }; }
    const speed = (sprinting ? 8.5 : 5.2) * Math.max(0, movementMultiplier);
    const fromX = this.player.position.x; const fromZ = this.player.position.z;
    const targetX = fromX + move.x * speed * delta; const targetZ = fromZ + move.z * speed * delta;
    const resolved = this.navigation ? resolveHorizontalMove(this.navigation.document, fromX, fromZ, targetX, targetZ, this.navigation.playerRadius ?? 0.45) : { x: targetX, z: targetZ };
    this.player.position.x = resolved.x; this.player.position.z = resolved.z;
    if (this.navigation) this.player.position.y = this.navigation.heightAt(resolved.x, resolved.z);
    const moved = Math.abs(resolved.x - fromX) > 1e-5 || Math.abs(resolved.z - fromZ) > 1e-5;
    if (moved) this.player.rotation.y = Math.atan2(move.x, move.z);
    return { moved, sprinting: moved && sprinting };
  }

  consumeAttackPressed(): boolean { const queued = this.attackQueued; this.attackQueued = false; return queued; }
  get isBlockHeld(): boolean { return this.blockHeld; }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('contextmenu', this.onContextMenu, true);
    this.resetInputState();
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
    if (event.button === 0 && !event.altKey) this.attackQueued = true;
  };

  private readonly onWindowBlur = (): void => this.resetInputState();

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') this.resetInputState();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    this.resetInputState();
  };

  private resetInputState(): void {
    this.pressed.clear();
    this.blockHeld = false;
    this.attackQueued = false;
  }
}
