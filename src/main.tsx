import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, BatteryCharging, Check, ChevronRight, CircleDollarSign, Clock3, CloudLightning,
  Cpu, Crosshair, Fuel, Globe2, Info, Radio, RotateCcw, Satellite, ShieldCheck, Sparkles,
  Target, Telescope, TriangleAlert, Zap
} from 'lucide-react';
import './styles.css';

type MissionId = 'moon' | 'mars' | 'asteroid' | 'earth';
type Report = { success: number; data: number; objectives: string[]; problems: string[]; event: string; remaining: Resources };
type Resources = { budget: number; mass: number; power: number; fuel: number; range: number };

type Option = { id: string; name: string; detail: string; mass: number; power: number; cost: number; range?: number; fuel?: number };

const missions = [
  { id: 'moon' as MissionId, name: 'Lunar Relay', target: 'Moon', tag: 'NEAR-EARTH', accent: '#f4c76b', icon: '◐', description: 'Map the permanently shadowed craters at the Moon’s south pole.', distance: '384,400 km', time: '6 days', budget: 1_050, power: 35, fuel: 66, range: 420_000, instrument: 'radar', science: 'Subsurface radar maps shadowed-crater ice' },
  { id: 'mars' as MissionId, name: 'Red Planet Survey', target: 'Mars', tag: 'DEEP SPACE', accent: '#ee806e', icon: '◉', description: 'Study atmospheric dust and search for the chemistry of ancient water.', distance: '225M km', time: '7 months', budget: 1_700, power: 45, fuel: 82, range: 250_000_000, instrument: 'analyzer', science: 'Sample analyzer studies Martian chemistry' },
  { id: 'asteroid' as MissionId, name: 'Asteria Rendezvous', target: 'Asteroid 433', tag: 'PRECISION', accent: '#72c8b4', icon: '✦', description: 'Characterize a near-Earth asteroid and analyze its regolith.', distance: '42M km', time: '14 months', budget: 1_300, power: 40, fuel: 74, range: 50_000_000, instrument: 'analyzer', science: 'Sample analyzer characterizes regolith' },
  { id: 'earth' as MissionId, name: 'Blue Marble Watch', target: 'Earth orbit', tag: 'CLIMATE', accent: '#76a9ed', icon: '⊕', description: 'Build a high-resolution record of changing oceans and cloud systems.', distance: '1,200 km', time: '18 months', budget: 800, power: 30, fuel: 45, range: 2_000, instrument: 'camera', science: 'Spectral imager records ocean and cloud change' },
];

const spacecraft: Option[] = [
  { id: 'compact', name: 'Compact bus', detail: 'Lean and agile', mass: 140, power: 12, cost: 80 },
  { id: 'standard', name: 'Standard bus', detail: 'Balanced platform', mass: 240, power: 20, cost: 160 },
  { id: 'orbiter', name: 'Deep-space orbiter', detail: 'More room to explore', mass: 420, power: 30, cost: 280 },
];
const panels: Option[] = [
  { id: 'folding', name: 'Folding array', detail: '+22 power', mass: 80, power: 22, cost: 100 },
  { id: 'wide', name: 'Wide solar wings', detail: '+44 power', mass: 150, power: 44, cost: 210 },
];
const batteries: Option[] = [
  { id: 'cell', name: 'Night cell', detail: '+18 reserve', mass: 60, power: 18, cost: 90 },
  { id: 'bank', name: 'Redundant bank', detail: '+38 reserve', mass: 120, power: 38, cost: 170 },
];
const comms: Option[] = [
  { id: 'dish', name: 'Directional dish', detail: '+1.2M km range', mass: 70, power: 8, cost: 125, range: 1_200_000 },
  { id: 'deep', name: 'Deep-space array', detail: '+250M km range', mass: 160, power: 18, cost: 280, range: 250_000_000 },
];
const instruments: Option[] = [
  { id: 'camera', name: 'Spectral imager', detail: 'Surface chemistry', mass: 65, power: 14, cost: 120 },
  { id: 'radar', name: 'Subsurface radar', detail: 'Buried structures', mass: 110, power: 26, cost: 190 },
  { id: 'analyzer', name: 'Sample analyzer', detail: 'In-situ minerals', mass: 130, power: 32, cost: 240 },
];
const rockets = [
  { id: 'small', name: 'Small rocket', lift: 650, fuel: 52, cost: 160, description: 'Efficient for nearby orbit' },
  { id: 'medium', name: 'Medium rocket', lift: 1_150, fuel: 76, cost: 300, description: 'The mission workhorse' },
  { id: 'heavy', name: 'Heavy rocket', lift: 1_800, fuel: 112, cost: 520, description: 'Maximum lift, maximum reach' },
];

const NASA_CATALOG_URL = 'https://data.nasa.gov/data.json';
const EARTH_ENGINE_DATASET_URL = 'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1';
const missionSearchTerms: Record<MissionId, string> = {
  moon: 'moon lunar',
  mars: 'mars planetary',
  asteroid: 'asteroid near earth object',
  earth: 'earth climate vegetation',
};

type NasaDistribution = { title?: string; accessURL?: string; downloadURL?: string };
type NasaDataset = {
  title?: string;
  description?: string;
  identifier?: string;
  landingPage?: string;
  distribution?: NasaDistribution[];
};
type EarthEngineResult = {
  dataset: string;
  ndvi: number;
  imageCount: number;
  startDate: string;
  endDate: string;
  region: string;
};

function httpLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function distributionLink(dataset: NasaDataset) {
  return dataset.distribution?.map((item) => httpLink(item.downloadURL) ?? httpLink(item.accessURL)).find(Boolean);
}

function recordLink(dataset: NasaDataset) {
  return httpLink(dataset.landingPage) ?? httpLink(dataset.identifier) ?? distributionLink(dataset);
}

function App() {
  const [missionId, setMissionId] = useState<MissionId>('moon');
  const [selections, setSelections] = useState({ spacecraft: 'standard', panels: 'folding', batteries: 'cell', comms: 'dish', instrument: 'camera', rocket: 'medium' });
  const [report, setReport] = useState<Report | null>(null);
  const [nasaQuery, setNasaQuery] = useState(missionSearchTerms.moon);
  const [nasaCatalog, setNasaCatalog] = useState<NasaDataset[] | null>(null);
  const [nasaResults, setNasaResults] = useState<NasaDataset[]>([]);
  const [nasaStatus, setNasaStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [nasaError, setNasaError] = useState('');
  const [catalogDate, setCatalogDate] = useState('');
  const [earthEngineStatus, setEarthEngineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [earthEngineResult, setEarthEngineResult] = useState<EarthEngineResult | null>(null);
  const [earthEngineError, setEarthEngineError] = useState('');
  const mission = missions.find((item) => item.id === missionId)!;
  const selected = useMemo(() => {
    const get = (items: Option[], id: string) => items.find((item) => item.id === id)!;
    const ship = get(spacecraft, selections.spacecraft);
    const panel = get(panels, selections.panels);
    const battery = get(batteries, selections.batteries);
    const radio = get(comms, selections.comms);
    const instrument = get(instruments, selections.instrument);
    const rocket = rockets.find((item) => item.id === selections.rocket)!;
    return { ship, panel, battery, radio, instrument, rocket };
  }, [selections]);
  const resources: Resources = {
    budget: mission.budget - selected.ship.cost - selected.panel.cost - selected.battery.cost - selected.radio.cost - selected.instrument.cost - selected.rocket.cost,
    mass: selected.ship.mass + selected.panel.mass + selected.battery.mass + selected.radio.mass + selected.instrument.mass,
    power: selected.ship.power + selected.panel.power + selected.battery.power - selected.radio.power - selected.instrument.power,
    fuel: selected.rocket.fuel,
    range: selected.radio.range ?? 0,
  };
  const update = (key: keyof typeof selections, value: string) => setSelections((current) => ({ ...current, [key]: value }));

  async function searchNasaCatalog() {
    setNasaStatus('loading');
    setNasaError('');
    try {
      let datasets = nasaCatalog;
      if (!datasets) {
        const response = await fetch(import.meta.env.PROD ? `${import.meta.env.BASE_URL}nasa-catalog.json` : '/nasa-catalog');
        if (!response.ok) throw new Error(`NASA catalog returned HTTP ${response.status}.`);
        const catalog: unknown = await response.json();
        if (typeof catalog !== 'object' || catalog === null || !('dataset' in catalog) || !Array.isArray(catalog.dataset)) {
          throw new Error('NASA catalog response did not contain a dataset list.');
        }
        datasets = catalog.dataset as NasaDataset[];
        setNasaCatalog(datasets);
        if ('generatedAt' in catalog && typeof catalog.generatedAt === 'string') setCatalogDate(catalog.generatedAt);
      }

      const terms = nasaQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const seenTitles = new Set<string>();
      const matches = datasets
        .map((dataset) => {
          const title = (dataset.title ?? '').toLowerCase();
          const description = (dataset.description ?? '').toLowerCase();
          const rank = terms.reduce((total, term) => total + (title.includes(term) ? 3 : 0) + (description.includes(term) ? 1 : 0), 0);
          return { dataset, rank };
        })
        .filter((result) => result.rank > 0 && recordLink(result.dataset))
        .sort((a, b) => b.rank - a.rank)
        .filter(({ dataset }) => {
          const title = dataset.title?.trim().toLowerCase();
          if (!title || seenTitles.has(title)) return false;
          seenTitles.add(title);
          return true;
        })
        .slice(0, 6)
        .map((result) => result.dataset);
      setNasaResults(matches);
      setNasaStatus('loaded');
    } catch (error) {
      setNasaStatus('error');
      setNasaError(error instanceof Error ? error.message : 'Unable to load NASA dataset metadata.');
    }
  }

  async function loadEarthEngineObservation() {
    setEarthEngineStatus('loading');
    setEarthEngineError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/earth-engine/ndvi');
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
          ? result.error
          : `Earth Engine service returned HTTP ${response.status}.`;
        throw new Error(message);
      }
      if (typeof result !== 'object' || result === null || !('ndvi' in result) || !('imageCount' in result)) {
        throw new Error('Earth Engine returned an unexpected response.');
      }
      setEarthEngineResult(result as EarthEngineResult);
      setEarthEngineStatus('ready');
    } catch (error) {
      setEarthEngineStatus('error');
      setEarthEngineError(error instanceof Error && error.name === 'TypeError'
        ? 'Earth Engine service is not running. Follow the setup steps below to enable live observations.'
        : error instanceof Error ? error.message : 'Unable to load an Earth Engine observation.');
    }
  }

  function runMission() {
    const problems: string[] = [];
    const objectives: string[] = [];
    let score = 100;
    const canLaunch = resources.budget >= 0 && resources.mass <= selected.rocket.lift;
    const canReach = canLaunch && resources.fuel >= mission.fuel;
    const hasPower = resources.power >= mission.power;
    const eventType = Math.floor(Math.random() * 3);
    const stormRisk = canReach && eventType === 0 && selected.battery.power < 30;
    const event = !canLaunch ? 'Launch was postponed; no flight event occurred.'
      : !canReach ? 'The spacecraft exhausted its fuel before reaching the destination.'
      : eventType === 0 ? (stormRisk ? 'A solar storm interrupted science operations.' : 'A solar storm grazed the spacecraft. Battery reserves held.')
      : eventType === 1 ? 'A weak signal window cost 4% of collected data.'
      : 'A micrometeorite impact caused a small attitude correction.';
    const instrumentMatch = selected.instrument.id === mission.instrument;
    if (resources.budget < 0) { problems.push(`Your build is ${Math.abs(resources.budget)}k credits over budget.`); score -= 24; }
    if (resources.mass > selected.rocket.lift) { problems.push(`Your spacecraft is ${resources.mass - selected.rocket.lift} kg too heavy for the ${selected.rocket.name.toLowerCase()}.`); score -= 38; }
    if (!hasPower) { problems.push(`Your power system is short by ${mission.power - resources.power} W for this mission.`); score -= 24; }
    if (resources.fuel < mission.fuel) { problems.push(`The mission needs ${mission.fuel - resources.fuel} more fuel units to reach ${mission.target}.`); score -= 32; }
    if (resources.range < mission.range) { problems.push(`Your antenna reaches ${formatRange(resources.range)}, but ${mission.target} is ${formatRange(mission.range)} away.`); score -= 28; }
    if (!instrumentMatch) { problems.push(`${mission.science}; ${selected.instrument.name.toLowerCase()} returns only partial science.`); score -= 15; }
    if (stormRisk) { problems.push('The solar storm drained a small battery reserve and paused science operations.'); score -= 8; }
    if (canLaunch) objectives.push('Launch window secured and spacecraft reached transfer orbit');
    if (canReach) objectives.push(`${mission.target} trajectory completed`);
    if (canReach && hasPower) objectives.push('Science payload stayed online');
    if (canReach && hasPower && instrumentMatch) objectives.push(mission.science);
    const dataRecovered = canReach ? Math.round(100 * Math.min(1, resources.range / mission.range) * (hasPower ? 1 : 0.65) * (instrumentMatch ? 1 : 0.6) * (stormRisk ? 0.9 : 1) * (eventType === 1 ? 0.96 : 1)) : 0;
    if (dataRecovered === 100) objectives.push('Full data package received');
    const success = Math.max(0, Math.min(canReach ? 100 : 49, score - (canReach && eventType === 1 ? 4 : 0)));
    setReport({ success, data: dataRecovered, objectives, problems, event, remaining: { ...resources, fuel: Math.max(0, resources.fuel - mission.fuel) } });
  }

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark"><Satellite size={19} /></div><div><strong>MISSION CONTROL</strong><span>FLIGHT DESIGN LAB / 2026</span></div></div><div className="top-status"><span className="status-dot" /> SIMULATION ONLINE <span className="divider" /> <Clock3 size={14} /> T-00:14:32</div></header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow"><Sparkles size={14} /> MISSION DESIGNER / FLIGHT 001</p><h1>Make the impossible<br /><em>operational.</em></h1><p className="hero-sub">Every kilogram is a decision. Every watt tells a story.<br />Assemble a spacecraft that can bring the science home.</p></div><div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="planet" /><div className="satellite-dot">✦</div></div></section>
    <div className="workspace"><section className="config-panel"><div className="section-heading"><div><p className="kicker">01 / FLIGHT PLAN</p><h2>Choose your mission</h2></div><span className="step">STEP 01 <ChevronRight size={13} /> 03</span></div><div className="mission-grid">{missions.map((item) => <button key={item.id} className={`mission-card ${missionId === item.id ? 'active' : ''}`} style={{ '--accent': item.accent } as React.CSSProperties} onClick={() => { setMissionId(item.id); setReport(null); setNasaQuery(missionSearchTerms[item.id]); setNasaStatus('idle'); setNasaResults([]); }}><div className="mission-card-top"><span className="mission-icon">{item.icon}</span><span className="mission-tag">{item.tag}</span>{missionId === item.id && <Check size={15} className="selected-check" />}</div><h3>{item.name}</h3><p>{item.description}</p><div className="mission-meta"><span><Target size={13} /> {item.distance}</span><span><Clock3 size={13} /> {item.time}</span></div></button>)}</div>
      <div className="requirements"><strong>MISSION REQUIREMENTS</strong><span>Budget: {mission.budget}k · Power: {mission.power} W net · Fuel: {mission.fuel} u · Comms: {formatRange(mission.range)}</span><span>Primary science: {mission.science}</span><small>Net power = bus + solar + battery reserve − communications − instrument. Simulation values are illustrative.</small></div>
      <div className="section-heading build-heading"><div><p className="kicker">02 / SPACECRAFT CONFIGURATION</p><h2>Build your spacecraft</h2></div><span className="step">STEP 02 <ChevronRight size={13} /> 03</span></div>
      <div className="build-grid"><ChoiceGroup title="Spacecraft bus" icon={<Cpu size={16} />} options={spacecraft} value={selections.spacecraft} onChange={(value) => update('spacecraft', value)} /><ChoiceGroup title="Solar panels" icon={<Zap size={16} />} options={panels} value={selections.panels} onChange={(value) => update('panels', value)} /><ChoiceGroup title="Battery system" icon={<BatteryCharging size={16} />} options={batteries} value={selections.batteries} onChange={(value) => update('batteries', value)} /><ChoiceGroup title="Communications" icon={<Radio size={16} />} options={comms} value={selections.comms} onChange={(value) => update('comms', value)} /><ChoiceGroup title="Science payload" icon={<Telescope size={16} />} options={instruments} value={selections.instrument} onChange={(value) => update('instrument', value)} /></div>
      <div className="section-heading rocket-heading"><div><p className="kicker">03 / LAUNCH VEHICLE</p><h2>Choose your rocket</h2></div><span className="step">STEP 03 <Check size={13} /></span></div><div className="rocket-list">{rockets.map((rocket) => <button key={rocket.id} className={`rocket-row ${selections.rocket === rocket.id ? 'active' : ''}`} onClick={() => update('rocket', rocket.id)}><span className="rocket-visual">⌁</span><span className="rocket-name"><strong>{rocket.name}</strong><small>{rocket.description}</small></span><span className="rocket-stat"><b>{rocket.lift.toLocaleString()}</b> kg lift</span><span className="rocket-stat"><b>{rocket.fuel}</b> fuel</span><span className="rocket-cost">{rocket.cost}k</span><span className="radio-dot" /></button>)}</div></section>
      <aside className="sidebar"><div className="sidebar-sticky"><div className="panel-title"><div><p className="kicker">LIVE TELEMETRY</p><h2>Mission budget</h2></div><Activity size={17} /></div><div className="budget-number"><span>$</span>{resources.budget.toLocaleString()}<small>k remaining</small></div><div className="resource-list"><Resource label="MASS" value={resources.mass} max={selected.rocket.lift} unit="kg" icon={<Crosshair size={15} />} danger={resources.mass > selected.rocket.lift} /><Resource label="NET POWER" value={resources.power} max={mission.power} unit="W" icon={<Zap size={15} />} danger={resources.power < mission.power} /><Resource label="FUEL" value={resources.fuel} max={mission.fuel} unit="u" icon={<Fuel size={15} />} danger={resources.fuel < mission.fuel} /><Resource label="COMMS RANGE" value={resources.range} max={mission.range} unit="km" icon={<Radio size={15} />} danger={resources.range < mission.range} /></div><div className={`target-readout ${resources.range >= mission.range ? 'good' : ''}`}><Globe2 size={16} /><div><span>DESTINATION</span><strong>{mission.target}</strong></div><span className="readout-state">{resources.range >= mission.range ? 'IN RANGE' : 'OUT OF RANGE'}</span></div><button className="launch-button" onClick={runMission}><span>RUN MISSION</span><ChevronRight size={18} /></button><p className="launch-note"><Info size={13} /> Your design will be simulated with one variable event.</p></div></aside></div>
    <section className="source-panel" aria-labelledby="nasa-resources-heading">
      <div className="section-heading"><div><p className="kicker">04 / MISSION RESEARCH</p><h2 id="nasa-resources-heading">NASA data & Earth observation</h2></div><Globe2 size={18} /></div>
      <div className="source-grid">
        <article className="source-card">
          <div className="source-card-heading"><Satellite size={18} /><div><h3>NASA Open Data</h3><p>Search real dataset metadata from NASA’s public catalog.</p></div></div>
          <form className="catalog-search" onSubmit={(event) => { event.preventDefault(); void searchNasaCatalog(); }}>
            <label className="sr-only" htmlFor="nasa-query">Search NASA datasets</label>
            <input id="nasa-query" value={nasaQuery} onChange={(event) => setNasaQuery(event.target.value)} placeholder="Search NASA datasets" />
            <button type="submit" disabled={nasaStatus === 'loading' || !nasaQuery.trim()}>{nasaStatus === 'loading' ? 'SEARCHING…' : 'SEARCH CATALOG'}</button>
          </form>
          {nasaStatus === 'error' && <p className="source-message source-error"><TriangleAlert size={15} /> {nasaError} You can also browse data.nasa.gov directly.</p>}
          {nasaStatus === 'loaded' && nasaResults.length === 0 && <p className="source-message">No matching records in the catalog. Try a broader keyword.</p>}
          {nasaStatus === 'loaded' && nasaResults.length > 0 && <ul className="dataset-list">{nasaResults.map((dataset, index) => {
            const recordUrl = recordLink(dataset);
            const dataUrl = distributionLink(dataset);
            return <li key={`${dataset.identifier ?? dataset.title ?? 'dataset'}-${index}`}>
              <a href={recordUrl} target="_blank" rel="noreferrer">{dataset.title || 'Untitled NASA dataset'} <ChevronRight size={14} /></a>
              <p>{truncate(dataset.description || 'NASA catalog record; description not provided.', 220)}</p>
              {dataUrl && <a className="dataset-download" href={dataUrl} target="_blank" rel="noreferrer">Open dataset distribution</a>}
            </li>;
          })}</ul>}
          <p className="source-footnote">These are catalog records and links to source data, not copies of the datasets. {import.meta.env.PROD ? `Search uses NASA catalog metadata${catalogDate ? ` retrieved or generated ${catalogDate}` : ''}.` : 'Search uses the current catalog.'} Catalog: <a href={NASA_CATALOG_URL} target="_blank" rel="noreferrer">data.nasa.gov/data.json</a>.</p>
        </article>
        <article className="source-card software-card">
          <div className="source-card-heading"><Cpu size={18} /><div><h3>NASA open-source software</h3><p>Browse NASA’s official software catalog for tools related to this mission.</p></div></div>
          <a className="source-link-button" href="https://code.nasa.gov/" target="_blank" rel="noreferrer">Browse the NASA software catalog <ChevronRight size={16} /></a>
          <p className="source-footnote">NASA’s catalog provides project descriptions, release types, licenses, and source links. This game links to the official catalog; it does not call an undocumented API.</p>
        </article>
        <article className="source-card earth-observation-card">
          <div className="source-card-heading"><Globe2 size={18} /><div><h3>Earth Engine vegetation observation</h3><p>Live mean NDVI for an Amazon-area sample region using NASA Terra MODIS.</p></div></div>
          <div className="dataset-badge">MODIS/061/MOD13Q1 · NDVI · 250 m · 16-day composites</div>
          {['localhost', '127.0.0.1'].includes(window.location.hostname) ? <button className="source-link-button" type="button" onClick={() => void loadEarthEngineObservation()} disabled={earthEngineStatus === 'loading'}>
            {earthEngineStatus === 'loading' ? 'QUERYING EARTH ENGINE…' : 'LOAD LIVE OBSERVATION'} <ChevronRight size={16} />
          </button> : <p className="source-message">Live observations require the local app and optional Python service. GitHub Pages cannot run the service.</p>}
          {earthEngineStatus === 'error' && <p className="source-message source-error"><TriangleAlert size={15} /> {earthEngineError}</p>}
          {earthEngineResult && earthEngineStatus === 'ready' && <div className="ndvi-result">
            <span>MEAN NDVI</span><strong>{earthEngineResult.ndvi.toFixed(3)}</strong>
            <p>{earthEngineResult.imageCount} real composites · {earthEngineResult.startDate} to {earthEngineResult.endDate}<br />{earthEngineResult.region}</p>
          </div>}
          <p className="source-footnote">Values are calculated live from the Earth Engine collection and scaled using the dataset’s 0.0001 NDVI factor. <a href={EARTH_ENGINE_DATASET_URL} target="_blank" rel="noreferrer">Dataset documentation</a> · <a href="https://code.earthengine.google.com/" target="_blank" rel="noreferrer">Earth Engine Code Editor</a>.</p>
          <details className="setup-details"><summary>Set up live Earth Engine access</summary><ol>
            <li>Register a Google Cloud project for Earth Engine and enable the Earth Engine API.</li>
            <li>Install the Python client: <code>python -m pip install earthengine-api</code>.</li>
            <li>Authenticate: <code>earthengine authenticate</code>.</li>
            <li>Set <code>EARTH_ENGINE_PROJECT</code> to your registered project ID, then run <code>python earth_engine_server.py</code> in the project folder.</li>
          </ol></details>
        </article>
      </div>
    </section>
    {report && <ReportModal report={report} mission={mission} onClose={() => setReport(null)} onRetry={() => setReport(null)} />}
  </main>;
}

function ChoiceGroup({ title, icon, options, value, onChange }: { title: string; icon: React.ReactNode; options: Option[]; value: string; onChange: (value: string) => void }) { return <div className="choice-group"><div className="choice-label">{icon}<span>{title}</span></div><div className="choice-options">{options.map((option) => <button key={option.id} aria-pressed={value === option.id} className={value === option.id ? 'selected' : ''} onClick={() => onChange(option.id)}><span><strong>{option.name}</strong><small>{option.detail} · {option.mass} kg · {title === 'Communications' || title === 'Science payload' ? '−' : '+'}{option.power} W</small></span><em>+{option.cost}k</em>{value === option.id && <Check size={14} />}</button>)}</div></div>; }
function truncate(text: string, limit: number) { return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text; }
function Resource({ label, value, max, unit, icon, danger }: { label: string; value: number; max: number; unit: string; icon: React.ReactNode; danger: boolean }) { const percent = Math.min(100, Math.max(0, value / max * 100)); return <div className={`resource ${danger ? 'danger' : ''}`}><div className="resource-head"><span>{icon}{label}</span><strong>{value.toLocaleString()} <small>{unit}</small></strong></div><div className="meter"><span style={{ width: `${percent}%` }} /></div></div>; }
function ReportModal({ report, mission, onClose, onRetry }: { report: Report; mission: typeof missions[number]; onClose: () => void; onRetry: () => void }) { return <div className="modal-backdrop"><div className="report-modal"><button className="close-report" onClick={onClose}>×</button><div className="report-top"><span className="report-orbit">{report.problems.length === 0 ? <ShieldCheck size={26} /> : <TriangleAlert size={26} />}</span><div><p className="kicker">POST-FLIGHT ANALYSIS / {mission.target.toUpperCase()}</p><h2>{report.problems.length === 0 ? 'Mission accomplished.' : 'Mission needs a redesign.'}</h2></div><div className={`score ${report.success >= 70 ? 'positive' : ''}`}><strong>{report.success}%</strong><span>SUCCESS</span></div></div><div className="report-grid"><div><h3><Check size={15} /> Objectives</h3><ul>{report.objectives.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3><CloudLightning size={15} /> Mission event</h3><p className="event-copy">{report.event}</p><h3><Telescope size={15} /> Science return</h3><p className="data-readout">{report.data}<small>% DATA RECOVERED</small></p></div></div><div className={`problem-box ${report.problems.length === 0 ? 'no-problems' : ''}`}><h3>{report.problems.length > 0 ? <TriangleAlert size={15} /> : <Check size={15} />} Flight notes</h3>{report.problems.length > 0 ? report.problems.map((problem) => <p key={problem}>{problem}</p>) : <p>No critical issues detected.</p>}</div><div className="report-actions"><button className="secondary-button" onClick={onRetry}><RotateCcw size={15} /> ADJUST DESIGN</button><button className="launch-button" onClick={onClose}>BACK TO CONTROL <ChevronRight size={17} /></button></div></div></div>; }
function formatRange(value: number) { return value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M km` : `${Math.round(value / 1_000)}k km`; }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
