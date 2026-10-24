// Saving on this device, and packing a match plan into a share link.

const KEY = 'cricket-manager:v1';

const NAMES = ['Hugh', 'Josh', 'Oscar', 'Marco', 'Arlo', 'Sean', 'Lachie', 'Nick'];
const id = (name) => name.toLowerCase();

// Seeded from the 2026/27 season spreadsheet.
export function defaultState() {
  const roster = [
    ['2026-10-24', 'Josh', 'Hugh', '3:30–4:15 DT'],
    ['2026-10-31', 'Hugh', 'Lachie', '3:30–4:15 DT'],
    ['2026-11-07', 'Lachie', 'Nick', '5:30–6:15 Nolans'],
    ['2026-11-14', 'Nick', 'Marco', '5:30–6:15 Nolans'],
    ['2026-11-21', 'Marco', 'Oscar', '5:30–6:15 Nolans'],
    ['2026-11-28', 'Oscar', 'Sean', '4:30–5:30 TBC'],
    ['2026-12-05', 'Sean', 'Nick', '4:30–5:30 TBC'],
    ['2026-12-12', 'Arlo', 'Hugh', '4:30–5:30 TBC'],
  ].map(([date, captain, keeper2, training]) => ({
    date, captain: id(captain), keeper1: id(captain), keeper2: id(keeper2), lollies: id(captain), training,
  }));

  return {
    team: 'Seaforth HOWZATS U11s',
    season: '2026/2027',
    players: NAMES.map((name) => ({ id: id(name), name })),
    batting: ['Hugh', 'Josh', 'Oscar', 'Marco', 'Arlo', 'Sean', 'Lachie', 'Nick'].map(id),
    bowling: ['Hugh', 'Arlo', 'Oscar', 'Josh', 'Nick', 'Lachie', 'Sean', 'Marco'].map(id),
    roster,
    matches: {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Private mode or blocked storage: fall back to the defaults.
  }
  return defaultState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function newPlayerId(state, name) {
  const base = id(name).replace(/[^a-z0-9]+/g, '-') || 'player';
  let candidate = base;
  for (let n = 2; state.players.some((p) => p.id === candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}

// The keeper picks for a match default to that week's roster until changed.
export function matchFor(state, date) {
  const saved = state.matches[date] || {};
  const row = state.roster.find((r) => r.date === date) || {};
  return {
    unavailable: saved.unavailable || [],
    keepers: saved.keepers || [row.keeper1 || '', row.keeper2 || ''],
  };
}

// Everything a viewer needs for one match, small enough for a URL. It goes in the
// #fragment, which browsers never send to the server.
export function shareUrl(state, date) {
  const snapshot = {
    t: state.team,
    p: state.players.map((p) => [p.id, p.name]),
    b: state.batting,
    w: state.bowling,
    d: date,
    m: matchFor(state, date),
    r: state.roster.find((r) => r.date === date) || null,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#share=${b64}`;
}

export function readShare(hash) {
  const m = /^#share=([\w-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const s = JSON.parse(new TextDecoder().decode(bytes));
    return {
      team: s.t,
      season: '',
      players: s.p.map(([pid, name]) => ({ id: pid, name })),
      batting: s.b,
      bowling: s.w,
      roster: s.r ? [s.r] : [],
      matches: { [s.d]: s.m },
      sharedDate: s.d,
    };
  } catch {
    return null;
  }
}
