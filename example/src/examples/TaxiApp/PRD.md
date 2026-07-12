# PRD — Taxi Nogales: rastreo de taxis en tiempo real

| Campo | Valor |
| --- | --- |
| Producto | Taxi Nogales (nombre provisional) |
| Versión del documento | 1.0 |
| Fecha | 2026-07-12 |
| Estado | Borrador |
| Base técnica | React Native + `@rnmapbox/maps` (demo en `example/src/examples/TaxiApp/`) |

---

## 1. Resumen

App de taxis para la ciudad de **Nogales, Sonora** con dos aplicaciones móviles
(cliente y taxista) y un backend de posiciones en tiempo real. El diferenciador
central es la **visibilidad total del viaje**: el cliente ve en un mapa 3D dónde
viene su taxi, qué ruta sigue, cuánto falta para que llegue y, ya arriba,
cuánto falta para llegar a su destino.

## 2. Problema

Hoy el cliente que pide un taxi por teléfono o en la calle no sabe:

- si el taxi ya salió, dónde viene ni por qué calle,
- cuánto tiempo falta para que llegue,
- durante el viaje, cuánto falta para llegar al destino ni qué ruta tomará.

Esto genera incertidumbre, llamadas repetidas al sitio de taxis, esperas en la
calle y desconfianza sobre rutas más largas de lo necesario.

## 3. Objetivos

| # | Objetivo | Métrica de éxito |
| --- | --- | --- |
| O1 | El cliente siempre sabe dónde está su taxi | Posición visible con retraso < 3 s en el 95 % de los casos |
| O2 | ETA confiable | Error promedio del ETA < 20 % |
| O3 | Transparencia de ruta | Ruta visible en el 100 % de viajes con red |
| O4 | Adopción | ≥ 50 % de clientes que piden 2.º viaje en 30 días |
| O5 | Confiabilidad operativa | Crash-free sessions ≥ 99.5 % |

### No-objetivos (fuera de alcance del MVP)

- Pagos dentro de la app (los viajes se pagan en efectivo/terminal).
- Tarifas dinámicas, viajes compartidos, paquetería.
- Cobertura fuera del municipio de Nogales.
- Chat/llamadas dentro de la app (se usa el teléfono).

## 4. Usuarios

- **Cliente**: residente o visitante de Nogales; pide un taxi y quiere verlo
  llegar y seguir su viaje. Teléfono Android de gama media (mayoría) o iPhone.
- **Taxista**: conductor afiliado al sitio; activa su ubicación al iniciar
  turno y acepta viajes. Necesita una app simple que no le drene la batería.
- **Despachador/Administrador** (post-MVP): asigna viajes manualmente y
  monitorea la flota.

## 5. Historias de usuario

### Cliente

1. Como cliente, quiero **pedir un taxi** indicando mi punto de recogida
   (mi ubicación GPS o un pin en el mapa) para no tener que llamar.
2. Como cliente, quiero **ver el taxi asignado moverse en el mapa** (modelo 3D
   sobre el mapa de Nogales) para saber exactamente dónde viene.
3. Como cliente, quiero ver **la ruta que sigue el taxista hacia mí** y una
   **línea de progreso con el tiempo restante** para decidir cuándo salir.
4. Como cliente, al subirme quiero ver **la ruta al destino y el ETA**
   actualizándose durante el viaje.
5. Como cliente, quiero ver **placas, modelo del auto y nombre del taxista**
   para abordar con seguridad.
6. Como cliente, quiero recibir **notificaciones** ("tu taxi llegó",
   "estás por llegar") aunque la app esté en segundo plano.

### Taxista

7. Como taxista, quiero **activar/desactivar mi ubicación** con un botón
   (iniciar/terminar turno) para controlar cuándo estoy disponible.
8. Como taxista, quiero **recibir solicitudes de viaje** con punto de recogida
   y destino, y aceptarlas o rechazarlas.
9. Como taxista, quiero que la app **publique mi posición automáticamente**
   mientras tengo un viaje activo, sin tener que hacer nada.
10. Como taxista, quiero ver **la ruta sugerida** hacia el cliente y luego
    hacia el destino.

## 6. Requisitos funcionales

### 6.1 App Cliente

| ID | Requisito | Prioridad |
| --- | --- | --- |
| C-01 | Mapa de Nogales centrado en la ciudad (Mapbox, estilo calles) | P0 |
| C-02 | Solicitud de viaje: origen (GPS o pin) + destino (pin o búsqueda) | P0 |
| C-03 | Taxi 3D en el mapa (`Models` + `ModelLayer`), rotado según el rumbo | P0 |
| C-04 | Ruta del taxi al punto de recogida (`LineLayer`, Directions API) | P0 |
| C-05 | Progreso: tramo recorrido resaltado + barra de progreso + ETA en minutos y distancia | P0 |
| C-06 | Fase de viaje: ruta al destino + ETA recalculado periódicamente | P0 |
| C-07 | Cámara siguiendo al taxi (vista inclinada 3D) con opción de vista general | P1 |
| C-08 | Ficha del taxi asignado: placas, modelo, foto y nombre del taxista | P1 |
| C-09 | Notificaciones push de estado del viaje | P1 |
| C-10 | Historial de viajes | P2 |

### 6.2 App Taxista

| ID | Requisito | Prioridad |
| --- | --- | --- |
| T-01 | Login de taxista (cuenta dada de alta por el sitio) | P0 |
| T-02 | Botón de turno: al activarlo, publica su GPS (`locationManager` de `@rnmapbox/maps`) al backend | P0 |
| T-03 | Recepción y aceptación/rechazo de solicitudes | P0 |
| T-04 | Publicación de posición (coordenada + rumbo + velocidad) cada 2–3 s durante viaje activo, con envío en segundo plano | P0 |
| T-05 | Ruta sugerida al cliente y luego al destino | P1 |
| T-06 | Botones de estado: "Llegué", "Inicio de viaje", "Fin de viaje" | P0 |
| T-07 | Modo ahorro: menor frecuencia de GPS sin viaje activo | P2 |

### 6.3 Backend

| ID | Requisito | Prioridad |
| --- | --- | --- |
| B-01 | Canal de posiciones en tiempo real por viaje (WebSocket / Firebase Realtime DB / MQTT) | P0 |
| B-02 | Gestión de viajes: solicitud → asignación → recogida → en viaje → terminado / cancelado | P0 |
| B-03 | Asignación del taxi disponible más cercano (geoconsulta) | P1 (MVP: manual/despachador) |
| B-04 | Cálculo de rutas y ETA vía Mapbox Directions API (`driving-traffic`), recalculado con la posición real del taxi cada 30–60 s | P0 |
| B-05 | Autenticación (clientes y taxistas) y autorización por viaje: solo el cliente del viaje ve la posición de ese taxi | P0 |
| B-06 | Persistencia de viajes e historial de posiciones (auditoría de ruta) | P1 |

## 7. Flujo principal (happy path)

1. Cliente abre la app → mapa de Nogales → marca origen y destino → "Pedir taxi".
2. Backend asigna taxi disponible; cliente ve la ficha del taxi.
3. **Fase de recogida**: la app cliente muestra el taxi 3D moviéndose por la
   ruta calculada, la línea de lo recorrido, la barra de progreso y
   "llega en ~X min · Y km". El ETA se recalcula con la posición real.
4. Taxista marca "Llegué" → notificación al cliente → taxista marca
   "Inicio de viaje".
5. **Fase de viaje**: misma visualización pero hacia el destino
   ("llegas en ~X min"), con la cámara siguiendo al taxi.
6. Taxista marca "Fin de viaje" → resumen del viaje en ambas apps.

### Estados del viaje

`solicitado → asignado → taxi_en_camino → taxi_llegó → en_viaje → terminado`
(+ `cancelado` desde cualquier estado previo a `en_viaje`).

## 8. Requisitos no funcionales

- **Latencia de posición**: del GPS del taxista a la pantalla del cliente < 3 s.
- **Frecuencia de actualización**: 2–3 s en viaje activo; interpolación/animación
  en el cliente para movimiento fluido entre actualizaciones.
- **Batería (taxista)**: consumo < 8 %/hora con viaje activo.
- **Sin conexión**: si el cliente pierde red, mantener la última posición
  conocida con aviso "reconectando"; rutas de respaldo precargadas para la
  zona urbana de Nogales (offline packs de Mapbox como mejora P2).
- **Seguridad**: TLS en todo el tráfico; tokens por sesión; la posición de un
  taxi solo es visible para su viaje activo; cumplimiento LFPDPPP (datos
  personales, México).
- **Plataformas**: Android 8+ (prioridad) e iOS 15+; React Native 0.79+ con
  Nueva Arquitectura (requisito de `@rnmapbox/maps` v11).

## 9. Arquitectura técnica propuesta

```
App Taxista (RN + @rnmapbox/maps)
  └─ locationManager → publica posición ──▶ Backend (WebSocket/Firebase)
                                              │  estado del viaje + posiciones
App Cliente (RN + @rnmapbox/maps)  ◀──────────┘
  └─ TaxiLocationProvider (interfaz ya definida en la demo)
  └─ Mapbox Directions API → ruta + ETA
  └─ MapView + Camera + ModelLayer (taxi 3D) + LineLayer (ruta/progreso)
```

- La demo funcional de la vista del cliente ya existe en este repositorio:
  `example/src/examples/TaxiApp/TaxiTrackingApp.tsx`, con la interfaz
  `TaxiLocationProvider` lista para conectar posiciones reales
  (ver `taxiLocationProvider.ts` y `README.md`).
- ETA de producción: usar `routes[0].duration` de la Directions API
  recalculado con la posición real, no velocidad promedio.

## 10. Fases y entregables

| Fase | Alcance | Duración estimada |
| --- | --- | --- |
| **F0 — Prototipo** (hecho) | Demo de la vista del cliente con taxi simulado en Nogales | ✔ completado en esta rama |
| **F1 — MVP** | Apps cliente y taxista + backend de posiciones y viajes, asignación manual, requisitos P0 | 8–10 semanas |
| **F2 — Operación** | Asignación automática por cercanía, notificaciones push, ficha del taxista, historial | 4–6 semanas |
| **F3 — Escala** | Panel de despacho web, métricas de flota, offline packs, calificaciones | 6–8 semanas |

## 11. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| GPS impreciso en cañones urbanos / zona centro | ETA y posición erráticos | Suavizado + snap a la ruta (map matching de Mapbox) |
| Costo de Directions API por recálculo frecuente | Costo variable alto | Recalcular cada 30–60 s o al desviarse >50 m de la ruta |
| Consumo de batería en app taxista | Abandono de taxistas | Frecuencia adaptativa; modo ahorro sin viaje activo |
| Cobertura celular irregular | Huecos de posición | Buffer local en app taxista y reenvío al reconectar |
| Android de gama baja de los taxistas | Rendimiento del mapa 3D | La app taxista usa mapa 2D simple; el 3D solo en la del cliente |

## 12. Preguntas abiertas

1. ¿La asignación de viajes del MVP la hace un despachador humano o es automática?
2. ¿Se necesita cotizar tarifa estimada antes de confirmar el viaje?
3. ¿Los taxistas usan teléfono propio o dispositivo provisto por el sitio?
4. ¿Marca/branding del sitio de taxis y modelo 3D propio del taxi (reemplazar el `sportcar.glb` de la demo)?
5. ¿Backend preferido: Firebase (rápido de montar) o servidor propio con WebSocket (más control y menor costo a escala)?
