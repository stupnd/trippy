// Core Data Models

export interface Trip {
  id: string;
  name: string;
  destination: {
    city: string;
    country: string;
  };
  currentLocation: string; // where the group is starting from
  startDate: string; // ISO date string
  endDate: string;
  maxDays: number; // maximum number of days for the trip
  inviteCode: string;
  createdAt: string;
  createdBy: string; // user ID
  members: TripMember[];
  userPreferences: Record<string, UserPreferences>; // userId -> preferences
  flights?: FlightSelection;
  accommodation?: AccommodationSelection;
  activities: Activity[];
  itinerary: ItineraryDay[];
}

export interface TripMember {
  id: string;
  name: string;
  email?: string;
  joinedAt: string;
  isOwner: boolean;
}

export interface FlightPreference {
  userId: string;
  origin: string; // IATA code
  destination: string; // IATA code
  departureDateRange: {
    start: string;
    end: string;
  };
  returnDateRange: {
    start: string;
    end: string;
  };
  lengthOfStay?: {
    min: number; // days
    max: number; // days
  };
}

export interface FlightOption {
  id: string;
  price: number; // in USD
  airline: string[];
  departure: {
    time: string;
    airport: string;
  };
  arrival: {
    time: string;
    airport: string;
  };
  duration: number; // minutes
  layovers: {
    count: number;
    airports: string[];
  };
  score: number; // 0-100
  isCheapest?: boolean;
  isFastest?: boolean;
  isBestValue?: boolean;
}

export interface FlightSelection {
  preferences: FlightPreference[];
  options: FlightOption[];
  selectedOptionId?: string;
  approvals: Record<string, {
    approved: boolean;
    reason?: string;
  }>; // userId -> approval
}

export interface AccommodationPreference {
  userId: string;
  budgetRange: {
    min: number;
    max: number;
  }; // per night in USD
  type: 'hotel' | 'airbnb' | 'hostel' | 'any';
  mustHaveFeatures: string[];
}

export interface AccommodationOption {
  id: string;
  name: string;
  type: 'hotel' | 'airbnb' | 'hostel';
  pricePerNight: number;
  rating: number; // 0-5
  location: string;
  link: string;
  score: number; // 0-100
  imageUrl?: string;
}

export interface AccommodationSelection {
  preferences: AccommodationPreference[];
  options: AccommodationOption[];
  selectedOptionId?: string;
  approvals: Record<string, {
    approved: boolean;
    reason?: string;
  }>;
}

export interface Activity {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  link?: string;
  imageUrl?: string;
  ratings: Record<string, number>; // userId -> rating (1-5)
  averageRating: number;
  isSelected: boolean;
  conflicts?: string[]; // userIds who rated < 3
}

export interface ItineraryDay {
  date: string;
  activities: {
    activityId: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
  }[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface UserPreferences {
  userId: string;
  tripId: string;
  // Budgets
  flightBudget?: {
    min: number;
    max: number;
  };
  accommodationBudget?: {
    min: number; // per night
    max: number; // per night
  };
  activityBudget?: {
    min: number; // total
    max: number; // total
  };
  // Housing non-negotiables
  housingNonNegotiables: string[]; // e.g., "WiFi", "Air conditioning", "Pet friendly"
  // Flight non-negotiables
  flightNonNegotiables: string[]; // e.g., "No layovers", "Window seat preferred", "Early morning only"
  // Dietary restrictions
  dietaryRestrictions: string[]; // e.g., "Vegetarian", "Gluten-free", "Nut allergy"
  // Notes
  notes?: string;
  updatedAt: string;
}