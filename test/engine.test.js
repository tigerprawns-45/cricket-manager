import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ballsPerBatter, battingOrder, bowlingPlan, fieldForOver, oversByPlayer, bowlingCounts, planProblems, whatsappMessage,
} from '../src/engine.js';

const bowling = ['Hugh', 'Arlo', 'Oscar', 'Josh', 'Nick', 'Lachie', 'Sean', 'Marco'];
const batting = ['Hugh', 'Josh', 'Oscar', 'Marco', 'Arlo', 'Sean', 'Lachie', 'Nick'];

test('balls per batter matches the club table', () => {
  assert.deepEqual([5, 6, 7, 8, 9].map(ballsPerBatter), [24, 20, 17, 15, 13]);
});

test('batting order closes up around unavailable players', () => {
  const order = battingOrder(batting, ['Oscar']);
  assert.deepEqual(order.map((b) => b.id), ['Hugh', 'Josh', 'Marco', 'Arlo', 'Sean', 'Lachie', 'Nick']);
  assert.ok(order.every((b) => b.balls === 17));
  assert.equal(order[2].position, 3);
});

test('full squad reproduces the 2026/27 season sheet', () => {
  const plan = bowlingPlan(bowling, [], ['Josh', 'Hugh']);
  assert.deepEqual(plan.overs.map((o) => o.bowler), [
    'Hugh', 'Arlo', 'Oscar', 'Nick', 'Lachie', 'Sean', 'Marco', 'Hugh', 'Arlo', 'Oscar',
    'Josh', 'Nick', 'Lachie', 'Sean', 'Marco', 'Arlo', 'Oscar', 'Josh', 'Nick', 'Lachie',
  ]);
  assert.deepEqual(oversByPlayer(plan, 0).Hugh, [1, 8]);
  assert.deepEqual(oversByPlayer(plan, 1).Josh, [11, 18]);
  assert.equal(oversByPlayer(plan, 1).Hugh, undefined);
});

test('each keeper opens the bowling in the block they are not keeping', () => {
  const plan = bowlingPlan(bowling, [], ['Hugh', 'Lachie']);
  assert.equal(plan.overs[0].bowler, 'Lachie');
  assert.equal(plan.overs[10].bowler, 'Hugh');
  assert.equal(bowlingCounts(plan).Lachie, 2);
  assert.equal(bowlingCounts(plan).Hugh, 2);
});

test('keeper never bowls in their block', () => {
  const plan = bowlingPlan(bowling, [], ['Sean', 'Sean']);
  assert.ok(plan.overs.every((o) => o.bowler !== 'Sean'));
});

test('unavailable players are skipped and the list keeps going round', () => {
  const plan = bowlingPlan(bowling, ['Arlo', 'Marco'], ['Josh', 'Hugh']);
  assert.equal(plan.overs.length, 20);
  assert.ok(plan.overs.every((o) => o.bowler !== 'Arlo' && o.bowler !== 'Marco'));
  assert.deepEqual(plan.overs.slice(0, 6).map((o) => o.bowler), ['Hugh', 'Oscar', 'Nick', 'Lachie', 'Sean', 'Hugh']);
  // Block 1 ends on Sean (over 10); block 2 opens with Josh, then carries on past Marco (out) and Hugh (keeping).
  assert.equal(plan.overs[9].bowler, 'Sean');
  assert.deepEqual(plan.overs.slice(10, 12).map((o) => o.bowler), ['Josh', 'Oscar']);
  assert.deepEqual(bowlingCounts(plan), { Hugh: 2, Oscar: 4, Nick: 4, Lachie: 4, Sean: 4, Josh: 2 });
});

test('field rotates one spot per over and the bowler is always at spot 0', () => {
  const plan = bowlingPlan(bowling, [], ['Josh', 'Hugh']);
  for (const o of plan.overs) {
    const field = fieldForOver(plan, o.over);
    assert.equal(field.spots[0], o.bowler);
    assert.ok(!field.spots.includes(field.keeper));
  }
  // Arlo starts next to the bowler, so moves to the bowling spot for over 2.
  assert.equal(fieldForOver(plan, 1).spots[1], 'Arlo');
  assert.equal(fieldForOver(plan, 2).spots[0], 'Arlo');
  assert.equal(fieldForOver(plan, 2).spots.at(-1), 'Hugh');
  assert.equal(fieldForOver(plan, 11).keeper, 'Hugh');
});

test('WhatsApp message has captain, lollies, keepers and who is out', () => {
  const plan = bowlingPlan(bowling, ['Arlo'], ['Hugh', 'Lachie']);
  const msg = whatsappMessage({
    team: 'HOWZATS U11s', dateLabel: 'Sat 31 Oct', captain: 'Hugh', lollies: 'Hugh', out: ['Arlo'], plan, nameOf: (x) => x,
  });
  assert.equal(msg, [
    '🏏 *HOWZATS U11s – Sat 31 Oct*', '',
    '👑 Captain: Hugh', '🍬 Lollies: Hugh', '🧤 Keepers: Hugh (overs 1–10), Lachie (overs 11–20)',
    '🚫 Out this week: Arlo',
  ].join('\n'));
});

test('problems flag a missing or unavailable keeper', () => {
  assert.deepEqual(planProblems(bowling, [], ['Josh', 'Hugh']), []);
  assert.deepEqual(planProblems(bowling, ['Hugh'], ['Josh', '']), [
    "Keeper for overs 11–20 isn't picked.",
  ]);
  assert.match(planProblems(bowling, ['Josh'], ['Josh', 'Hugh'])[0], /unavailable/);
});
