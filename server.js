// Static file server + small API proxy for NASA Open Data, NASA code catalog and Earth Engine.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const DATA_URL = 'https://data.nasa.gov/data.json';
const CODE_URL = 'https://raw.githubusercontent.com/nasa/Open-Source-Catalog/master/code.json';
const cache = {};

const inflight = {};

// data.json is ~100 MB, so allow a long timeout and share one in-flight request.
async function cached(key, url, ttlMs = 6 * 3600e3) {
  const hit = cache[key];
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  inflight[key] ??= (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(300000), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    const data = await res.json();
    cache[key] = { at: Date.now(), data };
    return data;
  })().finally(() => { delete inflight[key]; });
  return inflight[key];
}

const clip = (s, n = 320) => (s || '').replace(/\s+/g, ' ').slice(0, n) + ((s || '').length > n ? '…' : '');

function matches(text, keywords) {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

async function datasets(keywords) {
  const catalog = await cached('data', DATA_URL);
  const out = [];
  for (const d of catalog.dataset || []) {
    if (!matches(`${d.title} ${(d.keyword || []).join(' ')}`, keywords)) continue;
    const dist = (d.distribution || []).find((x) => x.downloadURL || x.accessURL);
    out.push({
      title: d.title, summary: clip(d.description), modified: d.modified,
      recordUrl: d.landingPage || null,
      dataUrl: dist ? dist.downloadURL || dist.accessURL : null,
      identifier: d.identifier,
    });
    if (out.length >= 6) break;
  }
  return { source: DATA_URL, retrievedAt: new Date(cache.data.at).toISOString(), items: out };
}

async function software(keywords) {
  const catalog = await cached('code', CODE_URL);
  const out = [];
  for (const r of catalog.releases || []) {
    if (!matches(`${r.name} ${r.description} ${(r.tags || []).join(' ')}`, keywords)) continue;
    out.push({
      name: r.name, summary: clip(r.description, 240),
      repositoryUrl: r.repositoryURL || null, license: r.permissions?.licenses?.[0]?.name || null,
    });
    if (out.length >= 6) break;
  }
  return { source: CODE_URL, retrievedAt: new Date(cache.code.at).toISOString(), items: out };
}

const REGIONS = {
  nile: { name: 'Nile Delta, Egypt', box: [30.2, 30.5, 32.2, 31.7] },
  iowa: { name: 'Iowa farmland, USA', box: [-95.5, 41.5, -92.5, 43.0] },
  amazon: { name: 'Central Amazon, Brazil', box: [-62.0, -4.0, -60.0, -2.5] },
  sahel: { name: 'Sahel, Niger', box: [2.0, 13.0, 4.0, 14.5] },
};

// Mean MODIS NDVI for a region and year. Needs EE_PROJECT and a user/service-account
// OAuth access token (EE_ACCESS_TOKEN) supplied via environment variables.
async function earthEngine(regionId, year) {
  const project = process.env.EE_PROJECT;
  const token = process.env.EE_ACCESS_TOKEN;
  if (!project || !token) {
    return { status: 'not_configured', message: 'Earth Engine is not configured. See the setup steps below.' };
  }
  const region = REGIONS[regionId];
  if (!region) return { status: 'error', message: 'Unknown region.' };
  const ee = (await import('@google/earthengine')).default;
  try {
    await new Promise((ok, fail) => {
      ee.data.setAuthToken(null, 'Bearer', token, 3600, [], () => {
        ee.initialize(null, null, ok, fail, null, project);
      });
    });
    const geom = ee.Geometry.Rectangle(region.box);
    const img = ee.ImageCollection('MODIS/061/MOD13Q1')
      .filterDate(`${year}-01-01`, `${year + 1}-01-01`).select('NDVI').mean();
    const stats = await new Promise((ok, fail) => {
      img.reduceRegion({ reducer: ee.Reducer.mean(), geometry: geom, scale: 1000, maxPixels: 1e9 })
        .evaluate((v, err) => (err ? fail(new Error(err)) : ok(v)));
    });
    if (stats.NDVI == null) return { status: 'error', message: 'Earth Engine returned no data for that region and year.' };
    return {
      status: 'ok', dataset: 'MODIS/061/MOD13Q1', datasetUrl: 'https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1',
      region: region.name, year, meanNDVI: Math.round(stats.NDVI * 0.0001 * 1000) / 1000,
      note: 'Computed live by Google Earth Engine; NDVI scale factor 0.0001 applied.',
    };
  } catch (e) {
    return { status: 'error', message: `Earth Engine request failed (${String(e.message || e).slice(0, 160)}). Check that your token is current and the project has the Earth Engine API enabled.` };
  }
}

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const kw = (url.searchParams.get('q') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
      if (url.pathname === '/api/datasets' && kw.length) return json(res, 200, await datasets(kw));
      if (url.pathname === '/api/software' && kw.length) return json(res, 200, await software(kw));
      if (url.pathname === '/api/earth-engine') {
        const year = Math.min(2024, Math.max(2001, parseInt(url.searchParams.get('year'), 10) || 2023));
        return json(res, 200, await earthEngine(url.searchParams.get('region') || 'nile', year));
      }
      if (url.pathname === '/api/regions') return json(res, 200, Object.entries(REGIONS).map(([id, r]) => ({ id, name: r.name })));
      return json(res, 404, { message: 'Not found' });
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const full = path.join(root, file);
    if (!full.startsWith(root)) return json(res, 403, { message: 'Forbidden' });
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    if (e.code === 'ENOENT') return json(res, 404, { message: 'Not found' });
    json(res, 502, { message: 'The upstream NASA service could not be reached right now.' });
  }
}).listen(PORT, () => {
  console.log(`Mission Control running at http://localhost:${PORT}`);
  cached('data', DATA_URL).catch(() => {}); // warm the cache
  cached('code', CODE_URL).catch(() => {});
});
