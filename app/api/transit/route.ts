import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

const ENTUR_URL = 'https://api.entur.io/journey-planner/v3/graphql';

const QUERY = `
query NearestDepartures($lat: Float!, $lon: Float!) {
  nearest(latitude: $lat, longitude: $lon,
          maximumDistance: 800, filterByPlaceTypes: [stopPlace]) {
    edges {
      node {
        place {
          ... on StopPlace {
            id
            name
            estimatedCalls(numberOfDepartures: 4, timeRange: 7200) {
              expectedDepartureTime
              destinationDisplay { frontText }
              serviceJourney {
                journeyPattern { line { publicCode transportMode } }
              }
            }
          }
        }
      }
    }
  }
}`;

export type TransitDeparture = {
  line: string;
  destination: string;
  mode: string;
  expectedTime: string;
};

export type TransitStop = {
  id: string;
  name: string;
  departures: TransitDeparture[];
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`transit:${ip}`, 30, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const body = await request.json() as { lat?: number; lon?: number };
  const { lat, lon } = body;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Mangler lat/lon' }, { status: 400 });
  }

  try {
    const res = await fetch(ENTUR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ET-Client-Name': 'fithub-reiseplanlegger',
      },
      body: JSON.stringify({ query: QUERY, variables: { lat, lon } }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return NextResponse.json([]);

    const json = await res.json() as {
      data?: {
        nearest?: {
          edges?: Array<{
            node: {
              place: {
                id: string;
                name: string;
                estimatedCalls: Array<{
                  expectedDepartureTime: string;
                  destinationDisplay: { frontText: string };
                  serviceJourney: {
                    journeyPattern: { line: { publicCode: string; transportMode: string } };
                  };
                }>;
              };
            };
          }>;
        };
      };
    };

    const edges = json.data?.nearest?.edges ?? [];
    const stops: TransitStop[] = edges
      .map(e => e.node.place)
      .filter(p => p.estimatedCalls?.length > 0)
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.name,
        departures: p.estimatedCalls.map(c => ({
          line: c.serviceJourney.journeyPattern.line.publicCode,
          destination: c.destinationDisplay.frontText,
          mode: c.serviceJourney.journeyPattern.line.transportMode,
          expectedTime: c.expectedDepartureTime,
        })),
      }));

    return NextResponse.json(stops);
  } catch (e) {
    console.error('[Entur] feil:', (e as Error).message);
    return NextResponse.json([]);
  }
}
