# Mission Control

A browser spacecraft mission-design game with a galaxy-themed control room UI.

1. Pick a mission (Moon, Mars, asteroid, Earth observation).
2. Configure panels, battery, comms, fuel and instruments; pick a launcher.
3. Watch live telemetry (budget, mass, power, fuel/delta-v, comms range).
4. Run the simulation: score, objectives, data collected, design problems and a random mission event. Adjust and retry.

## Run

```
npm install
npm start      # http://localhost:3000
npm run build  # syntax checks
npm test       # simulation tests
```

## NASA data and sources

- **NASA Open Data**: the server reads catalog metadata from https://data.nasa.gov/data.json (cached 6 h) and shows matching dataset titles, summaries and links. This is metadata, not the data itself.
- **NASA software**: matching projects from NASA's published code inventory (https://github.com/nasa/Open-Source-Catalog, `code.json`; the `code.nasa.gov/code.json` path returns 404), with a link to https://code.nasa.gov.
- **NASA Eyes on the Solar System**: links to https://eyes.nasa.gov/apps/solar-system/ (and @nasa_eyes) for exploring planets, moons, spacecraft and real trajectories; the link follows the selected mission.
- **Google Earth Engine**: mean NDVI from `MODIS/061/MOD13Q1` for a chosen region and year. Without configuration the panel shows setup guidance and the rest of the game works.

### Earth Engine setup

1. Create a Google Cloud project, enable the Earth Engine API, and register it for Earth Engine.
2. `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/earthengine,https://www.googleapis.com/auth/cloud-platform`
3. Set `EE_PROJECT` and `EE_ACCESS_TOKEN` (from `gcloud auth application-default print-access-token`; tokens expire after ~1 h) and restart the server. Credentials are never stored in code.

Game values (costs, launcher capacities) are illustrative.
