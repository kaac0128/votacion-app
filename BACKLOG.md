# Backlog — votacion-app

Spec confirmado (grilling completo). Orden de entrega: cada épica termina con algo demostrable.
Stack: Next.js (App Router) + Supabase (Postgres, Auth custom, Realtime) + Vercel. UI en español, estilo gamer, responsive mobile-first.

---

## Épica 0 — Infra inicial

- [x] **0.1** Scaffold Next.js (App Router, TypeScript, Tailwind) en el repo. *(Next 16, Turbopack, Cache Components)*
- [ ] **0.2** Proyecto en Vercel conectado + env vars (DATABASE_URL, AUTH_SECRET).
- [ ] **0.3** Tema base gamer: dark, acentos neón, tipografía, iconos (lucide), layout mobile-first.

**Hecho cuando:** app "hola mundo" deployada en Vercel con el look base.

## Épica 1 — Base de datos y autenticación

- [x] **1.1** Esquema en Supabase *(aplicado vía MCP, fuente de verdad `db/schema.sql`)*
- [x] **1.2** Seguridad: RLS deny-all para anónimos; acceso a DB solo con el rol `votacion_app` desde la API del servidor. La regla "nadie edita votos ajenos" se enforcement en la API (no en policies de PostgREST, porque el auth es custom). Unique constraint en votes para un voto por categoría. Trigger `trg_vote_window` para el deadline. *(probado: 3/3)*
- [x] **1.3** Auth custom: registro/login/logout/me con nombre + contraseña, scrypt + JWT HS256 (solo `node:crypto`), cookie httpOnly. *(probado end-to-end: 7/7)*

**Hecho cuando:** me registro, entro con código a una sala y la sesión persiste; intento editar un voto ajeno y la DB me lo rechaza.

## Épica 2 — Salas

- [x] **2.1** Crear sala (admin): título, tema, fecha límite → genera código + link `?c=CODIGO` compartible.
- [x] **2.2** Entrar a sala con código (o pegando el código a mano). *(link compartible directo por código pendiente de página de entrada; el código se pega a mano)*
- [x] **2.3** Lista "Mis salas": activas primero, cerradas como historial solo-lectura.

**Hecho cuando:** dos cuentas distintas entran a la misma sala y se ven en la lista de miembros con su avatar. *(probado con navegador real: admin crea sala, player entra con código, ambos visibles)*

## Épica 3 — Contenido (admin)

- [x] **3.1** CRUD de categorías y objetos (título, descripción, URL imagen, inválido on/off).
- [x] **3.2** Carga masiva: pegar lista separada por saltos de línea → carrusel guiado objeto por objeto (título precargado, completar descripción/imagen). *(null = pendiente, '' = revisado; saltar guarda lo cargado)*
- [x] **3.3** Config IA por sala: clave Gemini u OpenRouter guardada en DB, **jamás viaja al navegador** (la generación corre server-side con chequeo de admin).
- [x] **3.4** Generación de descripciones con IA a partir del título + tema de la sala; el admin confirma/edita cada una en el carrusel (o regenera desde el panel).

**Hecho cuando:** pego 10 juegos, la IA llena descripciones, el admin las confirma y quedan publicadas.

## Épica 4 — Votación

- [x] **4.1** Vista por categoría: objetos con imagen, descripción y selección única (radio).
- [x] **4.2** Marcar objeto inválido: badge siempre-0 + confirmación "¿Estás seguro? Vale 0 seguro."
- [x] **4.3** Cambiar el voto hasta la fecha límite; bloqueo automático al vencer (por timestamp, no cron). *(trigger de la DB + error amigable `?err=closed`; UI considera `allow_vote_edit`)*
- [x] **4.4** Botón "aleatorio" para indecisos.
- [x] **4.5** Transparencia: ver votos ajenos de una categoría recién después de votarla; nadie edita los ajenos.

**Hecho cuando:** 4 usuarios votan desde el celular, cambian votos antes del cierre y no después.

## Épica 5 — Resultados y disputas

- [x] **5.1** Carga de resultados: admin ve la lista de objetos y marca el ganador real → el sistema asigna 10 al elegido, 0 al resto, inválido siempre 0 (aunque sea el elegido). *(página `/rooms/[id]/results`, totales en la sala)*
- [x] **5.2** Publicación: aparece a todos con "De acuerdo" / "Reportar" (en cada publicación).
- [x] **5.3** Disputas: reportes ≥50% de participantes → categoría marcada EN DISPUTA → admin corrige (nueva publicación) → ciclo se repite; **tope 3 correcciones** → FINAL como esté. *(administrador además puede cerrar/reabrir la votación)*

**Hecho cuando:** una categoría con ≥50% de reportes queda bloqueada y se corrige; a la tercera corrección queda final.

## Épica 6 — Reapertura y podio

- [x] **6.1** Reapertura de votos post-cierre: usuario solicita → apoyo ≥50% de los demás → sala reabierta para todos hasta que el admin la cierre o publique.
- [x] **6.2** Totales por participante (suma de valores de sus elecciones).
- [x] **6.3** Podio: top 3, coronita animada para el/los ganador/es, 2 empateados comparten podio.
- [x] **6.4** Desempate >2: piedra-papel-tijera con rondas simultáneas secretas, eliminación progresiva, repetir en empate total/ciclo, espectadores viendo en vivo, hasta que quede 1.

**Hecho cuando:** el podio refleja los puntos reales y un empate a 3 se resuelve con el mini juego.

## Épica 7 — Día de resultados (Kahoot-style)

- [x] **7.1** Pantalla de presentación del admin: botón "revelar siguiente categoría" (`/rooms/[id]/reveal`, resultados publicados quedan ocultos hasta revelarse).
- [x] **7.2** Vista de participantes en tiempo real: auto-refresh cada 4s (polling; Supabase Realtime postgrest_changes bloqueado por RLS deny-all — mismo efecto para 4 personas). Barra de puntos animada + corona.
- [x] **7.3** Resumen final para los que no estuvieron conectados (historial de sala cerrada + resultados revelados visibles).

**Hecho cuando:** dos conectados ven los puntos subir en vivo y un tercero que entra después ve solo el resumen.

## Épica 8 — Pulido

- [ ] **8.1** Responsive fino (votante y admin desde el celular).
- [ ] **8.2** Animaciones e iconos de todas las pantallas.
- [ ] **8.3** Estados vacíos, errores y mensajes de carga.

**Hecho cuando:** la app se usa completa desde un teléfono sin scroll horizontal ni botones inalcanzables.

---

Fuera de alcance (explícito): manejo de dinero/pote, subida de archivos (imágenes siempre por URL o pack), emails, recuperaciones de contraseña (con 4 amigos se re-hace la cuenta).
