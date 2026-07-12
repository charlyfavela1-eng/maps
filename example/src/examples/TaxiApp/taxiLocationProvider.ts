/**
 * Taxi location abstraction for the taxi demo.
 *
 * The customer app only consumes `TaxiLocationProvider`, so the same UI works
 * with any source of driver positions:
 *
 * - In this demo `SimulatedTaxiLocationProvider` moves the taxi along a route
 *   with a timer, so the example runs without any backend.
 * - In a real taxi app you would implement the same interface with positions
 *   streamed from the driver's phone (the driver app watches its own GPS with
 *   `locationManager` from @rnmapbox/maps and publishes each fix through your
 *   backend: WebSocket, Firebase, MQTT, etc.).
 */
// @ts-ignore - Missing types for @turf packages
import along from '@turf/along';
// @ts-ignore - Missing types for @turf packages
import findDistance from '@turf/distance';
// @ts-ignore - Missing types for @turf packages
import { lineString, point } from '@turf/helpers';

import type { Coordinate } from './nogalesLocations';

export type TaxiPosition = {
  /** Current [longitude, latitude] of the taxi */
  coordinate: Coordinate;
  /** Heading in degrees, clockwise from north */
  heading: number;
  /** Distance already driven along the route, in km */
  distanceTraveledKm: number;
  /** Total route length in km */
  totalDistanceKm: number;
  /** Index of the last route vertex the taxi has passed */
  routeIndex: number;
};

export interface TaxiLocationProvider {
  start(): void;
  stop(): void;
}

type Options = {
  /** Route the taxi will follow */
  routeCoordinates: Coordinate[];
  /** Real-world speed used for the simulation, in km/h */
  speedKmh?: number;
  /** Simulation runs this many times faster than real time */
  timeScale?: number;
  onPosition: (position: TaxiPosition) => void;
  onArrive?: () => void;
};

const TICK_MS = 100;

function bearing(from: Coordinate, to: Coordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lng1 = toRad(from[0]);
  const lat1 = toRad(from[1]);
  const lng2 = toRad(to[0]);
  const lat2 = toRad(to[1]);
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export class SimulatedTaxiLocationProvider implements TaxiLocationProvider {
  private options: Required<Omit<Options, 'onArrive'>> &
    Pick<Options, 'onArrive'>;
  private line: GeoJSON.Feature<GeoJSON.LineString>;
  private cumulativeKm: number[];
  private totalKm: number;
  private traveledKm = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: Options) {
    this.options = {
      speedKmh: 30,
      timeScale: 10,
      ...options,
    };
    this.line = lineString(options.routeCoordinates);

    this.cumulativeKm = [0];
    this.totalKm = 0;
    for (let i = 1; i < options.routeCoordinates.length; i++) {
      this.totalKm += findDistance(
        point(options.routeCoordinates[i - 1]),
        point(options.routeCoordinates[i]),
      );
      this.cumulativeKm.push(this.totalKm);
    }
  }

  start() {
    this.stop();
    this.emit();
    this.timer = setInterval(() => {
      const { speedKmh, timeScale } = this.options;
      this.traveledKm += (speedKmh * timeScale * TICK_MS) / 3600 / 1000;

      if (this.traveledKm >= this.totalKm) {
        this.traveledKm = this.totalKm;
        this.emit();
        this.stop();
        this.options.onArrive?.();
        return;
      }
      this.emit();
    }, TICK_MS);
  }

  stop() {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private emit() {
    const current = along(this.line, this.traveledKm);
    // look slightly ahead on the route to compute the heading
    const aheadKm = Math.min(this.traveledKm + 0.02, this.totalKm);
    const ahead = along(this.line, aheadKm);

    const coordinate = current.geometry.coordinates as Coordinate;
    const aheadCoordinate = ahead.geometry.coordinates as Coordinate;

    let routeIndex = 0;
    for (let i = 0; i < this.cumulativeKm.length; i++) {
      const km = this.cumulativeKm[i];
      if (km != null && km <= this.traveledKm) {
        routeIndex = i;
      }
    }

    this.options.onPosition({
      coordinate,
      heading:
        aheadKm > this.traveledKm ? bearing(coordinate, aheadCoordinate) : 0,
      distanceTraveledKm: this.traveledKm,
      totalDistanceKm: this.totalKm,
      routeIndex,
    });
  }
}
