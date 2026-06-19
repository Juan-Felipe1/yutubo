# Yutubo — Descargador de Videos

**Version:** 1.0
**Status:** Draft
**Owner:** juan@operativati.com.br
**Date:** 2026-06-19

---

## Stakeholders

- Juan (Product Owner / Developer)

---

## Problem Statement

Los usuarios que consumen contenido en plataformas como YouTube, Facebook, Instagram y TikTok necesitan descargar videos y audio para uso offline, pero las herramientas existentes son complejas, llenas de anuncios, requieren instalación o tienen interfaces confusas. No existe una solución web simple, limpia y rápida que soporte múltiples plataformas en un solo lugar con control granular sobre formato y calidad.

---

## Goals

- Proveer una interfaz minimalista y rápida para descargar videos y audio de las 4 plataformas principales
- Permitir elección de formato (MP4 / MP3) y calidad antes de descargar
- Soportar tanto videos individuales como playlists completas con selección granular
- Funcionar como un componente DC embebible y reutilizable (no solo como app standalone)
- Ofrecer feedback visual claro del progreso de descarga

## Non-Goals

- No es un gestor de descargas (no gestiona historial, cola, etc.)
- No es una plataforma social ni un reproductor de video integrado
- No almacena contenido en servidor propio
- No ofrece funcionalidades de conversión avanzada (recorte, edición)

---

## User Stories

### 1. Usuario que quiere descargar un video de YouTube

**As a** usuario casual,
**I want** pegar un enlace de YouTube y descargar el video en MP4 en la calidad que elija,
**So that** pueda verlo sin internet cuando quiera.

**Priority:** P0

### 2. Usuario que quiere descargar solo el audio

**As a** oyente de podcasts o música,
**I want** extraer el audio de un video como MP3 con control de bitrate,
**So that** pueda escucharlo en cualquier reproductor de audio.

**Priority:** P0

### 3. Usuario que quiere descargar una playlist completa

**As a** usuario que sigue cursos o series,
**I want** seleccionar cuáles videos de una playlist descargar (todos o un subconjunto),
**So that** no tenga que procesar cada enlace individualmente.

**Priority:** P1

### 4. Usuario en mobile

**As a** usuario de smartphone,
**I want** usar la misma interfaz en pantalla pequeña sin pérdida de funcionalidad,
**So that** pueda descargar contenido desde cualquier dispositivo.

**Priority:** P1

### 5. Desarrollador integrando el componente

**As a** desarrollador,
**I want** usar el descargador como un componente DC configurable (accentColor, defaultFormat),
**So that** pueda embebido en otras aplicaciones sin reescribir la UI.

**Priority:** P2

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | El usuario puede seleccionar entre 4 plataformas: YouTube, Facebook, Instagram, TikTok | P0 |
| FR-02 | El usuario puede ingresar o pegar un enlace URL de la plataforma seleccionada | P0 |
| FR-03 | El sistema valida el enlace y detecta si es video individual o playlist | P0 |
| FR-04 | Para videos individuales, el sistema muestra título, canal, duración y metadata | P0 |
| FR-05 | Para playlists, el sistema muestra título, canal, cantidad de videos y lista con miniaturas y duración | P1 |
| FR-06 | El usuario puede seleccionar/deseleccionar videos individuales de una playlist | P1 |
| FR-07 | El usuario puede usar "Seleccionar todos / Deseleccionar todos" en playlists | P1 |
| FR-08 | El usuario puede elegir formato: MP4 (video) o MP3 (audio) | P0 |
| FR-09 | Para MP4, las opciones de calidad son: 2160p, 1440p, 1080p, 720p, 480p, 360p | P0 |
| FR-10 | Para MP3, las opciones de calidad son: 320 kbps, 256 kbps, 192 kbps, 128 kbps | P0 |
| FR-11 | El sistema muestra el tamaño estimado del archivo según calidad seleccionada | P1 |
| FR-12 | Una línea de resumen muestra formato, calidad y (si playlist) cuántos videos seleccionados | P1 |
| FR-13 | El botón de descarga está deshabilitado si ningún video de playlist está seleccionado | P1 |
| FR-14 | Durante la descarga se muestra barra de progreso con porcentaje | P0 |
| FR-15 | Al completar la descarga se muestra confirmación con opción de iniciar otra descarga | P0 |
| FR-16 | El usuario puede volver a la selección de plataforma en cualquier momento | P0 |
| FR-17 | El componente acepta props configurables: `accentColor` y `defaultFormat` | P2 |

### FR-03: Acceptance Criteria

- [ ] URL con patrón `youtu.be`, `youtube.com/watch`, `youtube.com/playlist` es reconocida como válida
- [ ] URL con `list=` o `playlist` en la ruta detecta modo playlist
- [ ] URL inválida muestra mensaje de error inline sin bloquear el campo
- [ ] La validación ocurre al presionar Enter o el botón "Analizar"

### FR-09/FR-10: Acceptance Criteria

- [ ] Las opciones de calidad cambian automáticamente al cambiar de MP4 a MP3
- [ ] Al cambiar formato, la calidad por defecto se resetea a la más alta disponible (1080p / 320 kbps)
- [ ] La opción seleccionada está visualmente distinguida (fondo oscuro)

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | La validación de URL debe ser percibida como inmediata | < 1s (UI feedback) |
| Responsiveness | La UI debe funcionar en dispositivos desde 320px de ancho | 100% de breakpoints mobile |
| Accessibility | El componente debe ser navegable por teclado | Enter para analizar, Tab para campos |
| Embeddability | El componente DC debe funcionar embebido en cualquier host que provea React | Sin dependencias externas adicionales |
| Branding | El color accent debe ser configurable y aplicarse consistentemente en todos los elementos interactivos | Prop `accentColor` aplicada a botones, checkboxes, barra de progreso |
| UX | La interfaz no debe mostrar anuncios ni elementos distractores | 0 elementos publicitarios |
| Legibility | Todos los textos deben ser legibles en fondos claros | Ratio de contraste WCAG AA |

---

## Architecture Overview

### Stack Actual (Prototipo)

```
Descargador.dc.html          ← Componente DC (plantilla + lógica)
support.js (dc-runtime)      ← Runtime reactivo compilado desde dc-runtime/src/*.ts
```

### Stack Objetivo (Producción)

```
Frontend (DC Component)
├── Descargador.dc.html      ← UI declarativa con sc-if / sc-for / {{ bindings }}
├── support.js               ← dc-runtime (React+ReactDOM via window globals)
└── Backend API
    ├── POST /api/analyze     ← Recibe URL → devuelve metadata (título, duración, tipo)
    ├── POST /api/download    ← Inicia descarga → devuelve stream o signed URL
    └── GET  /api/progress/:id ← Polling de progreso (o WebSocket)
```

### Estado Actual del Prototipo

| Funcionalidad | Estado |
|--------------|--------|
| Selección de plataforma | ✅ Implementado |
| Input URL + validación | ✅ Implementado (validación regex) |
| Detección video/playlist | ✅ Implementado (simulado) |
| Metadata de video | ✅ Implementado (datos hardcoded) |
| Selección de playlist | ✅ Implementado |
| Formato MP4/MP3 | ✅ Implementado |
| Selección de calidad | ✅ Implementado |
| Estimado de tamaño | ✅ Implementado |
| Barra de progreso | ✅ Implementado (simulado con interval) |
| Descarga real | ❌ Pendiente — requiere backend |
| Metadata real de API | ❌ Pendiente — datos son hardcoded |

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Tiempo para primera descarga (desde abrir la app) | N/A | < 30 segundos | MVP |
| Tasa de éxito de descarga | 0% (simulado) | > 95% | Post-MVP |
| Plataformas soportadas funcionales | 0 (simulado) | 4 (YT, FB, IG, TT) | Post-MVP |
| Tamaño del bundle (support.js) | ~atual | < 50 KB gzip | MVP |
| Uso en mobile (% sesiones) | N/A | > 40% | Post-MVP |

---

## Milestones

### M1 — Prototipo UI Completo

Interfaz completa como componente DC con todos los estados visuales implementados.

**Deliverables:**
- `Descargador.dc.html` con todos los estados (plataforma, video, playlist, descargando, done)
- `support.js` (dc-runtime compilado)
- Storybook / preview DC funcional

### M2 — Backend MVP (YouTube only)

Backend que procesa URLs reales de YouTube.

**Deliverables:**
- API `/analyze` que extrae metadata real via yt-dlp o equivalente
- API `/download` que genera descarga real en formato/calidad elegida
- Integración del componente DC con el backend

### M3 — Multi-plataforma

Extensión del backend a Facebook, Instagram y TikTok.

**Deliverables:**
- Soporte completo a las 4 plataformas en backend
- Manejo de autenticación / cookies para contenido privado (si aplica)
- Rate limiting y protección de abuso

### M4 — Producción

Deploy y hardening.

**Deliverables:**
- CDN para assets estáticos
- Logging y monitoreo
- Términos de uso y aviso de copyright (ya presente en UI)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| APIs de plataformas bloquean scraping/descarga | Alto | Usar yt-dlp (mantenido activamente), monitorear cambios |
| Problemas legales por descarga de contenido con copyright | Alto | Aviso de copyright visible; no almacenar contenido en servidor; uso personal only |
| Sobrecarga del servidor con descargas simultáneas | Medio | Queue con límite de concurrencia, timeouts agresivos |
| Facebook/Instagram requieren autenticación para descarga | Medio | Documentar limitaciones; ofrecer fallback manual |
| dc-runtime no tiene soporte oficial a largo plazo | Bajo | El runtime es propio/controlado; el código fuente está disponible |

---

## Open Questions

- [ ] ¿Se necesita autenticación de usuario o el servicio es público/anónimo?
- [ ] ¿Cuál es el límite de tamaño de archivo aceptable (para playlists largas)?
- [ ] ¿Se almacenan temporalmente los archivos en servidor o se streameán directo al cliente?
- [ ] ¿Facebook e Instagram requieren cookies del usuario para funcionar?
- [ ] ¿Se monetiza el servicio (ads, freemium, suscripción)?
- [ ] ¿El componente DC se distribuye como open source o es privado?

---

**Generated by:** Orion (AIOX Master) — análisis de `Descargador.dc.html`
**Template:** prd.hbs v2.0
**AIOX Version:** Synkra AIOX v2.0
