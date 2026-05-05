import { useState, useEffect, useCallback } from "react";

const TOUR_STORAGE_KEY = "organic_product_tour";

interface TourState {
  completed: boolean;
  dismissed: boolean;
  lastStep: number;
  completedAt: string | null;
}

function getStoredState(): TourState {
  if (typeof window === "undefined")
    return { completed: false, dismissed: false, lastStep: 0, completedAt: null };
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { completed: false, dismissed: false, lastStep: 0, completedAt: null };
}

function setStoredState(state: TourState) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useProductTour() {
  const [tourActive, setTourActive] = useState(false);
  const [tourState, setTourState] = useState<TourState>(getStoredState);

  // Auto-start on first visit if not completed/dismissed
  useEffect(() => {
    const stored = getStoredState();
    setTourState(stored);
    if (!stored.completed && !stored.dismissed) {
      // Small delay so the page renders and elements are in the DOM
      const timer = setTimeout(() => setTourActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  const completeTour = useCallback(() => {
    const next: TourState = {
      completed: true,
      dismissed: false,
      lastStep: 0,
      completedAt: new Date().toISOString(),
    };
    setTourState(next);
    setStoredState(next);
    setTourActive(false);
  }, []);

  const dismissTour = useCallback(() => {
    const next: TourState = {
      ...getStoredState(),
      dismissed: true,
    };
    setTourState(next);
    setStoredState(next);
    setTourActive(false);
  }, []);

  const resetTour = useCallback(() => {
    const next: TourState = {
      completed: false,
      dismissed: false,
      lastStep: 0,
      completedAt: null,
    };
    setTourState(next);
    setStoredState(next);
  }, []);

  return {
    tourActive,
    tourState,
    startTour,
    completeTour,
    dismissTour,
    resetTour,
  };
}
