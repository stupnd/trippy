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
  image: string;
  description: string;
  lat: number;
  lng: number;
  vibe: 'neon' | 'nature' | 'history' | 'coastal';
  height: 'tall' | 'medium' | 'short';
}

const trendingDestinations: Destination[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: 'Modern metropolis meets ancient tradition',
    lat: 35.6762,
    lng: 139.6503,
    vibe: 'neon',
    height: 'tall',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2073&q=80',
    description: 'The City of Light and romance',
    lat: 48.8566,
    lng: 2.3522,
    vibe: 'history',
    height: 'medium',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: 'Tropical paradise with stunning beaches',
    lat: -8.4095,
    lng: 115.1889,
    vibe: 'coastal',
    height: 'medium',
  },
  {
    id: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    image: 'https://images.unsplash.com/photo-1555881403-671f0b4c6413?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: 'Coastal charm and historic beauty',
    lat: 38.7223,
    lng: -9.1393,
    vibe: 'coastal',
    height: 'short',
  },
  {
    id: 'iceland',
    name: 'Iceland',
    country: 'Iceland',
    image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: 'Land of fire and ice',
    lat: 64.9631,
    lng: -19.0208,
    vibe: 'nature',
    height: 'tall',
  },
  {
    id: 'morocco',
    name: 'Marrakech',
    country: 'Morocco',
    image: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: 'Vibrant markets and rich culture',
    lat: 31.6295,
    lng: -7.9811,
    vibe: 'history',
    height: 'short',
  },
];

const vibeDescriptions: Record<string, string> = {
  tokyo: 'Tokyo: Neon-lit streets and futuristic vibes',
  paris: 'Paris: Timeless elegance and hidden courtyards',
  bali: 'Bali: Sunset beaches and tropical tranquility',
  lisbon: 'Lisbon: Golden light and ocean breezes',
  iceland: 'Iceland: Aurora dances over glacial landscapes',
  morocco: 'Marrakech: Spiced air and ancient souks',
};

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Filter destinations by vibe
  const filteredDestinations = selectedVibe === 'all'
    ? trendingDestinations
    : trendingDestinations.filter(d => d.vibe === selectedVibe);

  // Mouse tracking for POI preview
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
        router.push(`/trips/new?destination=${encodeURIComponent(data.destination)}`);
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

  const getCardHeight = (height: string) => {
    switch (height) {
      case 'tall': return 'h-80 md:h-96';
      case 'medium': return 'h-64 md:h-80';
      case 'short': return 'h-48 md:h-64';
      default: return 'h-64';
    }
  };

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
            {trendingDestinations.map((dest) => {
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
                  {trendingDestinations.find(d => d.id === poiPreview.id)?.name}
                </p>
                <p className="text-slate-300 text-xs">
                  {vibeDescriptions[poiPreview.id] || 'Explore this destination'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trending Destinations Masonry/Bento Grid */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-6">Trending Destinations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDestinations.map((dest, index) => (
              <motion.div
                key={dest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className={`relative group rounded-3xl overflow-hidden cursor-pointer ${getCardHeight(dest.height)} bg-white/5 backdrop-blur-2xl`}
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {/* Shimmer Border Effect */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.4), transparent)',
                      backgroundSize: '200% 100%',
                    }}
                    animate={{
                      backgroundPosition: ['200% 0', '-200% 0'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                </div>

                {/* Destination Image */}
                <div
                  className="absolute inset-[1px] rounded-3xl bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${dest.image})` }}
                />

                {/* Soft Black Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-3xl" />
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-1">{dest.name}</h3>
                      <p className="text-slate-300 text-sm">{dest.country}</p>
                    </div>
                    <motion.button
                      onClick={(e) => toggleHeart(dest.id, e)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
                    >
                      <Heart
                        className={`w-5 h-5 transition-colors ${
                          heartedDestinations.has(dest.id)
                            ? 'fill-red-500 text-red-500'
                            : 'text-white'
                        }`}
                      />
                    </motion.button>
                  </div>
                  <p className="text-slate-200 text-sm mb-4 line-clamp-2">{dest.description}</p>
                  <Link
                    href={`/trips/new?destination=${encodeURIComponent(`${dest.name}, ${dest.country}`)}`}
                    className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-800 transition-all text-sm shadow-lg shadow-indigo-600/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Start Planning →
                  </Link>
                </div>

                {/* Purple Glow on Hover */}
                <motion.div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    boxShadow: '0 20px 50px rgba(79, 70, 229, 0.3)',
                  }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Group Wishlist Section */}
        {user && (
          <div className="glass-card rounded-3xl p-6">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Group Wishlist</h2>
            <p className="text-slate-300 text-sm mb-4">
              Destinations you and your travel groups want to visit together
            </p>
            <div className="text-slate-400 text-sm">Coming soon...</div>
          </div>
        )}
      </div>
    </div>
  );
}
