import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  CircleLayer,
  type CircleLayerStyle,
  LineLayer,
  type LineLayerStyle,
  MapView,
  ModelLayer,
  type ModelLayerStyle,
  Models,
  ShapeSource,
  SymbolLayer,
  type SymbolLayerStyle,
} from '@rnmapbox/maps';
// @ts-ignore - Missing types for @turf packages
import { lineString, point } from '@turf/helpers';

import taxiModelAsset from '../../assets/sportcar.glb';

import {
  type Coordinate,
  DESTINATION,
  FALLBACK_ROUTE_TO_DESTINATION,
  FALLBACK_ROUTE_TO_PICKUP,
  NOGALES_CENTER,
  PICKUP,
  TAXI_START,
} from './nogalesLocations';
import {
  SimulatedTaxiLocationProvider,
  type TaxiPosition,
} from './taxiLocationProvider';

/**
 * The ride, as the customer sees it:
 * - idle:     the customer has not requested a taxi yet
 * - pickup:   the taxi is driving towards the customer
 * - pickedUp: the taxi arrived, waiting for the trip to start
 * - trip:     driving the customer to the destination
 * - arrived:  trip finished
 */
type RidePhase = 'idle' | 'pickup' | 'pickedUp' | 'trip' | 'arrived';

/** Average city speed used to estimate the arrival time */
const TAXI_SPEED_KMH = 30;
/** The simulation drives this many times faster than real time */
const SIMULATION_TIME_SCALE = 10;
/** Tune this if your 3D model does not face north by default */
const TAXI_MODEL_HEADING_OFFSET = 0;

const models = { taxi: taxiModelAsset as number };

async function fetchDrivingRoute(
  from: Coordinate,
  to: Coordinate,
  fallback: Coordinate[],
): Promise<Coordinate[]> {
  try {
    // imported lazily so the example still loads without a valid access token
    const { directionsClient } = await import('../../MapboxClient');
    const res = await directionsClient
      .getDirections({
        waypoints: [{ coordinates: from }, { coordinates: to }],
        profile: 'driving-traffic',
        geometries: 'geojson',
      })
      .send();
    return res.body.routes[0].geometry.coordinates;
  } catch (error) {
    console.warn(
      'TaxiTrackingApp: failed to fetch route from Mapbox Directions, using fallback route',
      error,
    );
    return fallback;
  }
}

const layerStyles: {
  route: LineLayerStyle;
  progress: LineLayerStyle;
  pickupCircle: CircleLayerStyle;
  destinationCircle: CircleLayerStyle;
  markerLabel: SymbolLayerStyle;
} = {
  route: {
    lineColor: '#1E63F0',
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: 5,
    lineOpacity: 0.85,
  },
  progress: {
    lineColor: '#FFC107',
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: 5,
  },
  pickupCircle: {
    circleRadius: 8,
    circleColor: '#2E7D32',
    circleStrokeWidth: 2,
    circleStrokeColor: '#ffffff',
  },
  destinationCircle: {
    circleRadius: 8,
    circleColor: '#C62828',
    circleStrokeWidth: 2,
    circleStrokeColor: '#ffffff',
  },
  markerLabel: {
    textField: ['get', 'label'],
    textSize: 13,
    textColor: '#263238',
    textHaloColor: '#ffffff',
    textHaloWidth: 1.5,
    textAnchor: 'top',
    textOffset: [0, 0.8],
  },
};

const TaxiTrackingApp = () => {
  const [phase, setPhase] = useState<RidePhase>('idle');
  const [taxi, setTaxi] = useState<TaxiPosition | null>(null);
  const [routes, setRoutes] = useState<{
    pickup: Coordinate[];
    trip: Coordinate[];
  } | null>(null);

  const providerRef = useRef<SimulatedTaxiLocationProvider | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const [pickupRoute, tripRoute] = await Promise.all([
        fetchDrivingRoute(TAXI_START, PICKUP, FALLBACK_ROUTE_TO_PICKUP),
        fetchDrivingRoute(PICKUP, DESTINATION, FALLBACK_ROUTE_TO_DESTINATION),
      ]);
      if (!canceled) {
        setRoutes({ pickup: pickupRoute, trip: tripRoute });
      }
    })();
    return () => {
      canceled = true;
      providerRef.current?.stop();
    };
  }, []);

  const startLeg = useCallback(
    (leg: 'pickup' | 'trip') => {
      if (!routes) {
        return;
      }
      providerRef.current?.stop();
      setPhase(leg);
      // In a real app this provider would be replaced by one streaming the
      // driver's GPS position from your backend (see taxiLocationProvider.ts)
      const provider = new SimulatedTaxiLocationProvider({
        routeCoordinates: leg === 'pickup' ? routes.pickup : routes.trip,
        speedKmh: TAXI_SPEED_KMH,
        timeScale: SIMULATION_TIME_SCALE,
        onPosition: setTaxi,
        onArrive: () => setPhase(leg === 'pickup' ? 'pickedUp' : 'arrived'),
      });
      providerRef.current = provider;
      provider.start();
    },
    [routes],
  );

  const reset = useCallback(() => {
    providerRef.current?.stop();
    setTaxi(null);
    setPhase('idle');
  }, []);

  const isMoving = phase === 'pickup' || phase === 'trip';

  const activeRouteCoords = useMemo(() => {
    if (!routes) {
      return null;
    }
    return phase === 'idle' || phase === 'pickup' ? routes.pickup : routes.trip;
  }, [routes, phase]);

  const progressCoords = useMemo(() => {
    if (!taxi || !activeRouteCoords || !isMoving) {
      return null;
    }
    const coords = activeRouteCoords.slice(0, taxi.routeIndex + 1);
    coords.push(taxi.coordinate);
    return coords.length >= 2 ? coords : null;
  }, [taxi, activeRouteCoords, isMoving]);

  const markers = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 'pickup',
          properties: { label: 'Tú', kind: 'pickup' },
          geometry: { type: 'Point' as const, coordinates: PICKUP },
        },
        {
          type: 'Feature' as const,
          id: 'destination',
          properties: { label: 'Destino', kind: 'destination' },
          geometry: { type: 'Point' as const, coordinates: DESTINATION },
        },
      ],
    }),
    [],
  );

  const taxiCoordinate = taxi?.coordinate ?? TAXI_START;
  const taxiHeading = taxi?.heading ?? 180;

  const taxiModelStyle: ModelLayerStyle = {
    modelId: 'taxi',
    modelScale: [10, 10, 10],
    // Mapbox z-rotation grows counterclockwise, compass headings grow
    // clockwise, hence the negation
    modelRotation: [0, 0, TAXI_MODEL_HEADING_OFFSET - taxiHeading],
  };

  const remainingKm = taxi
    ? Math.max(0, taxi.totalDistanceKm - taxi.distanceTraveledKm)
    : null;
  const etaMinutes =
    remainingKm != null
      ? Math.max(1, Math.round((remainingKm / TAXI_SPEED_KMH) * 60))
      : null;
  const progress =
    taxi && taxi.totalDistanceKm > 0
      ? Math.min(1, taxi.distanceTraveledKm / taxi.totalDistanceKm)
      : 0;

  const cameraCenter = isMoving
    ? taxiCoordinate
    : phase === 'pickedUp'
      ? PICKUP
      : phase === 'arrived'
        ? DESTINATION
        : NOGALES_CENTER;

  let bannerText: string;
  let buttonTitle: string | null = null;
  let buttonAction: (() => void) | null = null;
  switch (phase) {
    case 'idle':
      bannerText = routes
        ? 'Pide un taxi y míralo llegar hasta ti'
        : 'Calculando rutas en Nogales…';
      buttonTitle = 'Pedir taxi';
      buttonAction = () => startLeg('pickup');
      break;
    case 'pickup':
      bannerText = `🚕 Tu taxi va en camino · llega en ~${etaMinutes} min · ${remainingKm?.toFixed(1)} km`;
      break;
    case 'pickedUp':
      bannerText = '✅ Tu taxi llegó · ¡súbete!';
      buttonTitle = 'Iniciar viaje';
      buttonAction = () => startLeg('trip');
      break;
    case 'trip':
      bannerText = `🧭 En viaje · llegas en ~${etaMinutes} min · ${remainingKm?.toFixed(1)} km`;
      break;
    case 'arrived':
      bannerText = '🎉 Llegaste a tu destino';
      buttonTitle = 'Reiniciar';
      buttonAction = reset;
      break;
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map}>
        <Camera
          centerCoordinate={cameraCenter}
          zoomLevel={isMoving ? 15.5 : phase === 'idle' ? 13 : 15}
          pitch={isMoving ? 55 : 40}
          animationMode="easeTo"
          animationDuration={isMoving ? 300 : 1200}
        />

        <Models models={models} />

        {activeRouteCoords && (
          <ShapeSource id="routeSource" shape={lineString(activeRouteCoords)}>
            <LineLayer id="routeLine" style={layerStyles.route} />
          </ShapeSource>
        )}

        {progressCoords && (
          <ShapeSource id="progressSource" shape={lineString(progressCoords)}>
            <LineLayer
              id="progressLine"
              style={layerStyles.progress}
              aboveLayerID="routeLine"
            />
          </ShapeSource>
        )}

        <ShapeSource id="markersSource" shape={markers}>
          <CircleLayer
            id="pickupCircle"
            filter={['==', ['get', 'kind'], 'pickup']}
            style={layerStyles.pickupCircle}
          />
          <CircleLayer
            id="destinationCircle"
            filter={['==', ['get', 'kind'], 'destination']}
            style={layerStyles.destinationCircle}
          />
          <SymbolLayer id="markerLabels" style={layerStyles.markerLabel} />
        </ShapeSource>

        <ShapeSource id="taxiSource" shape={point(taxiCoordinate)}>
          <ModelLayer id="taxiModel" style={taxiModelStyle} />
        </ShapeSource>
      </MapView>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>{bannerText}</Text>
        {isMoving && (
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        )}
        {buttonTitle != null && buttonAction != null && (
          <TouchableOpacity
            style={[styles.button, !routes && styles.buttonDisabled]}
            disabled={!routes}
            onPress={buttonAction}
          >
            <Text style={styles.buttonText}>{buttonTitle}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#263238',
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ECEFF1',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFC107',
  },
  button: {
    marginTop: 12,
    backgroundColor: '#FFC107',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263238',
  },
});

export default TaxiTrackingApp;

/* end-example-doc */

/**
 * @typedef {import('../common/ExampleMetadata').ExampleWithMetadata} ExampleWithMetadata
 */

const metadata = {
  title: 'Taxi en vivo (Nogales)',
  tags: ['ModelLayer', 'Models', 'LineLayer', 'Camera'],
  docs: `
Customer view of a taxi ride in Nogales, Sonora: a 3D taxi drives to the
customer's pickup location along a route fetched from the Mapbox Directions
API (with an offline fallback), showing the remaining time and distance and a
progress line; once picked up, the trip to the destination is tracked the same
way. The simulated location provider can be swapped for real driver positions
streamed from a backend — see taxiLocationProvider.ts.
`,
};
// @ts-ignore - metadata is attached for the example browser
TaxiTrackingApp.metadata = metadata;
