import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 8000
ALLOWED_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}


class EarthEngineHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if origin not in ALLOWED_ORIGINS:
            self._send_json(403, {"error": "This local endpoint only accepts requests from the Mission Control app."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        if self.path != "/api/earth-engine/ndvi":
            self._send_json(404, {"error": "Endpoint not found."})
            return

        project = os.environ.get("EARTH_ENGINE_PROJECT", "").strip()
        if not project:
            self._send_json(503, {
                "error": "Earth Engine is not configured. Register an Earth Engine Cloud project, authenticate with `earthengine authenticate`, set EARTH_ENGINE_PROJECT, and restart this server."
            })
            return

        try:
            import ee
        except ImportError:
            self._send_json(503, {
                "error": "The Earth Engine Python client is not installed. Run `python -m pip install earthengine-api`, then restart this server."
            })
            return

        try:
            ee.Initialize(project=project)
            end_date = datetime.now(timezone.utc).date()
            start_date = end_date - timedelta(days=365)
            region = ee.Geometry.Point([-60.0, -3.0]).buffer(25_000)
            collection = (
                ee.ImageCollection("MODIS/061/MOD13Q1")
                .filterBounds(region)
                .filterDate(start_date.isoformat(), end_date.isoformat())
                .select("NDVI")
            )
            image_count = int(collection.size().getInfo())
            if image_count == 0:
                self._send_json(404, {"error": "The selected region has no MODIS observations in the last year."})
                return

            scaled_ndvi = collection.mean().multiply(0.0001)
            mean_value = scaled_ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=1_000,
                maxPixels=1_000_000,
            ).get("NDVI").getInfo()
            if mean_value is None:
                self._send_json(404, {"error": "Earth Engine returned no valid NDVI pixels for the selected region and period."})
                return

            self._send_json(200, {
                "dataset": "MODIS/061/MOD13Q1",
                "ndvi": float(mean_value),
                "imageCount": image_count,
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "region": "25 km sample area near Manaus, Brazil",
            })
        except Exception:
            logging.exception("Earth Engine request failed")
            self._send_json(502, {
                "error": "Earth Engine could not complete the query. Check project registration, API access, and authentication; details are in this server's terminal."
            })

    def log_message(self, format_string, *args):
        logging.info("%s - %s", self.address_string(), format_string % args)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    server = ThreadingHTTPServer((HOST, PORT), EarthEngineHandler)
    print(f"Earth Engine endpoint listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Earth Engine endpoint.")
    finally:
        server.server_close()
