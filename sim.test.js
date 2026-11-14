import test from 'node:test';
import assert from 'node:assert/strict';
import { runMission, validate, telemetry } from './public/sim.js';

const good = { panels: 'p3', batteries: 'b3', comms: 'c3', instruments: ['imaging', 'spectro', 'mag'], fuel: 500, launcher: 'l2' };

test('a well-margined Mars design succeeds with a nominal event', () => {
  const r = runMission('mars', good, () => 0);
  assert.equal(r.success, true, JSON.stringify(r.problems));
  assert.ok(r.score >= 900);
});

test('weak comms and missing instruments are reported', () => {
  const { problems } = validate('mars', { ...good, comms: 'c1', instruments: [] });
  assert.ok(problems.some((p) => /Comms range/.test(p)));
  assert.ok(problems.some((p) => /Missing required instrument/.test(p)));
});

test('telemetry mass equals sum of parts and flare event can break thin power margin', () => {
  const t = telemetry('mars', good);
  assert.equal(t.wetMass, t.dryMass + 500);
  const thin = { ...good, panels: 'p3', instruments: ['imaging', 'spectro', 'mag', 'radar', 'sample'], comms: 'c4' };
  const r = runMission('mars', thin, () => 0.5);
  assert.ok(r.event.id === 'flare');
});
