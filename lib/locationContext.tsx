'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

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
};

export const LOCATION_STORAGE_KEY = 'sdem_location_v1';

const LocationContext = createContext<ContextValue>({
  location: null,
  setLocation: () => {},
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocationState;
      if (parsed?.label && typeof parsed.lat === 'number') {
        setLocationState({ ...parsed, source: 'saved' });
      }
    } catch { /* ignore */ }
  }, []);

  const setLocation = useCallback((v: LocationState | null) => {
    setLocationState(v);
    if (v) {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(v));
    } else {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    }
  }, []);

  return (
    <LocationContext.Provider value={{ location, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
