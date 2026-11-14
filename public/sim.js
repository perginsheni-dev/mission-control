// Game data and simulation. Pure functions so the UI and tests share one source of truth.
export const ISP_G = 320 * 9.80665 / 1000; // km/s effective exhaust velocity (Isp 320 s)
export const BUS_MASS = 120; // kg, structure + avionics
export const BUS_POWER = 60; // W housekeeping
export const BUS_COST = 20; // $M

export const MISSIONS = {
  moon: {
    name: 'Lunar Orbiter', icon: '🌙', budget: 220, dv: 1000, commAu: 0.003, solar: 1, eclipseH: 0.8,
    brief: 'Enter lunar orbit and map the surface and its composition.',
    needs: ['imaging', 'spectro'], dataGB: 30, keywords: ['lunar', 'moon', 'LRO'],
  },
  mars: {
    name: 'Mars Surveyor', icon: '🔴', budget: 380, dv: 1500, commAu: 2.5, solar: 0.43, eclipseH: 0.7,
    brief: 'Insert into Mars orbit and survey climate and geology from afar.',
    needs: ['imaging', 'spectro'], dataGB: 40, keywords: ['mars', 'MAVEN', 'MRO'],
  },
  asteroid: {
    name: 'Asteroid Rendezvous', icon: '☄️', budget: 300, dv: 1300, commAu: 1.5, solar: 0.36, eclipseH: 0.3,
    brief: 'Rendezvous with a near-Earth asteroid and characterize its surface.',
    needs: ['imaging', 'sample'], dataGB: 25, keywords: ['asteroid', 'OSIRIS-REx', 'near-Earth'],
  },
  earth: {
    name: 'Earth Observer', icon: '🌍', budget: 160, dv: 150, commAu: 0.0005, solar: 1, eclipseH: 0.6,
    brief: 'Monitor vegetation and climate from low Earth orbit.',
    needs: ['imaging', 'multispec'], dataGB: 60, keywords: ['MODIS', 'earth observing', 'vegetation'],
  },
};

// Each item: mass kg, cost $M, power W (+ generates / - draws)
export const EQUIPMENT = {
  panels: [
    { id: 'p0', name: 'No panels', mass: 0, cost: 0, watts: 0 },
    { id: 'p1', name: 'Small arrays (150 W)', mass: 8, cost: 6, watts: 150 },
    { id: 'p2', name: 'Medium arrays (400 W)', mass: 20, cost: 14, watts: 400 },
    { id: 'p3', name: 'Large arrays (900 W)', mass: 45, cost: 30, watts: 900 },
  ],
  batteries: [
    { id: 'b0', name: 'No battery', mass: 0, cost: 0, wh: 0 },
    { id: 'b1', name: 'Li-ion small (100 Wh)', mass: 4, cost: 3, wh: 100 },
    { id: 'b2', name: 'Li-ion medium (300 Wh)', mass: 12, cost: 8, wh: 300 },
    { id: 'b3', name: 'Li-ion large (800 Wh)', mass: 30, cost: 18, wh: 800 },
  ],
  comms: [
    { id: 'c1', name: 'UHF patch (0.01 AU)', mass: 2, cost: 2, draw: 5, au: 0.01 },
    { id: 'c2', name: 'S-band (0.5 AU)', mass: 6, cost: 8, draw: 20, au: 0.5 },
    { id: 'c3', name: 'X-band (3 AU)', mass: 14, cost: 18, draw: 40, au: 3 },
    { id: 'c4', name: 'Ka-band dish (6 AU)', mass: 28, cost: 35, draw: 70, au: 6 },
  ],
  instruments: [
    { id: 'imaging', name: 'Wide-angle camera', mass: 6, cost: 10, draw: 15, gb: 14, tag: 'imaging' },
    { id: 'spectro', name: 'Spectrometer', mass: 12, cost: 22, draw: 30, gb: 8, tag: 'spectro' },
    { id: 'multispec', name: 'Multispectral imager', mass: 14, cost: 25, draw: 35, gb: 26, tag: 'multispec' },
    { id: 'sample', name: 'Sample-contact probe', mass: 20, cost: 35, draw: 25, gb: 6, tag: 'sample' },
    { id: 'mag', name: 'Magnetometer', mass: 3, cost: 6, draw: 5, gb: 3, tag: 'mag' },
    { id: 'radar', name: 'Radar sounder', mass: 25, cost: 40, draw: 60, gb: 12, tag: 'radar' },
  ],
  launchers: [
    { id: 'l1', name: 'Light (Electron-class)', leo: 300, escape: 40, cost: 8 },
    { id: 'l2', name: 'Medium (Falcon 9-class)', leo: 5000, escape: 1200, cost: 60 },
    { id: 'l3', name: 'Heavy (Falcon Heavy-class)', leo: 15000, escape: 4500, cost: 130 },
  ],
};
// Capacities are illustrative game values, not vendor specifications.

const byId = (list, id) => list.find((x) => x.id === id);

export const DEFAULT_DESIGN = { panels: 'p1', batteries: 'b1', comms: 'c1', instruments: [], fuel: 100, launcher: 'l2' };

export const EVENTS = [
  { id: 'clear', name: 'Nominal operations', text: 'No anomalies occurred.' },
  { id: 'flare', name: 'Solar flare', text: 'A flare cut solar generation by 30%.' },
  { id: 'micro', name: 'Micrometeoroid strike', text: 'A strike vented 10% of the remaining fuel.' },
  { id: 'glitch', name: 'Comms glitch', text: 'Link dropouts lost 25% of the collected data.' },
];

export function telemetry(missionId, design) {
  const m = MISSIONS[missionId];
  const panel = byId(EQUIPMENT.panels, design.panels);
  const batt = byId(EQUIPMENT.batteries, design.batteries);
  const comm = byId(EQUIPMENT.comms, design.comms);
  const launcher = byId(EQUIPMENT.launchers, design.launcher);
  const inst = design.instruments.map((id) => byId(EQUIPMENT.instruments, id)).filter(Boolean);
  const fuel = Math.max(0, design.fuel);

  const dryMass = BUS_MASS + panel.mass + batt.mass + comm.mass + inst.reduce((s, i) => s + i.mass, 0);
  const wetMass = dryMass + fuel;
  const cost = BUS_COST + panel.cost + batt.cost + comm.cost + launcher.cost + inst.reduce((s, i) => s + i.cost, 0) + fuel * 0.05;
  const powerGen = panel.watts * m.solar;
  const powerDraw = BUS_POWER + comm.draw + inst.reduce((s, i) => s + i.draw, 0);
  const batteryNeed = powerDraw * m.eclipseH;
  const dvAvailable = fuel > 0 ? ISP_G * Math.log(wetMass / dryMass) * 1000 : 0; // m/s
  const capacity = missionId === 'earth' ? launcher.leo : launcher.escape;
  return {
    cost, dryMass, wetMass, fuel, powerGen, powerDraw, batteryNeed, batteryWh: batt.wh,
    dvAvailable, dvRequired: m.dv, commAu: comm.au, commRequired: m.commAu,
    capacity, budget: m.budget, instruments: inst,
  };
}

// Problems that make a design fail, derived from the same telemetry the UI shows.
export function validate(missionId, design) {
  const m = MISSIONS[missionId];
  const t = telemetry(missionId, design);
  const problems = [];
  if (t.cost > t.budget) problems.push(`Over budget by $${(t.cost - t.budget).toFixed(1)}M.`);
  if (t.wetMass > t.capacity) problems.push(`Spacecraft (${t.wetMass.toFixed(0)} kg) exceeds launcher capacity (${t.capacity} kg).`);
  if (t.powerGen < t.powerDraw) problems.push(`Power deficit: generating ${t.powerGen.toFixed(0)} W but drawing ${t.powerDraw} W.`);
  if (t.batteryWh < t.batteryNeed) problems.push(`Battery too small for eclipses: ${t.batteryWh} Wh vs ${t.batteryNeed.toFixed(0)} Wh needed.`);
  if (t.dvAvailable < t.dvRequired) problems.push(`Insufficient delta-v: ${t.dvAvailable.toFixed(0)} m/s vs ${t.dvRequired} m/s required.`);
  if (t.commAu < t.commRequired) problems.push(`Comms range ${t.commAu} AU is below the ${t.commRequired} AU needed.`);
  const tags = t.instruments.map((i) => i.tag);
  for (const need of m.needs) {
    if (!tags.includes(need)) problems.push(`Missing required instrument: ${byId(EQUIPMENT.instruments, need).name}.`);
  }
  return { problems, telemetry: t };
}

export function runMission(missionId, design, rand = Math.random) {
  const m = MISSIONS[missionId];
  const { problems, telemetry: t } = validate(missionId, design);
  const roll = rand();
  const event = roll < 0.4 ? EVENTS[0] : roll < 0.6 ? EVENTS[1] : roll < 0.8 ? EVENTS[2] : EVENTS[3];

  let powerGen = t.powerGen, fuel = t.fuel, dataFactor = 1;
  if (event.id === 'flare') powerGen *= 0.7;
  const dvAfter = event.id === 'micro' && fuel > 0
    ? ISP_G * Math.log((t.dryMass + fuel * 0.9) / t.dryMass) * 1000 : t.dvAvailable;
  if (event.id === 'glitch') dataFactor = 0.75;

  // Event-induced failures are listed separately from design problems.
  const eventProblems = [];
  if (event.id === 'flare' && t.powerGen >= t.powerDraw && powerGen < t.powerDraw) {
    eventProblems.push('The solar flare pushed power generation below demand; add panel margin.');
  }
  if (event.id === 'micro' && t.dvAvailable >= t.dvRequired && dvAfter < t.dvRequired) {
    eventProblems.push('Fuel loss left too little delta-v; carry more fuel margin.');
  }

  const launched = t.cost <= t.budget && t.wetMass <= t.capacity;
  const powered = powerGen >= t.powerDraw && t.batteryWh >= t.batteryNeed;
  const flew = dvAfter >= t.dvRequired;
  const linked = t.commAu >= t.commRequired;
  const tags = t.instruments.map((i) => i.tag);
  const hasInstruments = m.needs.every((n) => tags.includes(n));
  const ready = launched && powered && flew && linked;

  const rawGB = ready ? t.instruments.reduce((s, i) => s + i.gb, 0) * 3 : 0;
  const collectedGB = Math.round(rawGB * dataFactor * 10) / 10;

  const objectives = [
    { label: 'Launch within budget and vehicle capacity', ok: launched },
    { label: 'Maintain power through eclipses', ok: powered },
    { label: `Reach destination (${m.dv} m/s delta-v)`, ok: flew },
    { label: `Keep communications link (${m.commAu} AU)`, ok: linked },
    ...m.needs.map((n) => ({ label: `Carry ${byId(EQUIPMENT.instruments, n).name}`, ok: tags.includes(n) })),
    { label: `Collect ${m.dataGB} GB of science data`, ok: ready && hasInstruments && collectedGB >= m.dataGB },
  ];
  const achieved = objectives.filter((o) => o.ok).length;
  const success = objectives.every((o) => o.ok);
  let score = Math.round((achieved / objectives.length) * 800);
  if (success) {
    const budgetLeft = Math.max(0, (t.budget - t.cost) / t.budget);
    score += 100 + Math.round(budgetLeft * 100); // bonus for full success and thrift
  }
  return { success, score, objectives, collectedGB, targetGB: m.dataGB, event, problems, eventProblems, telemetry: t };
}
