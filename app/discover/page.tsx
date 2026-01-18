'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, Heart, MapPin, Sunset, Trees, Building2, Waves } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Destination {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  image: string;
  description: string;
  lat: number;
  lng: number;
  vibe: 'neon' | 'nature' | 'history' | 'coastal';
}

const vibeFilters = [
  { id: 'all', label: 'All Destinations', icon: Sparkles },
  { id: 'neon', label: 'Neon Nights', icon: Sunset },
  { id: 'nature', label: 'Nature Escape', icon: Trees },
  { id: 'history', label: 'Hidden History', icon: Building2 },
  { id: 'coastal', label: 'Coastal Calm', icon: Waves },
];

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const [poiPreview, setPoiPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [heartedDestinations, setHeartedDestinations] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<string>('all');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState('');

  const visibleDestinations = destinations
    .filter((dest) => !heartedDestinations.has(dest.id))
    .slice(0, 8);
  const wishlistDestinations = destinations.filter((dest) =>
    heartedDestinations.has(dest.id)
  );

  // Filter destinations by vibe
  const filteredDestinations = selectedVibe === 'all'
    ? visibleDestinations
    : visibleDestinations.filter((dest) => dest.vibe === selectedVibe);

  // Fetch trending destinations from Gemini
  useEffect(() => {
    let isMounted = true;

    const fetchTrending = async () => {
      setDestinationsLoading(true);
      setDestinationsError('');
      try {
        const response = await fetch('/api/trending-destinations?limit=24');
        if (!response.ok) {
          throw new Error('Failed to fetch trending destinations');
        }
        const data = await response.json();
        const list = Array.isArray(data.destinations) ? data.destinations : [];
        if (isMounted) {
          setDestinations(list);
        }
      } catch (error) {
        console.error('Error loading trending destinations:', error);
        if (isMounted) {
          setDestinationsError('Trending destinations are unavailable right now.');
        }
      } finally {
        if (isMounted) {
          setDestinationsLoading(false);
        }
      }
    };

    fetchTrending();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch hearted destinations for current user
  useEffect(() => {
    if (!user) return;

    const fetchHearted = async () => {
      try {
        const { data } = await supabase
          .from('destination_wishlist')
          .select('destination_id')
          .eq('user_id', user.id);

        if (data) {
          setHeartedDestinations(new Set(data.map((d: any) => d.destination_id)));
        }
      } catch (error) {
        console.error('Error fetching wishlist:', error);
      }
    };

    fetchHearted();
  }, [user]);

  const toggleHeart = async (destinationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isHearted = heartedDestinations.has(destinationId);
    const newHearted = new Set(heartedDestinations);

    // Trigger confetti on heart
    if (!isHearted) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
        colors: ['#ef4444', '#f97316', '#fbbf24'],
        shapes: ['heart'],
      });
    }

    try {
      if (isHearted) {
        await supabase
          .from('destination_wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('destination_id', destinationId);
        newHearted.delete(destinationId);
      } else {
        await supabase
          .from('destination_wishlist')
          .insert({
            user_id: user.id,
            destination_id: destinationId,
          });
        newHearted.add(destinationId);
      }
      setHeartedDestinations(newHearted);
    } catch (error) {
      console.error('Error toggling heart:', error);
    }
  };

  const handleSurpriseMe = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/surprise-destination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      if (data.destination) {
        const params = new URLSearchParams();
        params.set('destination', data.destination);
        if (data.trip_name) params.set('name', data.trip_name);
        if (data.start_date) params.set('startDate', data.start_date);
        if (data.end_date) params.set('endDate', data.end_date);
        if (data.duration_days) params.set('duration', data.duration_days.toString());
        router.push(`/trips/new?${params.toString()}`);
      }
    } catch (error) {
      console.error('Error generating surprise:', error);
      alert('Failed to generate surprise destination. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Convert lat/lng to pixel positions on the map (approximate)
  const getPOIPosition = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x: `${x}%`, y: `${y}%` };
  };

  const getFlagUrl = (countryCode: string) => {
    if (!countryCode) return '';
    return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`;
  };

  const previewDestination = poiPreview
    ? filteredDestinations.find((dest) => dest.id === poiPreview.id)
    : undefined;

  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {/* Page Title - Editorial Style */}
        <div className="mb-10">
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter mb-4 leading-none">
            DISCOVER
          </h1>
          <p className="text-slate-300 text-lg">Explore trending destinations and plan your next adventure</p>
        </div>

        {/* Vibe Filters */}
        <div className="mb-8 flex flex-wrap gap-3">
          {vibeFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <motion.button
                key={filter.id}
                onClick={() => setSelectedVibe(filter.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 rounded-full font-semibold text-sm transition-all flex items-center gap-2 ${
                  selectedVibe === filter.id
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-600/50'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </motion.button>
            );
          })}
        </div>

        {/* Surprise Me Button - Liquid Light */}
        <div className="flex justify-center mb-12">
          <motion.button
            onClick={handleSurpriseMe}
            disabled={generating || !user}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="relative px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-3xl font-black text-xl shadow-2xl shadow-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 overflow-hidden group"
          >
            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
            {generating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-white border-t-transparent rounded-full relative z-10"
                />
                <span className="relative z-10">Thinking...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-7 h-7 relative z-10" />
                <span className="relative z-10">Surprise My Group</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Trending Destinations Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white tracking-tight">Trending Destinations</h2>
            {destinationsLoading && (
              <span className="text-sm text-slate-400">Refreshing...</span>
            )}
          </div>
          {destinationsError && (
            <div className="text-sm text-red-300 mb-4">{destinationsError}</div>
          )}
          {!destinationsLoading && !destinationsError && filteredDestinations.length === 0 && (
            <div className="text-sm text-slate-400">No destinations match this vibe yet.</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredDestinations.map((dest, index) => (
              <motion.div
                key={dest.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.03 }}
                className="group rounded-2xl overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/15"
              >
                <div className="relative h-32 sm:h-36">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${dest.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <motion.button
                    onClick={(e) => toggleHeart(dest.id, e)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute right-3 top-3 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        heartedDestinations.has(dest.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-white'
                      }`}
                    />
                  </motion.button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{dest.name}</h3>
                      <div className="flex items-center gap-2 text-slate-300 text-xs">
                        {dest.countryCode && (
                          <img
                            src={getFlagUrl(dest.countryCode)}
                            alt={`${dest.country} flag`}
                            className="h-3 w-5 rounded-sm border border-white/20"
                          />
                        )}
                        <span>{dest.country}</span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {dest.vibe}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs mt-2 line-clamp-2">{dest.description}</p>
                  <Link
                    href={`/trips/new?destination=${encodeURIComponent(`${dest.name}, ${dest.country}`)}`}
                    className="mt-3 inline-flex items-center px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-violet-800 transition-all text-xs shadow-lg shadow-indigo-600/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Start Planning →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Interactive Map with POIs */}
        <div 
          className="mb-12 relative"
          onMouseMove={(e) => {
            if (hoveredPOI && poiPreview) {
              setPoiPreview({ ...poiPreview, x: e.clientX, y: e.clientY });
            }
          }}
        >
          <div className="relative w-full h-[500px] rounded-3xl overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/20">
            {/* Map Background */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
              style={{
                backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg')`,
              }}
            />

            {/* Floating POIs */}
            {filteredDestinations.map((dest) => {
              const pos = getPOIPosition(dest.lat, dest.lng);
              
              return (
                <motion.div
                  key={dest.id}
                  className="absolute cursor-pointer z-20"
                  style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
                  onHoverStart={(e) => {
                    setHoveredPOI(dest.id);
                    setPoiPreview({ id: dest.id, x: (e.target as HTMLElement).getBoundingClientRect().left, y: (e.target as HTMLElement).getBoundingClientRect().top });
                  }}
                  onHoverEnd={() => {
                    setHoveredPOI(null);
                    setPoiPreview(null);
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  {/* POI Marker with Pulse */}
                  <motion.div
                    className="relative"
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <MapPin className="w-7 h-7 text-red-500 drop-shadow-2xl relative z-10" />
                    {/* Pulse Ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-red-500/30"
                      animate={{
                        scale: [1, 2, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  </motion.div>
                </motion.div>
              );
            })}

          </div>

          {/* Quick Preview Card (follows cursor when hovering POI) */}
          <AnimatePresence>
            {poiPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed bg-white/5 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-2xl z-50 pointer-events-none whitespace-nowrap"
                style={{
                  left: `${poiPreview.x + 20}px`,
                  top: `${poiPreview.y - 80}px`,
                }}
              >
                <p className="text-white font-semibold text-sm mb-1">
                  {previewDestination?.name}
                </p>
                <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
                  {previewDestination?.countryCode && (
                    <img
                      src={getFlagUrl(previewDestination.countryCode)}
                      alt={`${previewDestination.country || 'Country'} flag`}
                      className="h-3 w-5 rounded-sm border border-white/20"
                    />
                  )}
                  <span>{previewDestination?.country}</span>
                </div>
                <p className="text-slate-300 text-xs">
                  {previewDestination?.description || 'Explore this destination'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Wishlist Section */}
        <div className="glass-card rounded-3xl p-6">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Wishlist</h2>
          <p className="text-slate-300 text-sm mb-6">
            Destinations you have liked from Trending Destinations
          </p>
          {!user && (
            <div className="text-slate-400 text-sm">
              Sign in to like destinations and build your wishlist.
            </div>
          )}
          {user && wishlistDestinations.length === 0 && (
            <div className="text-slate-400 text-sm">
              Like a destination to add it to your wishlist.
            </div>
          )}
          {user && wishlistDestinations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistDestinations.map((dest) => (
                <div
                  key={dest.id}
                  className="group rounded-2xl overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/15"
                >
                  <div className="relative h-28">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${dest.image})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <motion.button
                      onClick={(e) => toggleHeart(dest.id, e)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute right-3 top-3 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
                    >
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                    </motion.button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white">{dest.name}</h3>
                        <div className="flex items-center gap-2 text-slate-300 text-xs">
                          {dest.countryCode && (
                            <img
                              src={getFlagUrl(dest.countryCode)}
                              alt={`${dest.country} flag`}
                              className="h-3 w-5 rounded-sm border border-white/20"
                            />
                          )}
                          <span>{dest.country}</span>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        {dest.vibe}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs mt-2 line-clamp-2">
                      {dest.description}
                    </p>
                    <Link
                      href={`/trips/new?destination=${encodeURIComponent(`${dest.name}, ${dest.country}`)}`}
                      className="mt-3 inline-flex items-center px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-violet-800 transition-all text-xs shadow-lg shadow-indigo-600/30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Start Planning →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
