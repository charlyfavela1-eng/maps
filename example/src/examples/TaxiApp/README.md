# Taxi App demo (Nogales, Sonora)

Demo de una app de taxis construida con `@rnmapbox/maps`, vista desde el lado
del **cliente**:

1. El cliente pide un taxi y ve en el mapa un **taxi 3D** (`Models` +
   `ModelLayer`) acercándose por la **ruta que sigue el taxista**
   (`LineLayer` azul), con la parte ya recorrida marcada en amarillo.
2. Un banner muestra **cuánto tiempo falta** (ETA), la distancia restante y
   una **línea de progreso**.
3. Al subirse, empieza el viaje: se muestra la ruta al destino y el tiempo
   estimado de llegada, con la cámara siguiendo al taxi en 3D.

Las rutas se piden a la **Mapbox Directions API** (`driving-traffic`); si no
hay red o token, se usan rutas de respaldo pregrabadas sobre la
Av. Álvaro Obregón de Nogales, Sonora (`nogalesLocations.ts`).

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `TaxiTrackingApp.tsx` | Pantalla del cliente: mapa, taxi 3D, rutas, ETA y fases del viaje |
| `taxiLocationProvider.ts` | Abstracción de la ubicación del taxi + simulador para la demo |
| `nogalesLocations.ts` | Coordenadas de Nogales y rutas de respaldo sin conexión |

## Cómo conectarlo a un taxista real

La pantalla del cliente solo consume la interfaz `TaxiLocationProvider`. Para
una app real:

1. **App del taxista**: cuando el taxista activa su ubicación, usa
   `locationManager` de `@rnmapbox/maps` para observar su GPS y publica cada
   posición (coordenada + rumbo) a tu backend (WebSocket, Firebase Realtime
   Database, MQTT, etc.).
2. **Backend**: retransmite la posición del taxi asignado al cliente del
   viaje.
3. **App del cliente**: implementa `TaxiLocationProvider` suscribiéndote a ese
   canal y llamando `onPosition(...)` con cada actualización — el resto de la
   pantalla (taxi 3D, ruta, ETA, línea de progreso) funciona igual que en la
   demo.

El ETA de producción conviene tomarlo de la respuesta de la Directions API
(`routes[0].duration`) recalculada periódicamente con la posición real del
taxi, en lugar de la estimación por velocidad promedio que usa la demo.
