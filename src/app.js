import {
  OVERS, BLOCK, battingOrder, bowlingPlan, fieldForOver, oversByPlayer, bowlingCounts, planProblems,
} from './engine.js';
import { load, save, defaultState, newPlayerId, matchFor, shareUrl, readShare } from './store.js';

const shared = readShare(location.hash);
const readOnly = !!shared;
let state = shared || load();
let tab = 'match';
let date = shared ? shared.sharedDate : defaultDate();
let over = 1;

const main = document.querySelector('main');
const tabs = document.querySelector('nav');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
function nameOf(pid) {
  return state.players.find((p) => p.id === pid)?.name || '—';
}

function sortedRoster() {
  return [...state.roster].sort((a, b) => a.date.localeCompare(b.date));
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultDate() {
  const rows = sortedRoster();
  return (rows.find((r) => r.date >= today()) || rows.at(-1))?.date || today();
}

function prettyDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function options(ids, selected, blank = '—') {
  return [`<option value="">${blank}</option>`]
    .concat(ids.map((pid) => `<option value="${esc(pid)}"${pid === selected ? ' selected' : ''}>${esc(nameOf(pid))}</option>`))
    .join('');
}

function persist() {
  if (!readOnly) save(state);
  render();
}

function setMatch(change) {
  state.matches[date] = { ...matchFor(state, date), ...change };
  persist();
}

// ---------- Match day ----------

function matchView() {
  if (!state.roster.length && !readOnly) {
    return '<section class="card"><p>Add a game date on the Roster tab to plan a match.</p></section>';
  }
  const row = state.roster.find((r) => r.date === date) || {};
  const { unavailable, keepers } = matchFor(state, date);
  const out = new Set(unavailable);
  const available = state.players.filter((p) => !out.has(p.id)).map((p) => p.id);
  const batting = battingOrder(state.batting, unavailable);
  const problems = planProblems(state.bowling, unavailable, keepers, nameOf);
  const plan = problems.length ? null : bowlingPlan(state.bowling, unavailable, keepers);

  const dateControl = readOnly
    ? `<h2>${esc(prettyDate(date))}</h2>`
    : `<select data-action="date" aria-label="Game date">${sortedRoster()
      .map((r) => `<option value="${r.date}"${r.date === date ? ' selected' : ''}>${esc(prettyDate(r.date))}</option>`)
      .join('')}</select>`;

  const duties = `
    <dl class="duties">
      <div><dt>Captain</dt><dd>${esc(nameOf(row.captain))}</dd></div>
      <div><dt>Lollies</dt><dd>${esc(nameOf(row.lollies))}</dd></div>
      <div><dt>Friday training</dt><dd>${esc(row.training || '—')}</dd></div>
    </dl>`;

  const chips = state.players.map((p) => {
    const isOut = out.has(p.id);
    return `<button class="chip${isOut ? ' out' : ''}" data-action="toggle" data-id="${esc(p.id)}"
      aria-pressed="${!isOut}"${readOnly ? ' disabled' : ''}>${esc(p.name)}</button>`;
  }).join('');

  const keeperPickers = [0, 1].map((b) => `
    <label>Overs ${b * BLOCK + 1}–${(b + 1) * BLOCK}
      ${readOnly
        ? `<strong>${esc(nameOf(keepers[b]))}</strong>`
        : `<select data-action="keeper" data-block="${b}">${options(available, keepers[b], 'Pick keeper')}</select>`}
    </label>`).join('');

  const battingList = batting.length
    ? `<ol class="list">${batting.map((b) => `<li><span class="num">${b.position}</span>${esc(nameOf(b.id))}${b.id === row.captain ? ' <span class="tag">c</span>' : ''}<span class="right">${b.balls} balls</span></li>`).join('')}</ol>`
    : '<p class="muted">Nobody available.</p>';

  return `
    <section class="card">
      <div class="row">${dateControl}
        <button class="primary" data-action="share">${readOnly ? 'Open app' : 'Share'}</button>
      </div>
      ${duties}
    </section>

    <section class="card">
      <h2>Who's playing? <span class="muted">${available.length} of ${state.players.length}</span></h2>
      <div class="chips">${chips}</div>
      ${readOnly ? '' : '<p class="hint">Tap a name to mark them unavailable.</p>'}
      <h3>Wicket keepers</h3>
      <div class="keepers">${keeperPickers}</div>
    </section>

    ${problems.length ? `<section class="card warn"><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}

    <section class="card">
      <h2>Batting <span class="muted">${batting[0]?.balls ?? 0} balls each</span></h2>
      ${battingList}
    </section>

    ${plan ? fieldCard(plan, row) + bowlingCard(plan) : ''}`;
}

function fieldCard(plan, row) {
  over = Math.min(Math.max(over, 1), OVERS);
  const current = plan.overs[over - 1];
  return `
    <section class="card">
      <h2>Field</h2>
      ${fieldSvg(plan, over, row.captain)}
      <div class="stepper">
        <button data-action="over" data-over="${over - 1}" ${over === 1 ? 'disabled' : ''} aria-label="Previous over">‹</button>
        <div><strong>Over ${over}</strong><br><span class="muted">${esc(nameOf(current.bowler))} bowling</span></div>
        <button data-action="over" data-over="${over + 1}" ${over === OVERS ? 'disabled' : ''} aria-label="Next over">›</button>
      </div>
      <input type="range" min="1" max="${OVERS}" value="${over}" data-action="slide" aria-label="Over">
      <p class="hint">Small numbers are the overs each player bowls in this block.</p>
    </section>`;
}

// Bowler at the top stumps, keeper at the bottom; everyone else spread round the
// left side then back up the right, the order they step through towards the bowler.
function fieldSvg(plan, overNo, captain) {
  const field = fieldForOver(plan, overNo);
  const block = plan.overs[overNo - 1].block;
  const overs = oversByPlayer(plan, block);
  const cx = 160; const cy = 180; const rx = 126; const ry = 148;
  const k = field.spots.length;
  const left = Math.ceil((k - 1) / 2);
  const right = k - 1 - left;

  const points = [[cx, 82]];
  for (let i = 1; i <= left; i++) {
    const t = (Math.PI * i) / (left + 1);
    points.push([cx - rx * Math.sin(t), cy - ry * Math.cos(t)]);
  }
  for (let i = 1; i <= right; i++) {
    const t = Math.PI + (Math.PI * i) / (right + 1);
    points.push([cx - rx * Math.sin(t), cy - ry * Math.cos(t)]);
  }

  const label = (pid) => `${nameOf(pid)}${pid === captain ? ' (c)' : ''}`;
  const box = ([x, y], text, sub, cls) => `
    <g class="spot ${cls}">
      <rect x="${x - 39}" y="${y - 18}" width="78"height="${sub ? 36 : 30}" rx="7"/>
      <text x="${x}" y="${y + (sub ? -2 : 3)}">${esc(text)}</text>
      ${sub ? `<text class="sub" x="${x}" y="${y + 12}">${esc(sub)}</text>` : ''}
    </g>`;

  const stumps = (y) => [-5, 0, 5].map((d) => `<line x1="${cx + d}" y1="${y}" x2="${cx + d}" y2="${y + 10}"/>`).join('');
  return `
    <svg class="field" viewBox="0 0 320 360" role="img" aria-label="Field placings for over ${overNo}">
      <ellipse class="grass" cx="${cx}" cy="${cy}" rx="154" ry="174"/>
      <rect class="pitch" x="${cx - 9}" y="112" width="18" height="136" rx="2"/>
      <g class="stumps">${stumps(108)}${stumps(242)}</g>
      ${field.spots.map((pid, s) => box(points[s], label(pid), (overs[pid] || []).join(', '), s === 0 ? 'bowler' : '')).join('')}
      ${box([cx, 280], `${label(field.keeper)} (w)`, '', 'keeper')}
    </svg>`;
}

function bowlingCard(plan) {
  const counts = bowlingCounts(plan);
  const blocks = plan.blocks.map((b, i) => `
    <div>
      <h3>Overs ${i * BLOCK + 1}–${(i + 1) * BLOCK} <span class="muted">· ${esc(nameOf(b.keeper))} keeps</span></h3>
      <ol class="list overs">${plan.overs.filter((o) => o.block === i).map((o) => `
        <li><button data-action="over" data-over="${o.over}" class="${o.over === over ? 'current' : ''}">
          <span class="num">${o.over}</span>${esc(nameOf(o.bowler))}</button></li>`).join('')}
      </ol>
    </div>`).join('');
  const tally = Object.entries(counts).map(([pid, n]) => `${esc(nameOf(pid))} ${n}`).join(' · ');
  return `
    <section class="card">
      <h2>Bowling</h2>
      <div class="blocks">${blocks}</div>
      <p class="hint">Overs each: ${tally}</p>
    </section>`;
}

// ---------- Squad ----------

function orderCard(title, list, key) {
  return `
    <section class="card">
      <h2>${title}</h2>
      <ol class="list">${list.map((pid, i) => `
        <li><span class="num">${i + 1}</span>${esc(nameOf(pid))}
          <span class="right">
            <button class="icon" data-action="move" data-list="${key}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(nameOf(pid))} up">↑</button>
            <button class="icon" data-action="move" data-list="${key}" data-i="${i}" data-dir="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(nameOf(pid))} down">↓</button>
          </span></li>`).join('')}
      </ol>
    </section>`;
}

function squadView() {
  return `
    <section class="card">
      <h2>Players</h2>
      <ul class="list">${state.players.map((p) => `
        <li><input value="${esc(p.name)}" data-action="rename" data-id="${esc(p.id)}" aria-label="Name">
          <button class="icon" data-action="remove" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">✕</button></li>`).join('')}
      </ul>
      <form class="row" data-action="add">
        <input name="name" placeholder="New player" aria-label="New player name" required>
        <button class="primary">Add</button>
      </form>
    </section>
    ${orderCard('Batting order', state.batting, 'batting')}
    ${orderCard('Bowling order', state.bowling, 'bowling')}
    <p class="hint center">The bowling order is also the order players move round the field.</p>
    <p class="center"><button data-action="reset">Reset to season sheet</button></p>`;
}

// ---------- Roster ----------

function rosterView() {
  const ids = state.players.map((p) => p.id);
  const next = defaultDate();
  const field = (r, key, label) => `
    <label>${label}<select data-action="roster" data-date="${r.date}" data-key="${key}">${options(ids, r[key])}</select></label>`;
  return `${sortedRoster().map((r) => `
    <section class="card${r.date === next ? ' next' : ''}">
      <div class="row">
        <input type="date" value="${r.date}" data-action="roster-date" data-date="${r.date}" aria-label="Game date">
        ${r.date === next ? '<span class="tag">Next game</span>' : ''}
        <button class="icon" data-action="roster-remove" data-date="${r.date}" aria-label="Remove ${esc(prettyDate(r.date))}">✕</button>
      </div>
      <div class="grid">
        ${field(r, 'captain', 'Captain')}
        ${field(r, 'lollies', 'Lollies')}
        ${field(r, 'keeper1', 'Keeper overs 1–10')}
        ${field(r, 'keeper2', 'Keeper overs 11–20')}
        <label class="wide">Friday training<input value="${esc(r.training)}" data-action="roster" data-date="${r.date}" data-key="training"></label>
      </div>
    </section>`).join('')}
    <p class="center"><button class="primary" data-action="roster-add">Add a week</button></p>`;
}

// ---------- Wiring ----------

function render() {
  tabs.hidden = readOnly;
  document.querySelector('header h1').textContent = state.team;
  document.querySelector('header .season').textContent = readOnly ? 'Shared match plan' : `Season ${state.season}`;
  for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-current', b.dataset.tab === tab);
  main.innerHTML = tab === 'squad' ? squadView() : tab === 'roster' ? rosterView() : matchView();
}

function move(list, i, dir) {
  const j = i + dir;
  [list[i], list[j]] = [list[j], list[i]];
}

async function share() {
  if (readOnly) {
    location.href = location.pathname;
    return;
  }
  const url = shareUrl(state, date);
  const title = `${state.team} — ${prettyDate(date)}`;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await navigator.clipboard.writeText(url);
      alert('Link copied.');
    }
  } catch (e) {
    if (e.name !== 'AbortError') prompt('Copy this link:', url);
  }
}

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  render();
  scrollTo(0, 0);
});

main.addEventListener('click', (e) => {
  const el = e.target.closest('button[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action === 'toggle') {
    const { unavailable } = matchFor(state, date);
    const pid = el.dataset.id;
    setMatch({ unavailable: unavailable.includes(pid) ? unavailable.filter((x) => x !== pid) : [...unavailable, pid] });
  } else if (action === 'over') {
    over = Number(el.dataset.over);
    render();
  } else if (action === 'share') {
    share();
  } else if (action === 'move') {
    move(state[el.dataset.list], Number(el.dataset.i), Number(el.dataset.dir));
    persist();
  } else if (action === 'remove') {
    const pid = el.dataset.id;
    if (!confirm(`Remove ${nameOf(pid)} from the squad?`)) return;
    state.players = state.players.filter((p) => p.id !== pid);
    state.batting = state.batting.filter((x) => x !== pid);
    state.bowling = state.bowling.filter((x) => x !== pid);
    for (const r of state.roster) for (const k of ['captain', 'lollies', 'keeper1', 'keeper2']) if (r[k] === pid) r[k] = '';
    for (const m of Object.values(state.matches)) {
      m.unavailable = (m.unavailable || []).filter((x) => x !== pid);
      if (m.keepers) m.keepers = m.keepers.map((k) => (k === pid ? '' : k));
    }
    persist();
  } else if (action === 'reset') {
    if (!confirm('Replace the squad, orders and roster with the 2026/27 season sheet?')) return;
    state = defaultState();
    date = defaultDate();
    persist();
  } else if (action === 'roster-add') {
    const last = sortedRoster().at(-1)?.date;
    const d = last ? new Date(`${last}T00:00:00`) : new Date();
    if (last) d.setDate(d.getDate() + 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    state.roster.push({ date: iso, captain: '', lollies: '', keeper1: '', keeper2: '', training: '' });
    persist();
  } else if (action === 'roster-remove') {
    if (!confirm(`Remove ${prettyDate(el.dataset.date)} from the roster?`)) return;
    state.roster = state.roster.filter((r) => r.date !== el.dataset.date);
    delete state.matches[el.dataset.date];
    if (date === el.dataset.date) date = defaultDate();
    persist();
  }
});

main.addEventListener('change', (e) => {
  const el = e.target;
  const { action } = el.dataset;
  if (action === 'date') {
    date = el.value;
    over = 1;
    render();
  } else if (action === 'keeper') {
    const { keepers } = matchFor(state, date);
    keepers[Number(el.dataset.block)] = el.value;
    setMatch({ keepers });
  } else if (action === 'rename') {
    const p = state.players.find((x) => x.id === el.dataset.id);
    if (p && el.value.trim()) p.name = el.value.trim();
    persist();
  } else if (action === 'roster') {
    const r = state.roster.find((x) => x.date === el.dataset.date);
    r[el.dataset.key] = el.value;
    persist();
  } else if (action === 'roster-date') {
    const from = el.dataset.date;
    const to = el.value;
    if (!to || state.roster.some((r) => r.date === to)) {
      el.value = from;
      return;
    }
    state.roster.find((r) => r.date === from).date = to;
    if (state.matches[from]) {
      state.matches[to] = state.matches[from];
      delete state.matches[from];
    }
    if (date === from) date = to;
    persist();
  }
});

main.addEventListener('input', (e) => {
  if (e.target.dataset.action !== 'slide') return;
  over = Number(e.target.value);
  render();
  main.querySelector('[data-action="slide"]')?.focus();
});

main.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = new FormData(e.target).get('name').trim();
  if (!name) return;
  const pid = newPlayerId(state, name);
  state.players.push({ id: pid, name });
  state.batting.push(pid);
  state.bowling.push(pid);
  persist();
});

render();
