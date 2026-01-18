'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Plane, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  memberName: string;
  memberAvatarUrl?: string | null;
}

interface ProfileData {
  full_name: string | null;
  email?: string | null;
  bio: string | null;
  avatar_url: string | null;
  tripCount: number;
}

export default function MemberProfileModal({
  isOpen,
  onClose,
  userId,
  memberName,
  memberAvatarUrl,
}: MemberProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, bio, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) throw profileError;

        // Fetch user's trips count
        const { data: memberships, error: membershipsError } = await supabase
          .from('trip_members')
          .select('id', { count: 'exact', head: false })
          .eq('user_id', userId);

        const tripCount = memberships?.length || 0;

        setProfile({
          full_name: profileData?.full_name || null,
          email: profileData?.email || null,
          bio: profileData?.bio || null,
          avatar_url: profileData?.avatar_url || memberAvatarUrl || null,
          tripCount,
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userId, memberAvatarUrl]);

  const displayName = profile?.full_name || memberName;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="rounded-[2.5rem] p-8 border border-white/10 bg-zinc-900/95 backdrop-blur-2xl max-w-md w-full pointer-events-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {loading ? (
                <div className="flex flex-col items-center py-12">
                  <div className="w-20 h-20 rounded-full bg-slate-800 animate-pulse mb-6" />
                  <div className="h-6 bg-slate-800 rounded-lg w-32 animate-pulse mb-2" />
                  <div className="h-4 bg-slate-800 rounded-lg w-24 animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Avatar */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative w-24 h-24 rounded-full border-4 border-indigo-500/30 overflow-hidden mb-4 shadow-lg shadow-indigo-500/20">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={displayName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                          {initials}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <h2 className="text-2xl font-black text-white mb-2 tracking-tighter">
                      {displayName}
                    </h2>
                  </div>

                  {/* Email */}
                  {profile?.email && (
                    <div className="mb-6 flex items-center gap-3 text-slate-300">
                      <Mail className="w-5 h-5 text-slate-400" />
                      <span className="text-sm">{profile.email}</span>
                    </div>
                  )}

                  {/* Trip Count */}
                  <div className="mb-6 flex items-center gap-3 text-slate-300">
                    <Plane className="w-5 h-5 text-slate-400" />
                    <span className="text-sm">
                      {profile?.tripCount || 0} {profile?.tripCount === 1 ? 'Trip' : 'Trips'}
                    </span>
                  </div>

                  {/* Bio */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <h3 className="text-lg font-semibold text-white tracking-tighter">Bio</h3>
                    </div>
                    <div className="rounded-xl p-4 border border-white/5 bg-zinc-900/60 backdrop-blur-xl">
                      <p className="text-slate-300 leading-relaxed text-sm">
                        {profile?.bio || 'No bio available.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
