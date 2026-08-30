export type CombatState = 'locomotion' | 'attack-1' | 'attack-2' | 'attack-3' | 'recover' | 'block';

export interface CombatFrameInput {
  attackPressed: boolean;
  blockHeld: boolean;
  moved: boolean;
  sprinting: boolean;
}

export interface CombatAttackDurations {
  attack1: number;
  attack2: number;
  attack3: number;
}

export interface CombatFrameResult {
  state: CombatState;
  changed: boolean;
  previous: CombatState;
  attackIndex: 0 | 1 | 2 | 3;
  movementMultiplier: number;
}

const RECOVER_SECONDS = 0.12;
const FALLBACK_ATTACK_SECONDS = 0.68;

function attackIndex(state: CombatState): 0 | 1 | 2 | 3 {
  if (state === 'attack-1') return 1;
  if (state === 'attack-2') return 2;
  if (state === 'attack-3') return 3;
  return 0;
}

function durationFor(index: 1 | 2 | 3, durations: CombatAttackDurations): number {
  const value = index === 1 ? durations.attack1 : index === 2 ? durations.attack2 : durations.attack3;
  return Number.isFinite(value) && value > 0.05 ? value : FALLBACK_ATTACK_SECONDS;
}

export class CombatStateMachine {
  private currentState: CombatState = 'locomotion';
  private elapsed = 0;
  private queuedCombo = false;

  get state(): CombatState { return this.currentState; }

  get movementMultiplier(): number {
    if (this.currentState === 'locomotion') return 1;
    if (this.currentState === 'block') return 0.35;
    if (this.currentState === 'recover') return 0.55;
    return 0.16;
  }

  reset(): void {
    this.currentState = 'locomotion';
    this.elapsed = 0;
    this.queuedCombo = false;
  }

  update(delta: number, input: CombatFrameInput, durations: CombatAttackDurations): CombatFrameResult {
    const previous = this.currentState;
    const step = Math.max(0, Math.min(delta, 0.1));

    if (this.currentState === 'locomotion') {
      if (input.blockHeld) this.enter('block');
      else if (input.attackPressed) this.enterAttack(1);
    } else if (this.currentState === 'block') {
      if (!input.blockHeld) this.enter('locomotion');
    } else if (this.currentState === 'recover') {
      this.elapsed += step;
      if (input.blockHeld) this.enter('block');
      else if (input.attackPressed) this.enterAttack(1);
      else if (this.elapsed >= RECOVER_SECONDS) this.enter('locomotion');
    } else {
      const index = attackIndex(this.currentState);
      if (index === 0) this.enter('locomotion');
      else {
        const duration = durationFor(index, durations);
        this.elapsed += step;
        if (input.attackPressed && index < 3) this.queuedCombo = true;
        const chainAt = Math.max(0.12, duration * 0.62);
        if (this.queuedCombo && index < 3 && this.elapsed >= chainAt) this.enterAttack((index + 1) as 1 | 2 | 3);
        else if (this.elapsed >= duration) this.enter('recover');
      }
    }

    return {
      state: this.currentState,
      changed: previous !== this.currentState,
      previous,
      attackIndex: attackIndex(this.currentState),
      movementMultiplier: this.movementMultiplier,
    };
  }

  private enter(state: CombatState): void {
    this.currentState = state;
    this.elapsed = 0;
    this.queuedCombo = false;
  }

  private enterAttack(index: 1 | 2 | 3): void {
    this.enter(index === 1 ? 'attack-1' : index === 2 ? 'attack-2' : 'attack-3');
  }
}
