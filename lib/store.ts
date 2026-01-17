// Simple in-memory store for MVP
// In production, replace with Supabase/Firebase/etc.

import { Trip } from '@/types';

let trips: Map<string, Trip> = new Map();

export const tripStore = {
  get: (id: string): Trip | undefined => {
    return trips.get(id);
  },

  getByInviteCode: (code: string): Trip | undefined => {
    for (const trip of trips.values()) {
      if (trip.inviteCode === code) {
        return trip;
      }
    }
    return undefined;
  },

  create: (trip: Trip): void => {
    trips.set(trip.id, trip);
  },

  update: (id: string, updates: Partial<Trip>): void => {
    const trip = trips.get(id);
    if (trip) {
      trips.set(id, { ...trip, ...updates });
    }
  },

  delete: (id: string): void => {
    trips.delete(id);
  },

  getAll: (): Trip[] => {
    return Array.from(trips.values());
  },
};