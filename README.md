# Calendario Calasancio (prueba local)

Aplicación web sencilla en HTML, CSS y JavaScript. Un pequeño servidor Python hace de intermediario entre el navegador y la web de ECMadrid para evitar problemas de CORS.

## Requisitos

- Python 3.9 o superior.
- Conexión a Internet.

No necesita instalar paquetes externos: utiliza únicamente la biblioteca estándar de Python.

## Ejecutar en Linux, macOS o Windows

1. Descomprime el ZIP.
2. Abre una terminal dentro de la carpeta `calasancio_calendar`.
3. Ejecuta:

   ```bash
   python3 app.py
   ```

   En Windows puede ser:

   ```powershell
   py app.py
   ```

4. Abre en el navegador:

   http://127.0.0.1:8000

Pulsa el botón ↻ para volver a consultar el calendario.

## Qué consulta

- Deporte: `2`
- Competición: `118`
- Categoría: `330`
- Grupo: `201`
- Equipo: `514` (Calasancio)

Primero consulta las jornadas disponibles y después solicita los partidos de cada jornada filtrando por el identificador del equipo.

## Nota

Esta versión es para probar en tu propio ordenador. El servidor Python local actúa como proxy porque el navegador puede bloquear las peticiones directas a ECMadrid por CORS. Para que todo el equipo la use desde sus móviles, habrá que alojar este pequeño servidor en Internet o convertir la solución en una PWA con un backend/proxy accesible públicamente. Una PWA no elimina por sí sola las restricciones CORS.
