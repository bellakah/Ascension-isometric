import { describe, expect, it } from 'vitest';
import { CombatStateMachine } from '../src/character/CombatStateMachine';

const durations = { attack1: 0.6, attack2: 0.7, attack3: 0.8 };

describe('CombatStateMachine', () => {
  it('starts a combo from locomotion and chains queued attacks', () => {
    const machine = new CombatStateMachine();
    let frame = machine.update(0.016, { attackPressed: true, blockHeld: false, moved: false, sprinting: false }, durations);
    expect(frame.state).toBe('attack-1');
    expect(frame.movementMultiplier).toBeLessThan(0.2);

    machine.update(0.1, { attackPressed: true, blockHeld: false, moved: false, sprinting: false }, durations);
    machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    frame = machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    expect(frame.state).toBe('attack-2');
  });

  it('enters recover and returns to locomotion after an attack', () => {
    const machine = new CombatStateMachine();
    machine.update(0.01, { attackPressed: true, blockHeld: false, moved: false, sprinting: false }, durations);
    for (let index = 0; index < 8; index += 1) machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    expect(machine.state === 'recover' || machine.state === 'locomotion').toBe(true);
    machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    machine.update(0.1, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    expect(machine.state).toBe('locomotion');
  });

  it('blocks from locomotion and releases cleanly', () => {
    const machine = new CombatStateMachine();
    machine.update(0.016, { attackPressed: false, blockHeld: true, moved: false, sprinting: false }, durations);
    expect(machine.state).toBe('block');
    expect(machine.movementMultiplier).toBe(0.35);
    machine.update(0.016, { attackPressed: false, blockHeld: false, moved: false, sprinting: false }, durations);
    expect(machine.state).toBe('locomotion');
  });
});
