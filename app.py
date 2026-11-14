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
    req = Request(
        f"{UPSTREAM}?{query}",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
    )
    with urlopen(req, timeout=20) as response:
        raw = response.read().decode("utf-8-sig")
    data = json.loads(raw)
    # En algunas respuestas ASP.NET puede llegar JSON serializado dentro de una cadena.
    if isinstance(data, str):
        data = json.loads(data)
    return data

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
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("Calendario Calasancio disponible en http://127.0.0.1:8000")
    print("Pulsa Ctrl+C para detenerlo.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()
