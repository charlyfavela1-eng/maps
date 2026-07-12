/**
 * Locations and fallback routes for the taxi demo in Nogales, Sonora (México).
 *
 * The demo first tries to fetch real driving routes from the Mapbox
 * Directions API. When that is not possible (no network / restricted token)
 * it falls back to these pre-recorded coordinates that roughly follow
 * Av. Álvaro Obregón, the main avenue of Nogales.
 */

export type Coordinate = [number, number]; // [longitude, latitude]

/** Downtown Nogales, Sonora */
export const NOGALES_CENTER: Coordinate = [-110.9428, 31.318];

/** Where the taxi starts: near the Dennis DeConcini border crossing */
export const TAXI_START: Coordinate = [-110.9394, 31.3324];

/** Where the customer is waiting for the taxi */
export const PICKUP: Coordinate = [-110.9406, 31.3145];

/** Trip destination: south Nogales */
export const DESTINATION: Coordinate = [-110.9535, 31.296];

/** Fallback route: taxi -> customer, following Av. Obregón southbound */
export const FALLBACK_ROUTE_TO_PICKUP: Coordinate[] = [
  TAXI_START,
  [-110.9398, 31.3306],
  [-110.9409, 31.3282],
  [-110.9417, 31.3254],
  [-110.9423, 31.3226],
  [-110.9428, 31.3198],
  [-110.9431, 31.317],
  [-110.9427, 31.3156],
  [-110.9415, 31.315],
  PICKUP,
];

/** Fallback route: customer -> destination */
export const FALLBACK_ROUTE_TO_DESTINATION: Coordinate[] = [
  PICKUP,
  [-110.9415, 31.315],
  [-110.9429, 31.3148],
  [-110.9436, 31.312],
  [-110.9442, 31.309],
  [-110.945, 31.306],
  [-110.9458, 31.303],
  [-110.947, 31.3005],
  [-110.949, 31.2985],
  [-110.9512, 31.297],
  DESTINATION,
];
