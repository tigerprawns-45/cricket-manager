// Match rules for the U11s: pure functions, no DOM, no storage.

export const OVERS = 20;
export const BLOCK = 10;
const BALLS_IN_INNINGS = OVERS * 6;

// Matches the club table: 5→24, 6→20, 7→17, 8→15, 9→13.
export function ballsPerBatter(available) {
  return available > 0 ? Math.floor(BALLS_IN_INNINGS / available) : 0;
}

export function battingOrder(order, unavailable) {
  const out = new Set(unavailable);
  const batters = order.filter((id) => !out.has(id));
  const balls = ballsPerBatter(batters.length);
  return batters.map((id, i) => ({ position: i + 1, id, balls }));
}

// Goes round the bowling list, skipping unavailable players and the keeper for
// that 10-over block. Block 2 carries on from whoever bowled the last over of block 1.
// Each block's ring is the cycle its bowlers rotate through; fielding follows it.
export function bowlingPlan(order, unavailable, keepers) {
  const out = new Set(unavailable);
  const overs = [];
  const blocks = [];
  let last = -1;

  for (let b = 0; b < OVERS / BLOCK; b++) {
    const keeper = keepers[b];
    const eligible = (id) => !out.has(id) && id !== keeper;
    const ring = [];
    let p = last;
    for (let n = 0; n < order.length; n++) {
      p = (p + 1) % order.length;
      if (eligible(order[p])) ring.push(order[p]);
    }
    blocks.push({ keeper, ring, firstOver: b * BLOCK + 1 });
    if (ring.length === 0) continue;

    for (let i = 0; i < BLOCK; i++) {
      const bowler = ring[i % ring.length];
      overs.push({ over: b * BLOCK + i + 1, block: b, bowler });
      last = order.indexOf(bowler);
    }
  }
  return { overs, blocks };
}

// Spot 0 is the bowler; spots 1..k-1 run anticlockwise round the field from the
// bowler's end, skipping the keeper. After each over everyone steps one spot
// towards the bowler, so the next bowler in the ring is always the one bowling.
export function fieldForOver(plan, over) {
  const o = plan.overs[over - 1];
  if (!o) return null;
  const { ring, keeper } = plan.blocks[o.block];
  const shift = over - plan.blocks[o.block].firstOver;
  const spots = ring.map((_, s) => ring[(s + shift) % ring.length]);
  return { keeper, spots };
}

// Over numbers each player bowls within a block, for labelling the field diagram.
export function oversByPlayer(plan, block) {
  const map = {};
  for (const o of plan.overs) {
    if (o.block === block) (map[o.bowler] ||= []).push(o.over);
  }
  return map;
}

export function bowlingCounts(plan) {
  const counts = {};
  for (const o of plan.overs) counts[o.bowler] = (counts[o.bowler] || 0) + 1;
  return counts;
}

// Problems that stop the plan making sense, in plain words for the coach.
export function planProblems(order, unavailable, keepers, nameOf = (id) => id) {
  const out = new Set(unavailable);
  const problems = [];
  keepers.forEach((k, b) => {
    const label = `Keeper for overs ${b * BLOCK + 1}–${(b + 1) * BLOCK}`;
    if (!k) problems.push(`${label} isn't picked.`);
    else if (out.has(k)) problems.push(`${label} (${nameOf(k)}) is unavailable.`);
  });
  if (order.filter((id) => !out.has(id)).length < 3) {
    problems.push('Fewer than 3 players available.');
  }
  return problems;
}
