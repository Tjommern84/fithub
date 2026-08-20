'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { cityCoordinates } from './matching';

export type RadiusKm = 5 | 10 | 20 | 30 | null;

export type LocationState = {
  label: string;
  city?: string | null;
  lat: number;
  lon: number;
  source: 'gps' | 'search' | 'saved';
  radius: RadiusKm;
};

type ContextValue = {
  location: LocationState | null;
  setLocation: (v: LocationState | null) => void;
  geoPromptVisible: boolean;
  dismissGeoPrompt: () => void;
};

export const LOCATION_STORAGE_KEY = 'sdem_location_v1';
export const GEO_PROMPT_DISMISSED_KEY = 'sdem_geo_prompt_dismissed';

const LocationContext = createContext<ContextValue>({
  location: null,
  setLocation: () => {},
  geoPromptVisible: false,
  dismissGeoPrompt: () => {},
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationState | null>(null);
  const [geoPromptVisible, setGeoPromptVisible] = useState(false);

  // Gjenoppretter lagret lokasjon, eller setter Oslo-default hvis ingenting er lagret.
  // Leser localStorage direkte/synkront her — dette ER foreldre-effekten, så det er
  // ikke noe child-vs-parent useEffect-race å beskytte mot lenger (se historisk notat
  // i SearchLocationBar.tsx før denne logikken ble flyttet hit).
  /* eslint-disable react-hooks/set-state-in-effect -- Browser-only localStorage hydration must run after SSR. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocationState;
        if (parsed?.label && typeof parsed.lat === 'number') {
          setLocationState({ ...parsed, source: 'saved' });
          return;
        }
      }
    } catch { /* ignore */ }

    setLocationState({
      label: 'Oslo',
      city: 'oslo',
      lat: cityCoordinates.oslo.lat,
      lon: cityCoordinates.oslo.lon,
      source: 'search',
      radius: 10,
    });

    const dismissed = localStorage.getItem(GEO_PROMPT_DISMISSED_KEY);
    if (!dismissed && 'geolocation' in navigator) {
      setGeoPromptVisible(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setLocation = useCallback((v: LocationState | null) => {
    setLocationState(v);
    if (v) {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(v));
    } else {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
    setGeoPromptVisible(false);
  }, []);

  const dismissGeoPrompt = useCallback(() => {
    localStorage.setItem(GEO_PROMPT_DISMISSED_KEY, '1');
    setGeoPromptVisible(false);
  }, []);

  return (
    <LocationContext.Provider value={{ location, setLocation, geoPromptVisible, dismissGeoPrompt }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
