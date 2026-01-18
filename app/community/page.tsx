'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow, TripMemberRow } from '@/lib/supabase';

type JoinRequest = {
  id: string;
  trip_id: string;
  requester_id: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
};

interface TripWithMembers extends TripRow {
  members?: TripMemberRow[];
  memberCount?: number;
}

export default function CommunityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<TripWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberTripIds, setMemberTripIds] = useState<Set<string>>(new Set());
  const [requestsByTrip, setRequestsByTrip] = useState<Record<string, JoinRequest>>({});
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTrip, setRequestTrip] = useState<TripRow | null>(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestForm, setRequestForm] = useState({ message: '' });

  const statusLabel = (status?: string | null) => {
    const labels: Record<string, string> = {
      planning: 'Planning',
      booked: 'Booked',
      in_progress: 'In Progress',
      completed: 'Completed',
    };
    return labels[status || 'planning'] || 'Planning';
  };

  useEffect(() => {
    const loadCommunityTrips = async () => {
      try {
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (tripsError) throw tripsError;

        const tripsWithMembers: TripWithMembers[] = await Promise.all(
          (tripsData || []).map(async (trip) => {
            const { data: members, error: membersError } = await supabase
              .from('trip_members')
              .select('id, user_id, name')
              .eq('trip_id', trip.id)
              .limit(5);

            if (!membersError && members) {
              const memberIds = members.filter(m => m.user_id).map(m => m.user_id!);
              const profileMap = new Map<string, string | null>();
              
              if (memberIds.length > 0) {
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, avatar_url')
                  .in('id', memberIds);
                profiles?.forEach(p => profileMap.set(p.id, p.avatar_url));
              }

              const { count } = await supabase
                .from('trip_members')
                .select('*', { count: 'exact', head: true })
                .eq('trip_id', trip.id);

              return {
                ...trip,
                members: members.map(m => ({
                  ...m,
                  avatar_url: m.user_id ? profileMap.get(m.user_id) || null : null,
                })),
                memberCount: count || members.length,
              };
            }
            return { ...trip, members: [], memberCount: 0 };
          })
        );
        setTrips(tripsWithMembers);
      } catch (err) {
        setError('Failed to load community trips');
      } finally {
        setLoading(false);
      }
    };
    loadCommunityTrips();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadUserData = async () => {
      try {
        const { data: memberships } = await supabase
          .from('trip_members')
          .select('trip_id')
          .eq('user_id', user.id);
        setMemberTripIds(new Set((memberships || []).map((m) => m.trip_id)));

        const { data: requests } = await supabase
          .from('join_requests')
          .select('*')
          .eq('requester_id', user.id);
        const mapped: Record<string, JoinRequest> = {};
        requests?.forEach((req) => { mapped[req.trip_id] = req as JoinRequest; });
        setRequestsByTrip(mapped);
      } catch (err) { console.error(err); }
    };
    loadUserData();
  }, [user]);

  const openRequestModal = (trip: TripRow) => {
    // Check if user already has a pending request
    const existingRequest = requestsByTrip[trip.id];
    if (existingRequest?.status === 'pending') {
      // Don't open modal, user already has a pending request
      return;
    }
    
    setRequestTrip(trip);
    setRequestError('');
    setRequestForm({
      message: '',
    });
    setRequestOpen(true);
  };

  const submitJoinRequest = async () => {
    if (!user || !requestTrip) return;
    if (!requestForm.message.trim()) {
      setRequestError('Message is required.');
      return;
    }
    const existingRequest = requestsByTrip[requestTrip.id];
    if (existingRequest?.status === 'approved') {
      setRequestError('Your request was already approved. Open the trip from My Trips.');
      return;
    }
    setRequestSaving(true);
    setRequestError('');
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const displayName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Traveler';

      const { data, error: upsertError } = await supabase
        .from('join_requests')
        .upsert({
          id: existingRequest?.id || uuidv4(),
          trip_id: requestTrip.id,
          requester_id: user.id,
          message: requestForm.message.trim(),
          status: 'pending',
          display_name: displayName,
        }, { onConflict: 'trip_id, requester_id' })
        .select('*')
        .single();
      
      if (upsertError) {
        throw upsertError;
      }
      
      setRequestsByTrip((prev) => ({ ...prev, [requestTrip.id]: data as JoinRequest }));
      setRequestOpen(false);
    } catch (err: any) {
      // Additional check for duplicate error messages
      if (err.code === '23505' || err.message?.includes('unique constraint') || err.message?.includes('duplicate key')) {
        setRequestError('You have already sent a request for this trip.');
      } else {
        setRequestError(err.message || 'Failed to submit request');
      }
    } finally {
      setRequestSaving(false);
    }
  };

  const planningTrips = useMemo(() => trips.filter(t => (t.status || 'planning') === 'planning'), [trips]);
  const completedTrips = useMemo(() => trips.filter(t => t.status === 'completed'), [trips]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen pt-24 pb-8 container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="h-12 bg-white/5 rounded-2xl w-64 mb-10 shimmer-loader" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-slate-900/40 rounded-3xl border border-white/10 shimmer-loader" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-16">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter leading-none"
          >
            COMMUNITY <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">TRIPS</span>
          </motion.h1>
          <p className="text-slate-400 text-xl max-w-2xl leading-relaxed">
            Discover how others are seeing the world. Join an active group or draw inspiration for your next journey.
          </p>
        </div>

        {/* Planning Section */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">Planning Now</h2>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {planningTrips.map((trip, idx) => (
              <TripCard 
                key={trip.id} 
                trip={trip} 
                idx={idx} 
                user={user} 
                isMember={memberTripIds.has(trip.id)}
                request={requestsByTrip[trip.id]}
                onJoin={() => openRequestModal(trip)}
              />
              ))}
            </div>
        </section>
      </div>

      {/* Request Modal - Implemented with high-end glassmorphism */}
      <AnimatePresence>
        {requestOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
                onClick={() => setRequestOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 p-8 shadow-2xl"
            >
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Join Adventure</h2>
              <p className="text-slate-400 mb-8">Tell the group a bit about yourself and why you're excited for {requestTrip?.name}.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Your Message</label>
                <textarea
                    rows={4}
                  value={requestForm.message}
                    onChange={(e) => setRequestForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="I've always wanted to visit..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                {requestError && <p className="text-rose-400 text-sm ml-1">{requestError}</p>}
                <button
                  onClick={submitJoinRequest}
                  disabled={requestSaving}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl font-bold text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {requestSaving ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
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

// Generate route display (origin → destination) using IATA codes
const getRouteDisplay = (trip: any): string => {
  const originCode = trip.origin_iata || '???';
  const destCode = trip.destination_iata || getCityCode(trip.destination_city) || '???';
  return `${originCode.toUpperCase().slice(0, 3)} → ${destCode.toUpperCase().slice(0, 3)}`;
};

// Sub-component for the Trip Card to handle destination imagery and facepile
function TripCard({ trip, idx, user, isMember, request, onJoin }: any) {
  // Dynamic destination image using source.unsplash.com
  const destinationImage = `https://source.unsplash.com/800x600/?${encodeURIComponent(trip.destination_city)},travel`;
  const [imageError, setImageError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="group relative h-[28rem] rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white/70 backdrop-blur-2xl hover:border-slate-300 hover:scale-[1.02] transition-all dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-white/20"
    >
      {/* Background Image with Error Fallback */}
      <div className="absolute inset-0 z-0">
        {!imageError ? (
          <img
            src={destinationImage}
            alt={`${trip.destination_city}, ${trip.destination_country}`}
            className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-700"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-indigo-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/60 dark:to-transparent" />
      </div>

      {/* Card Content */}
      <div className="relative h-full p-8 flex flex-col justify-end z-10">
        <div className="mb-auto flex justify-between items-start">
          <span className="px-4 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-700 border border-slate-200 tracking-widest uppercase dark:bg-white/10 dark:text-white dark:border-white/10">
            {trip.status || 'Planning'}
          </span>
          <div className="flex -space-x-3">
              {trip.members?.map((m: any, i: number) => {
                const initial = typeof m.name === 'string' && m.name.length > 0 ? m.name[0] : 'T';
                return (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-indigo-500 flex items-center justify-center text-[10px] font-bold dark:border-slate-900">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      initial
                    )}
                  </div>
                );
              })}
            {trip.memberCount > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:border-slate-900 dark:bg-slate-800 dark:text-slate-400">
                +{trip.memberCount - 5}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 leading-tight tracking-tighter uppercase">{trip.name}</h3>
          {/* Route Chip with IATA Codes */}
          <span className="inline-block text-sm font-mono font-bold text-emerald-700 mb-2 tracking-widest border border-emerald-200 px-2 py-0.5 rounded-lg bg-emerald-100 dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            {trip.origin_iata || '???'} → {trip.destination_iata || getCityCode(trip.destination_city) || '???'}
          </span>
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-2 flex items-center gap-2">
            <span className="opacity-60 text-lg">📍</span> {trip.destination_city}, {trip.destination_country}
          </p>

          <div className="flex items-center gap-3">
            {isMember ? (
              <Link href={`/trips/${trip.id}`} className="flex-1 py-4 bg-transparent border border-slate-200 text-slate-900 rounded-2xl font-bold text-center hover:border-slate-300 hover:bg-slate-100 transition-all dark:border-white/10 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/5">
                Open Trip
              </Link>
            ) : request?.status === 'pending' ? (
              <div className="flex-1 py-4 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl font-bold text-indigo-300 text-center cursor-default">
                Request Pending
              </div>
            ) : request?.status === 'rejected' ? (
              <div className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-slate-400 text-center cursor-default" title="Your previous request was not accepted.">
                Request Not Accepted
              </div>
            ) : (
              <button onClick={onJoin} className="flex-1 py-4 bg-transparent border border-slate-200 text-slate-900 rounded-2xl font-bold hover:border-slate-300 hover:bg-slate-100 transition-all dark:border-white/10 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/5">
                Join Adventure
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
