import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (based on your Supabase tables)
export interface TripRow {
  id: string;
  name: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  timezone: string;
  invite_code: string;
  created_at: string;
  created_by: string;
}

export interface TripMemberRow {
  id: string; // Primary key (auto-generated UUID)
  trip_id: string;
  user_id: string; // User identifier (auth.uid())
  name: string;
  joined_at: string;
}

export interface UserPreferencesRow {
  id: string; // UUID primary key
  trip_id: string;
  member_id: string;
  preferred_origin?: string;
  flight_flexibility?: 'low' | 'medium' | 'high';
  budget_sensitivity?: 'low' | 'medium' | 'high';
  accommodation_budget_min?: number;
  accommodation_budget_max?: number;
  accommodation_type?: string;
  activity_interests?: string[]; // Array of strings
  updated_at?: string;
}