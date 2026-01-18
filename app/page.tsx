'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow } from '@/lib/supabase';
import LandingPage from '@/components/LandingPage';

interface UserTrip extends TripRow {
  joined_at: string;
  member_name: string;
  member_id: string;
  members?: Array<{ id: string; user_id: string | null; name: string; avatar_url: string | null }>;
  memberCount?: number;
}

interface JoinRequestView {
  id: string;
  trip_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  created_at: string;
  trip_name: string;
  destination_city?: string | null;
  destination_country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

// Dynamic destination image URL using Unsplash - using curated photo IDs for reliability
const destinationImageMap: Record<string, string> = {
  // Common destinations with known good Unsplash photo IDs
  'tokyo,japan': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop',
  'paris,france': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop',
  'lisbon,portugal': 'https://images.unsplash.com/photo-1555881403-671f0b4c6413?w=800&h=600&fit=crop',
  'london,uk': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop',
  'london,united kingdom': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop',
  'bali,indonesia': 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&h=600&fit=crop',
  'rome,italy': 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800&h=600&fit=crop',
  'barcelona,spain': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&h=600&fit=crop',
  'sydney,australia': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
  'dubai,uae': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop',
  'singapore,singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=600&fit=crop',
  'amsterdam,netherlands': 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop',
  'berlin,germany': 'https://images.unsplash.com/photo-1587330979470-1b499a31bb34?w=800&h=600&fit=crop',
  'new york,usa': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop',
  'new york city,usa': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop',
  'san francisco,usa': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=600&fit=crop',
  'los angeles,usa': 'https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=800&h=600&fit=crop',
  'miami,usa': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
  'seoul,south korea': 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop',
  'hong kong,china': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&h=600&fit=crop',
  'istanbul,turkey': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&h=600&fit=crop',
  'prague,czech republic': 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&h=600&fit=crop',
  'vienna,austria': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=600&fit=crop',
  'budapest,hungary': 'https://images.unsplash.com/photo-1546422904-90eab23c3d7e?w=800&h=600&fit=crop',
};

const getDestinationImageUrl = (city: string, country: string): string => {
  const key = `${city.toLowerCase()},${country.toLowerCase()}`;
  // Use mapped image if available, otherwise fallback to default Paris image
  return destinationImageMap[key] || 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80';
};

// Generate airport code from city name (simple placeholder - first 3 letters)
const getCityCode = (city: string): string => {
  if (!city) return '???';
  const cleaned = city.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return cleaned.slice(0, 3).padEnd(3, '?');
};

// TripCard component with image error handling
function TripCard({ trip, index, imageUrl }: { trip: UserTrip; index: number; imageUrl?: string }) {
  const router = useRouter();
  const destinationImage = imageUrl || '';
  const memberAvatars = (trip.members || []).slice(0, 5);
  const [imageError, setImageError] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <motion.div
      key={trip.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onClick={() => router.push(`/trips/${trip.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(`/trips/${trip.id}`);
        }
      }}
      role="link"
      tabIndex={0}
      className="group relative rounded-[2.5rem] overflow-hidden bg-white/70 backdrop-blur-2xl border border-slate-200 hover:border-slate-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-sky-200/60 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:bg-slate-900/60 dark:border-white/10 dark:hover:border-white/20 dark:hover:shadow-cyan-500/10 dark:focus-visible:ring-offset-slate-950"
    >
      {/* Dimmed Background Image with Error Fallback */}
      <div className="absolute inset-0 z-0">
        {!imageError && destinationImage ? (
          <img
            src={destinationImage}
            alt={`${trip.destination_city}, ${trip.destination_country}`}
            className="w-full h-full object-cover opacity-45 group-hover:opacity-60 transition-opacity duration-700"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-indigo-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/45 to-white/20 dark:from-slate-950/85 dark:via-slate-900/50 dark:to-slate-900/30" />
      </div>

      {/* Card Content */}
      <div className="relative p-6 flex flex-col min-h-[280px] z-10">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 font-medium dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40">
            {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d')}
          </span>
          {trip.memberCount && trip.memberCount > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 font-medium dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
              {trip.memberCount} {trip.memberCount === 1 ? 'Member' : 'Members'}
            </span>
          )}
        </div>

        {/* Trip Title & Location */}
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter line-clamp-2">
          {trip.name}
        </h3>
        {/* Route Chip with IATA Codes */}
        {hasMounted && (
          <span className="inline-block text-sm font-mono font-bold text-emerald-700 mb-2 tracking-widest border border-emerald-200 px-2 py-0.5 rounded-lg bg-emerald-100 dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            {(trip as any).origin_iata || '???'} → {(trip as any).destination_iata || '???'}
          </span>
        )}
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">
          {trip.destination_city}, {trip.destination_country}
        </p>

        {/* Member Facepile */}
        {memberAvatars.length > 0 && (
          <div className="flex items-center gap-2 mb-6 -space-x-2">
            {memberAvatars.map((member, idx) => {
              if (!hasMounted) {
                return (
                  <div
                    key={member.id}
                  className="relative w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden animate-pulse dark:bg-slate-800 dark:border-slate-950"
                    style={{ zIndex: 10 - idx }}
                  />
                );
              }

              const initials = member.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const colors = [
                'bg-slate-600', 'bg-zinc-700', 'bg-neutral-700', 'bg-slate-700',
                'bg-zinc-600', 'bg-slate-800', 'bg-neutral-800', 'bg-zinc-800'
              ];
              const colorClass = colors[idx % colors.length];

              return (
                <div
                  key={member.id}
                  className="relative w-10 h-10 rounded-full border-2 border-white overflow-hidden dark:border-slate-950"
                  style={{ zIndex: 10 - idx }}
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full ${colorClass} flex items-center justify-center text-white font-bold text-xs`}>
                      {initials}
                    </div>
                  )}
                </div>
              );
            })}
            {trip.memberCount && trip.memberCount > 5 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">+{trip.memberCount - 5}</span>
            )}
          </div>
        )}

        {/* Action Spacer */}
        <div className="mt-auto" />
      </div>
    </motion.div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadByTrip, setUnreadByTrip] = useState<Record<string, number>>({});
  const [pendingRequests, setPendingRequests] = useState<JoinRequestView[]>([]);
  const [tripImages, setTripImages] = useState<Record<string, string>>({});
  const tripImageCacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('join_requests')
        .select('id, trip_id, status, message, created_at')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      const pending = (requests || []).filter((req) => req.status === 'pending');
      if (pending.length === 0) {
        setPendingRequests([]);
        return;
      }

      const tripIds = pending.map((req) => req.trip_id);
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('id, name, destination_city, destination_country, start_date, end_date')
        .in('id', tripIds);

      if (tripsError) throw tripsError;

      const tripMap = new Map((tripsData || []).map((trip) => [trip.id, trip]));
      const merged = pending.map((req) => {
        const trip = tripMap.get(req.trip_id);
        return {
          ...req,
          trip_name: trip?.name || 'Trip',
          destination_city: trip?.destination_city,
          destination_country: trip?.destination_country,
          start_date: trip?.start_date,
          end_date: trip?.end_date,
        };
      });

      setPendingRequests(merged);
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in - show landing page, no need to fetch trips
      setLoading(false);
      return;
    }

    // User is logged in - fetch their trips
    fetchUserTrips();
    fetchPendingRequests();
  }, [user, authLoading, fetchPendingRequests]);

  const fetchUserTrips = async () => {
    try {
      // Fetch trip memberships for current user
      const { data: memberships, error: membersError } = await supabase
        .from('trip_members')
        .select('id, trip_id, joined_at, user_id')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;

      if (!memberships || memberships.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      // Fetch profile for current user
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .maybeSingle();

      // Fetch trip details for each membership
      const tripIds = memberships.map((m) => m.trip_id);
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds);

      if (tripsError) throw tripsError;

      // Fetch members for each trip to get facepile data
      const tripsWithMembers = await Promise.all(
        (tripsData || []).map(async (trip) => {
          const { data: tripMembers } = await supabase
            .from('trip_members')
            .select('id, user_id')
            .eq('trip_id', trip.id)
            .limit(5);

          // Fetch profiles for trip members
          const memberUserIds = (tripMembers || []).map(m => m.user_id).filter(Boolean);
          let profileMap = new Map<string, { full_name?: string; avatar_url?: string | null }>();
          
          if (memberUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .in('id', memberUserIds);
            
            (profiles || []).forEach(p => {
              if (p.id) {
                profileMap.set(p.id, {
                  full_name: p.full_name || undefined,
                  avatar_url: p.avatar_url || null,
                });
              }
            });
          }

          const membersWithAvatars = (tripMembers || []).map((m: any) => {
            const profile = m.user_id ? profileMap.get(m.user_id) : null;
            const fallbackName = profile?.full_name || (m.user_id ? 'Traveler' : 'Guest');
            return {
              ...m,
              name: fallbackName,
              avatar_url: profile?.avatar_url || null,
            };
          });

          const membership = memberships.find((m) => m.trip_id === trip.id);
          return {
            ...trip,
            joined_at: membership?.joined_at || '',
            member_name: userProfile?.full_name || '',
            member_id: membership?.id || '',
            members: membersWithAvatars,
            memberCount: membersWithAvatars.length,
          };
        })
      );

      // Sort by most recently joined
      tripsWithMembers.sort((a, b) => 
        new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
      );

      setTrips(tripsWithMembers);
    } catch (error: any) {
      console.error('Error fetching user trips:', error);
      setError('Failed to load your trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || trips.length === 0) return;

    const channels = trips
      .filter((trip) => trip.member_id)
      .map((trip) => {
        const channel = supabase
          .channel(`home_unread_${trip.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `trip_id=eq.${trip.id}`,
            },
            (payload) => {
              const newMsg = payload.new as any;
              if (newMsg.member_id !== trip.member_id) {
                setUnreadByTrip((prev) => ({
                  ...prev,
                  [trip.id]: (prev[trip.id] || 0) + 1,
                }));
              }
            }
          )
          .subscribe();
        return channel;
      });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user, trips]);

  useEffect(() => {
    if (!trips.length) return;

    const fetchTripImages = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(trips.map(async (trip) => {
        const destination = `${trip.destination_city}, ${trip.destination_country}`;
        const cacheKey = `trip_image_${destination.toLowerCase()}`;
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as { url: string; ts: number };
              if (parsed?.url && Date.now() - parsed.ts < tripImageCacheTtlMs) {
                updates[trip.id] = parsed.url;
                return;
              }
            } catch {
              // Ignore cache parsing errors.
            }
          }
        }

        try {
          const response = await fetch(`/api/trip-image?destination=${encodeURIComponent(destination)}`);
          if (!response.ok) return;
          const data = await response.json();
          const url = typeof data?.image === 'string' ? data.image : '';
          if (url) {
            updates[trip.id] = url;
            if (typeof window !== 'undefined') {
              localStorage.setItem(cacheKey, JSON.stringify({ url, ts: Date.now() }));
            }
          }
        } catch (err) {
          console.error('Error fetching trip image:', err);
        }
      }));

      if (Object.keys(updates).length > 0) {
        setTripImages((prev) => ({ ...prev, ...updates }));
      }
    };

    fetchTripImages();
  }, [trips]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`home_requests_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `requester_id=eq.${user.id}`,
        },
        () => {
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPendingRequests]);

  // Show loading skeleton while checking auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-64 mb-4 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="card-surface rounded-lg p-6 h-48 animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }

  // User Dashboard - show user's trips
  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">My Trips</h1>
            <p className="text-slate-700 dark:text-slate-300">
              Welcome back! Manage and view all your trips
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/trips/join"
              className="bg-sky-100 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-sky-200 transition-all dark:glass-card dark:text-slate-200 dark:hover:bg-white/10"
            >
              Join Trip
            </Link>
            <Link
              href="/trips/new"
              className="bg-sky-200 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-sky-300 transition-all border border-sky-200 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-900 dark:text-white dark:hover:from-slate-700 dark:hover:to-slate-800 dark:border-white/20 dark:shadow-black/40"
            >
              + Create New Trip
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 dark:bg-red-900 dark:border-red-700 dark:text-red-100">
            {error}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Pending Join Requests</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We will notify you when a trip owner approves or rejects your request.
                </p>
              </div>
              <Link
                href="/community"
                className="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                View community
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="glass-card rounded-2xl p-5 border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {request.trip_name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {request.destination_city}
                        {request.destination_country ? `, ${request.destination_country}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
                      Pending
                    </span>
                  </div>
                  {request.start_date && request.end_date && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </div>
                  )}
                  {request.message && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-3 line-clamp-2">
                      "{request.message}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {trips.length > 0 && (
          <div className="mb-6 space-y-3">
            {trips
              .filter((trip) => (unreadByTrip[trip.id] || 0) > 0)
              .map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    setUnreadByTrip((prev) => ({ ...prev, [trip.id]: 0 }));
                    router.push(`/trips/${trip.id}?chat=1`);
                  }}
                  className="w-full bg-sky-200 text-slate-900 px-4 py-3 rounded-xl flex items-center justify-between hover:bg-sky-300 transition-all dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                >
                  <span className="text-sm">
                    New chat message{(unreadByTrip[trip.id] || 0) > 1 ? 's' : ''} in {trip.name}
                  </span>
                  <span className="text-xs font-semibold bg-slate-900 text-white px-2 py-1 rounded-full dark:bg-white dark:text-slate-900">
                    Open chat
                  </span>
                </button>
              ))}
          </div>
        )}

        {/* Empty State */}
        {trips.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card rounded-3xl p-16 text-center max-w-2xl mx-auto"
          >
            <div className="text-6xl mb-6">✈️</div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4 tracking-tight">
              Ready for an adventure?
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-8 text-lg">
              Start planning your next trip with friends. Create a trip or join one with an invite code.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/trips/new"
                className="bg-sky-200 text-slate-900 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-sky-300 transition-all border border-sky-200 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-900 dark:text-white dark:hover:from-slate-700 dark:hover:to-slate-800 dark:border-white/20 dark:shadow-black/40"
              >
                ✨ Create Your First Trip
              </Link>
              <Link
                href="/trips/join"
                className="bg-sky-100 text-slate-900 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-sky-200 transition-all border border-sky-200 dark:glass-card dark:text-slate-200 dark:hover:bg-white/10 dark:border-white/20"
              >
                Join with Code
              </Link>
            </div>
          </motion.div>
        )}

        {/* Upcoming Trips Section */}
        {trips.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter">
              Upcoming Trips
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} index={index} imageUrl={tripImages[trip.id]} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
