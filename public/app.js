import { MISSIONS, EQUIPMENT, DEFAULT_DESIGN, telemetry, validate, runMission } from './sim.js';

const $ = (id) => document.getElementById(id);
const state = { mission: 'moon', design: { ...DEFAULT_DESIGN } };

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const link = (href, text) => {
  const u = safeUrl(href);
  return u ? el('a', { href: u, target: '_blank', rel: 'noopener', text }) : null;
};

const FUEL_TANKS = [0, 50, 100, 200, 400, 700, 1000, 1500].map((kg) => ({ id: kg, name: kg ? `${kg} kg tank` : 'No fuel', detail: `$${(kg * 0.05).toFixed(1)}M` }));

function buildChoices(key, list, detail) {
  const box = $(key);
  for (const x of list) {
    const b = el('button', { type: 'button', role: 'radio', 'data-id': x.id, text: x.name }, el('small', { text: detail(x) }));
    b.addEventListener('click', () => { state.design[key] = x.id; render(); });
    box.append(b);
  }
}

function buildControls() {
  buildChoices('panels', EQUIPMENT.panels, (x) => `${x.mass} kg · $${x.cost}M`);
  buildChoices('batteries', EQUIPMENT.batteries, (x) => `${x.mass} kg · $${x.cost}M`);
  buildChoices('comms', EQUIPMENT.comms, (x) => `range ${x.au} AU · ${x.draw} W · $${x.cost}M`);
  buildChoices('fuel', FUEL_TANKS, (x) => x.detail);
  buildChoices('launcher', EQUIPMENT.launchers, (x) => `${x.leo} kg to orbit · $${x.cost}M`);
  for (const i of EQUIPMENT.instruments) {
    const cb = el('input', { type: 'checkbox', value: i.id });
    cb.addEventListener('change', () => {
      const set = new Set(state.design.instruments);
      cb.checked ? set.add(i.id) : set.delete(i.id);
      state.design.instruments = [...set];
      render();
    });
    $('instruments').append(el('label', {}, cb, `${i.name} · ${i.mass} kg · ${i.draw} W · $${i.cost}M`));
  }
  for (const [id, m] of Object.entries(MISSIONS)) {
    const b = el('button', { type: 'button', role: 'radio', 'data-id': id, text: `${m.icon} ${m.name}` });
    b.addEventListener('click', () => selectMission(id));
    $('missions').append(b);
  }
}

function selectMission(id) {
  state.mission = id;
  $('result').hidden = true;
  render();
  loadResources();
}

function gauge(label, value, unit, max, over, hint) {
  const pct = Math.min(100, (value / max) * 100);
  return el('div', { class: 'gauge' },
    el('div', { class: 'muted small', text: label }),
    el('b', { text: `${value.toFixed(value < 10 ? 2 : 0)} ${unit}` }),
    el('div', { class: 'muted small', text: hint }),
    el('div', { class: 'bar' }, el('i', { class: over ? 'over' : '', style: `width:${pct}%` })));
}

function render() {
  const m = MISSIONS[state.mission];
  document.querySelectorAll('#missions button').forEach((b) => b.setAttribute('aria-checked', b.dataset.id === state.mission));
  $('brief').textContent = m.brief;
  $('reqs').replaceChildren(...[
    `Budget cap: $${m.budget}M`, `Delta-v needed: ${m.dv} m/s`, `Comms range needed: ${m.commAu} AU`,
    `Required instruments: ${m.needs.map((n) => EQUIPMENT.instruments.find((i) => i.id === n).name).join(', ')}`,
    `Science data target: ${m.dataGB} GB`, `Solar flux at target: ${Math.round(m.solar * 100)}% of Earth`,
  ].map((t) => el('li', { text: t })));
  for (const key of ['panels', 'batteries', 'comms', 'fuel', 'launcher']) {
    $(key).querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id) === String(state.design[key])));
  }
  const eyes = { moon: 'moon', mars: 'mars', earth: 'earth' }[state.mission];
  $('eyes-link').href = `https://eyes.nasa.gov/apps/solar-system/${eyes ? `#/${eyes}` : ''}`;
  $('eyes-link').textContent = `Explore ${m.name.split(' ')[0] === 'Asteroid' ? 'the solar system' : m.name.split(' ')[0]} in NASA Eyes`;

  const { problems, telemetry: t } = validate(state.mission, state.design);
  $('telemetry').replaceChildren(
    gauge('Budget', t.cost, '$M', t.budget, t.cost > t.budget, `cap $${t.budget}M`),
    gauge('Mass', t.wetMass, 'kg', t.capacity, t.wetMass > t.capacity, `launcher limit ${t.capacity} kg`),
    gauge('Power', t.powerDraw, 'W draw', Math.max(t.powerGen, t.powerDraw, 1), t.powerGen < t.powerDraw, `generation ${t.powerGen.toFixed(0)} W · battery ${t.batteryWh}/${t.batteryNeed.toFixed(0)} Wh`),
    gauge('Fuel / delta-v', t.dvAvailable, 'm/s', Math.max(t.dvRequired, t.dvAvailable), t.dvAvailable < t.dvRequired, `${t.fuel} kg fuel · need ${t.dvRequired} m/s`),
    gauge('Comms range', t.commAu, 'AU', Math.max(t.commAu, t.commRequired), t.commAu < t.commRequired, `need ${t.commRequired} AU`));
  $('live-problems').replaceChildren(...(problems.length
    ? problems.map((p) => el('li', { text: p }))
    : [el('li', { class: 'good', text: 'Design meets all requirements. Ready for launch.' })]));
}

function showResult() {
  const r = runMission(state.mission, state.design);
  const box = $('result');
  box.hidden = false;
  box.replaceChildren(
    el('h2', { text: r.success ? 'Mission success' : 'Mission incomplete' }),
    el('div', { class: 'score', text: `Score: ${r.score}` }),
    el('p', { text: `Event: ${r.event.name} — ${r.event.text}` }),
    el('p', { text: `Data collected: ${r.collectedGB} GB of ${r.targetGB} GB target` }),
    el('ul', { class: 'objs' }, ...r.objectives.map((o) => el('li', { class: o.ok ? 'ok' : 'bad', text: `${o.ok ? '✅' : '❌'} ${o.label}` }))));
  const issues = [...r.problems, ...r.eventProblems];
  if (issues.length) box.append(el('h3', { text: 'Design problems' }), el('ul', { class: 'problems' }, ...issues.map((p) => el('li', { text: p }))));
  else box.append(el('p', { class: 'ok', text: 'No design problems found. Adjust the design and run again to try for a higher score.' }));
  box.append(el('p', { class: 'muted small', text: 'Adjust your design above and run again; events vary each run.' }));
  box.focus();
}

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function renderItems(container, items, mapper, empty) {
  container.replaceChildren(...(items.length ? items.map(mapper) : [el('p', { class: 'muted', text: empty })]));
}

async function loadResources() {
  const q = encodeURIComponent(MISSIONS[state.mission].keywords.join(','));
  $('data-state').textContent = 'loading…'; $('code-state').textContent = 'loading…';
  const fallback = (c, st, href, label) => {
    $(st).textContent = 'unavailable';
    c.replaceChildren(el('p', { class: 'muted', text: 'Could not load this catalog right now (the game still works). ' }, link(href, label)));
  };
  api(`/api/datasets?q=${q}`).then((d) => {
    $('data-state').textContent = `live catalog · ${new Date(d.retrievedAt).toLocaleString()}`;
    renderItems($('datasets'), d.items, (x) => el('div', { class: 'item' },
      el('h3', { text: x.title }), el('p', { class: 'small', text: x.summary || 'No summary provided.' }),
      ...[link(x.recordUrl, 'Original record'), link(x.dataUrl, 'Data / access link')].filter(Boolean).flatMap((a, i) => (i ? [' · ', a] : [a]))),
      'No matching catalog entries found.');
  }).catch(() => fallback($('datasets'), 'data-state', 'https://data.nasa.gov', 'Browse data.nasa.gov'));
  api(`/api/software?q=${q}`).then((d) => {
    $('code-state').textContent = `live catalog · ${new Date(d.retrievedAt).toLocaleString()}`;
    renderItems($('software'), d.items, (x) => el('div', { class: 'item' },
      el('h3', { text: x.name }), el('p', { class: 'small', text: x.summary }),
      ...[link(x.repositoryUrl, 'Repository')].filter(Boolean), el('span', { class: 'muted small', text: x.license ? ` · ${x.license}` : '' })),
      'No matching projects for this mission; browse the full catalog at code.nasa.gov.');
  }).catch(() => fallback($('software'), 'code-state', 'https://code.nasa.gov', 'Browse code.nasa.gov'));
}

async function queryEE() {
  const out = $('ee-out');
  out.textContent = 'Querying Earth Engine…';
  try {
    const r = await api(`/api/earth-engine?region=${$('region').value}&year=${$('year').value}`);
    if (r.status === 'ok') {
      out.replaceChildren(el('p', { class: 'ok', text: `Mean NDVI ${r.meanNDVI} — ${r.region}, ${r.year}` }),
        el('p', { class: 'small' }, `Source: Google Earth Engine, `, link(r.datasetUrl, r.dataset), `. ${r.note}`));
    } else {
      out.textContent = r.message;
    }
  } catch {
    out.textContent = 'Could not reach the game server for Earth Engine. Check that it is running, then try again.';
  }
}

buildControls();
render();
$('run').addEventListener('click', showResult);
$('ee-run').addEventListener('click', queryEE);
api('/api/regions').then((rs) => rs.forEach((r) => $('region').append(el('option', { value: r.id, text: r.name })))).catch(() => {});
loadResources();
