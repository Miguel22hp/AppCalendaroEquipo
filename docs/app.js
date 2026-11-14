
// =====================================================
// CONFIGURACIÓN ECMADRID
// =====================================================

const UPSTREAM =
  "https://juegosdeportivos.ecmadrid.org/Calendarios/ObtenerDatosJornadaGrupo";

const TEAM_ID = 514;

const BASE_PARAMS = {
  IdDeporte: "2",
  IdCompeticion: "118",
  IdCategoria: "330",
  IdGrupo: "201"
};

// =====================================================
// VARIABLES GLOBALES
// =====================================================

let matches = [];
let currentIndex = 0;

const $ = (id) => document.getElementById(id);

// =====================================================
// CONSULTAS A ECMADRID
// =====================================================

async function fetchECMadrid(params) {
  const url = new URL(UPSTREAM);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ECMadrid respondió con HTTP ${response.status}`);
  }

  let data = await response.json();

  // Por si ECMadrid devuelve un JSON dentro de un texto.
  if (typeof data === "string") {
    data = JSON.parse(data);
  }

  return data;
}

async function fetchCalendarFromECMadrid(teamId = TEAM_ID) {

  // 1. Obtener todas las jornadas.
  const first = await fetchECMadrid({
    ...BASE_PARAMS,
    IdJornada: "0",
    IdEquipo: "0"
  });

  const jornadas = first.jornadas || [];

  if (!jornadas.length) {
    throw new Error("ECMadrid no ha devuelto ninguna jornada");
  }

  // 2. Obtener los enfrentamientos de cada jornada.
  const matches = [];

  for (const jornada of jornadas) {

    const result = await fetchECMadrid({
      ...BASE_PARAMS,
      IdJornada: String(jornada.Id),
      IdEquipo: String(teamId)
    });

    const jornadaData = result.jornada || {};
    const enfrentamientos = jornadaData.Enfrentamientos || [];

    matches.push(...enfrentamientos);
  }

  // 3. Devolver los datos con la misma estructura que app.py.
  return {
    teamId,
    jornadas,
    matches,
    updatedAt: new Date().toISOString()
  };
}

// =====================================================
// FECHAS Y FORMATO
// =====================================================

function parseDate(value) {
  if (!value) return null;

  // ECMadrid devuelve fechas ISO sin zona horaria;
  // se interpretan como hora local.
  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = parseDate(value);

  if (!d) return "Fecha por confirmar";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(d).replace(".", "").toUpperCase();
}

function formatTime(value) {
  const d = parseDate(value);

  if (!d) return "--:--";

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

// =====================================================
// GOOGLE MAPS
// =====================================================

function mapsUrl(match) {
  const lat = match.Latitud || match.CampoJuego?.Latitud;
  const lon = match.Longitud || match.CampoJuego?.Longitud;

  if (lat && lon) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }

  const address = match.Campo || match.CampoJuego?.Direccion || "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// =====================================================
// RENDERIZADO DEL PARTIDO
// =====================================================

function render() {
  const match = matches[currentIndex];

  if (!match) return;

  $("roundLabel").textContent =
    `JORNADA ${match.NumeroJornada || "—"}`;

  $("positionLabel").textContent =
    `${currentIndex + 1} / ${matches.length}`;

  $("dateBadge").textContent =
    formatDate(match.FechaHora || match.FechaJornada);

  $("matchTime").textContent =
    formatTime(match.FechaHora);

  $("stateBadge").textContent =
    match.EstadoPartido || "Estado sin indicar";

  $("homeTeam").textContent =
    match.EquipoLocal || "Equipo local";

  $("awayTeam").textContent =
    match.EquipoVisitante || "Equipo visitante";

  $("homeCrest").textContent =
    (match.EquipoLocal || "L").trim().charAt(0).toUpperCase();

  $("awayCrest").textContent =
    (match.EquipoVisitante || "V").trim().charAt(0).toUpperCase();

  const homeScore = Number(match.ResultadoEquipoLocal || 0);
  const awayScore = Number(match.ResultadoEquipoVisitante || 0);

  const hasResult =
    (match.IdEstadoPartido != null &&
      Number(match.IdEstadoPartido) !== 0) ||
    homeScore !== 0 ||
    awayScore !== 0;

  $("scoreRow").hidden = !hasResult;
  $("homeScore").textContent = homeScore;
  $("awayScore").textContent = awayScore;

  const venue = match.CampoJuego || {};

  $("venueName").textContent =
    venue.Nombre || match.Campo || "Instalación no indicada";

  $("venueAddress").textContent =
    venue.Direccion || match.Campo || "Dirección no disponible";

  $("mapsLink").href = mapsUrl(match);

  $("prevBtn").disabled = currentIndex === 0;
  $("nextBtn").disabled = currentIndex === matches.length - 1;

  // Indicadores inferiores.
  $("dots").replaceChildren();

  matches.forEach((_, index) => {
    const dot = document.createElement("button");

    dot.className = `dot${index === currentIndex ? " active" : ""}`;
    dot.setAttribute("aria-label", `Ir al partido ${index + 1}`);

    dot.addEventListener("click", () => {
      currentIndex = index;
      render();
    });

    $("dots").append(dot);
  });

  // Animación de la tarjeta.
  const card = $("matchCard");

  card.style.animation = "none";

  requestAnimationFrame(() => {
    card.style.animation = "";
  });
}

// =====================================================
// NAVEGACIÓN
// =====================================================

function go(delta) {
  currentIndex = Math.max(
    0,
    Math.min(matches.length - 1, currentIndex + delta)
  );

  render();
}

// =====================================================
// CARGA DEL CALENDARIO
// =====================================================

async function loadCalendar() {
  $("status").hidden = false;
  $("status").className = "status";

  $("status").textContent =
    "Consultando los partidos de Calasancio…";

  $("calendar").hidden = true;
  $("empty").hidden = true;

  $("countPill").textContent = "Actualizando…";
  $("refreshBtn").disabled = true;

  try {
    // Consulta directa a ECMadrid, sin pasar por Python.
    const data = await fetchCalendarFromECMadrid(TEAM_ID);

    matches = (data.matches || []).sort((a, b) =>
      new Date(a.FechaHora || 0) - new Date(b.FechaHora || 0)
    );

    $("updatedAt").textContent =
      `Actualizado ${new Date(data.updatedAt).toLocaleTimeString(
        "es-ES",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )}`;

    $("countPill").textContent =
      `${matches.length} partido${matches.length === 1 ? "" : "s"}`;

    $("status").hidden = true;

    if (!matches.length) {
      $("empty").hidden = false;
      return;
    }

    currentIndex = 0;

    $("calendar").hidden = false;

    render();

  } catch (error) {
    console.error("Error cargando el calendario:", error);

    $("status").className = "status error";

    $("status").textContent =
      `No se pudo cargar el calendario: ${error.message}. Comprueba tu conexión e inténtalo de nuevo.`;

    $("countPill").textContent = "Sin conexión";

  } finally {
    $("refreshBtn").disabled = false;
  }
}

// =====================================================
// EVENTOS DE LOS BOTONES
// =====================================================

$("prevBtn").addEventListener("click", () => go(-1));
$("nextBtn").addEventListener("click", () => go(1));

$("firstBtn").addEventListener("click", () => {
  currentIndex = 0;
  render();
});

$("lastBtn").addEventListener("click", () => {
  currentIndex = matches.length - 1;
  render();
});

$("refreshBtn").addEventListener("click", loadCalendar);

// =====================================================
// NAVEGACIÓN CON TECLADO
// =====================================================

$("matchCard").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") go(-1);
  if (event.key === "ArrowRight") go(1);
});

// =====================================================
// NAVEGACIÓN TÁCTIL
// =====================================================

let touchStartX = 0;

$("trackViewport").addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

$("trackViewport").addEventListener("touchend", (event) => {
  const diff = event.changedTouches[0].clientX - touchStartX;

  if (Math.abs(diff) > 45) {
    go(diff < 0 ? 1 : -1);
  }
}, { passive: true });

// =====================================================
// SERVICE WORKER - PWA
// =====================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");

      console.log("PWA: Service Worker registrado correctamente");

    } catch (error) {
      console.error("Error registrando Service Worker:", error);
    }
  });
}

// =====================================================
// INICIO DE LA APLICACIÓN
// =====================================================

loadCalendar();