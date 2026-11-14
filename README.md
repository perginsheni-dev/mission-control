# Mission Control

Mission Control is an interactive space-mission design game. Choose a mission to the Moon, Mars, an asteroid, or Earth orbit, then configure a spacecraft and launch vehicle. Run the simulation to see how your design affects budget, mass, power, fuel, communications range, and science results.

## Technologies

- **React** builds the interactive user interface.
- **TypeScript** adds static types to the frontend code.
- **Vite** runs the local development server and builds the frontend.
- **CSS** styles the application.
- **Lucide React** provides interface icons.
- **NASA Open Data** provides searchable metadata from NASA's public dataset catalog.
- **Python** runs an optional local service for Earth observation requests.
- **Google Earth Engine** calculates live NDVI observations from the MODIS dataset when configured.

## Run locally

1. Install Node.js 20 or newer.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL shown by Vite (normally `http://localhost:5173/`).

For the production server, run `npm run build` followed by `npm start`.
The server reads `PORT` when set and otherwise listens on port 3000. It streams
the current NASA catalog on request; the catalog is large and may take time to load.

## Gameplay and research

Choose a Moon, Mars, asteroid, or Earth-observation mission; configure spacecraft components and a launch vehicle; then run the simulation. Live telemetry reports budget, mass, power, fuel, and communications range. Mission results show completed objectives, data recovered, a variable event, and design problems.

Mission requirements and component values are illustrative game rules, not engineering predictions. Net power combines bus, solar, and battery contributions and subtracts communications and instrument demand. Launch requires a budget and lift capacity; reaching the destination requires enough fuel. Power, the selected instrument, communications range, and the random event affect the recovered science.

The NASA Open Data panel searches metadata from `https://data.nasa.gov/data.json` and links to the catalog record and any available source distribution. It loads the full catalog only when you search; this catalog is large and the first search may take time. The NASA software panel links to the official `https://code.nasa.gov` catalog; it does not depend on an undocumented API.

## Publish on Render

Create a web service using this repository, with `npm install && npm run build`
as the build command and `npm start` as the start command. Render supplies the
port automatically. The Earth Engine Python service is available locally, not
from the published site.

## Optional live Google Earth Engine observation

The Earth observation panel queries the public `MODIS/061/MOD13Q1` NDVI collection over a 25 km sample region near Manaus, Brazil, for the trailing year. The result is calculated by Earth Engine at request time; it is not shown as live unless the query succeeds. The game and NASA catalog features work independently of Earth Engine.

To enable the local query service:

1. Register a Google Cloud project for Earth Engine and enable the Earth Engine API for that project.
2. Install the Python Earth Engine client: `python -m pip install earthengine-api`.
3. Authenticate the local account: `earthengine authenticate`.
4. Set `EARTH_ENGINE_PROJECT` to the registered Cloud project ID.
5. Start `python earth_engine_server.py` from this folder, then use **Load live observation** in the game.

The endpoint binds only to `127.0.0.1:8000` and accepts the local development origins. If Earth Engine is not installed, authenticated, or available for the project, the game displays a setup or request message instead of sample data.
