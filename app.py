from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPSTREAM = "https://juegosdeportivos.ecmadrid.org/Calendarios/ObtenerDatosJornadaGrupo"

BASE_PARAMS = {
    "IdDeporte": "2",
    "IdCompeticion": "118",
    "IdCategoria": "330",
    "IdGrupo": "201",
}

def fetch_json(params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{UPSTREAM}?{query}"

    start = time.time()

    print(f"[ECMADRID] Iniciando: IdJornada={params['IdJornada']}, "
          f"IdEquipo={params['IdEquipo']}", flush=True)

    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
    )

    try:
        with urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8-sig")

        data = json.loads(raw)

        if isinstance(data, str):
            data = json.loads(data)

        print(
            f"[ECMADRID] OK: IdJornada={params['IdJornada']} "
            f"en {time.time() - start:.2f}s",
            flush=True
        )

        return data

    except Exception as exc:
        print(
            f"[ECMADRID] ERROR: IdJornada={params['IdJornada']} "
            f"tras {time.time() - start:.2f}s: {repr(exc)}",
            flush=True
        )
        raise

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/calendar":
            query = parse_qs(parsed.query)
            try:
                team_id = int(query.get("teamId", ["514"])[0])
                params = {
                    **BASE_PARAMS,
                    "IdJornada": "0",
                    "IdEquipo": "0",
                }
                first = fetch_json(params)
                jornadas = first.get("jornadas", [])

                matches = []
                for jornada in jornadas:
                    jornada_params = {
                        **BASE_PARAMS,
                        "IdJornada": str(jornada["Id"]),
                        "IdEquipo": str(team_id),
                    }
                    result = fetch_json(jornada_params)
                    jornada_data = result.get("jornada") or {}
                    for match in jornada_data.get("Enfrentamientos") or []:
                        matches.append(match)

                payload = {
                    "teamId": team_id,
                    "jornadas": jornadas,
                    "matches": matches,
                    "updatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                }
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
                body = json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8")
                self.send_response(502)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return

        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)

    print(f"Calendario Calasancio disponible en el puerto {port}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()
