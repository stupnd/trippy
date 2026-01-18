'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Camera, User, Mail, FileText, Plane, Save, Check, Upload, X, UserCircle, Mountain, Compass, Video, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface ProfileData {
  name: string;
  email: string;
  bio: string;
  avatar_url: string | null;
}

interface TravelStats {
  totalTrips: number;
  connections: number;
  explorerLevel: string;
}

const avatarPresets = [
  { id: 'pilot', icon: Plane, label: 'Pilot', color: 'from-blue-500 to-cyan-500' },
  { id: 'hiker', icon: Mountain, label: 'Hiker', color: 'from-green-500 to-emerald-500' },
  { id: 'explorer', icon: Compass, label: 'Explorer', color: 'from-orange-500 to-red-500' },
  { id: 'traveler', icon: UserCircle, label: 'Traveler', color: 'from-purple-500 to-pink-500' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    bio: '',
    avatar_url: null,
  });
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({
    name: '',
    email: '',
    bio: '',
    avatar_url: null,
  });
  const [stats, setStats] = useState<TravelStats>({
    totalTrips: 0,
    connections: 0,
    explorerLevel: 'Beginner Explorer',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const [hoveredAvatar, setHoveredAvatar] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Magnetic hover for avatar
  const avatarX = useMotionValue(0);
  const avatarY = useMotionValue(0);
  const springX = useSpring(avatarX, { damping: 20, stiffness: 300 });
  const springY = useSpring(avatarY, { damping: 20, stiffness: 300 });

  // Ensure video element gets the stream when camera mode is active
  useEffect(() => {
    if (cameraMode && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [cameraMode, stream]);

  // Cleanup camera stream on unmount or modal close
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth?redirect=/profile');
    }
  }, [authLoading, user, router]);

  // Fetch profile data
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        // Fetch user profile (assuming profiles table exists)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        // Fetch travel stats
        const { data: trips } = await supabase
          .from('trip_members')
          .select('trip_id')
          .eq('user_id', user.id);

        const { data: allMemberships } = await supabase
          .from('trip_members')
          .select('trip_id')
          .eq('user_id', user.id);

        // Count unique connections (people in same trips)
        const tripIds = allMemberships?.map(m => m.trip_id) || [];
        let uniqueConnections = new Set<string>();
        if (tripIds.length > 0) {
          const { data: connections } = await supabase
            .from('trip_members')
            .select('user_id')
            .in('trip_id', tripIds)
            .neq('user_id', user.id);
          connections?.forEach(c => uniqueConnections.add(c.user_id));
        }

        // Generate explorer level
        const totalTrips = trips?.length || 0;
        const connections = uniqueConnections.size;
        let explorerLevel = 'Beginner Explorer';
        if (totalTrips > 10) explorerLevel = 'Globetrotter';
        else if (totalTrips > 5) explorerLevel = 'Wanderer';
        else if (totalTrips > 2) explorerLevel = 'Adventurer';
        else if (totalTrips > 0) explorerLevel = 'Explorer';

        setProfile({
          name: profileData?.name || user.email?.split('@')[0] || 'Traveler',
          email: user.email || '',
          bio: profileData?.bio || '',
          avatar_url: profileData?.avatar_url || null,
        });
        setOriginalProfile({
          name: profileData?.name || user.email?.split('@')[0] || 'Traveler',
          email: user.email || '',
          bio: profileData?.bio || '',
          avatar_url: profileData?.avatar_url || null,
        });
        setStats({
          totalTrips,
          connections,
          explorerLevel,
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Handle avatar magnetic hover
  const handleAvatarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoveredAvatar) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (e.clientX - centerX) * 0.1;
    const dy = (e.clientY - centerY) * 0.1;
    avatarX.set(dx);
    avatarY.set(dy);
  };

  const handleAvatarMouseLeave = () => {
    avatarX.set(0);
    avatarY.set(0);
  };

  // Start camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(mediaStream);
      setCameraMode(true);
      
      // Wait a bit for the ref to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions and try again.');
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraMode(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // Capture photo from camera
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Convert blob to File
      const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });
      
      // Stop camera
      stopCamera();

      // Upload the captured photo
      await handleFileUpload(file);
    }, 'image/png');
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // Don't include 'avatars/' prefix - bucket is already specified in .from()

      console.log('Uploading file:', { fileName, filePath, fileSize: file.size, fileType: file.type, bucket: 'avatars' });

      // Upload to Supabase Storage (try direct upload - bucket check removed as it requires admin)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type || 'image/png',
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        console.error('Error details:', JSON.stringify(uploadError, null, 2));
        console.error('Upload error code:', uploadError.error);
        console.error('Upload error message:', uploadError.message);
        
        // Handle specific error cases
        if (uploadError.message?.includes('Bucket') || 
            uploadError.message?.includes('not found') || 
            uploadError.message?.includes('does not exist') ||
            uploadError.error === 'Bucket not found') {
          throw new Error('❌ Avatar storage bucket "avatars" not found.\n\nEven though you created it, please verify:\n1. Bucket name is exactly "avatars" (lowercase, no spaces)\n2. Go to Supabase Dashboard → Storage → Check if "avatars" bucket exists\n3. If it exists, make sure it\'s set to "Public"\n4. Refresh this page and try again\n\nSee SETUP_PROFILE.md for detailed instructions.');
        }
        
        if (uploadError.message?.includes('permission') || 
            uploadError.message?.includes('policy') || 
            uploadError.message?.includes('access denied') ||
            uploadError.message?.includes('Row Level Security') ||
            uploadError.message?.includes('row-level security')) {
          throw new Error('❌ Permission denied: Storage RLS Policy blocking upload.\n\nTo fix:\n1. Go to Supabase Dashboard → Storage → avatars bucket\n2. Click "Policies" tab\n3. Click "New Policy" → "Create policy from scratch"\n4. Policy name: "Allow authenticated uploads"\n5. Allowed operation: INSERT\n6. Target roles: authenticated\n7. USING expression: auth.role() = \'authenticated\'\n8. WITH CHECK expression: auth.role() = \'authenticated\'\n9. Save policy\n\nOr make bucket fully public in bucket settings.');
        }
        
        // More detailed error message
        const errorMsg = uploadError.message || JSON.stringify(uploadError);
        throw new Error(`Storage error: ${errorMsg}\n\nPlease check:\n1. Bucket exists and is named "avatars"\n2. Bucket is public\n3. You have proper permissions\n\nCheck browser console for more details.`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: avatarUrl,
        }, { onConflict: 'id' });

      if (updateError) {
        console.error('Profile update error:', updateError);
        // If profiles table doesn't exist, try creating the record differently
        if (updateError.message.includes('relation') || updateError.message.includes('does not exist') || updateError.message.includes('404')) {
          // Fallback: Try inserting first, then update if that fails
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              avatar_url: avatarUrl,
            });
          
          if (insertError && !insertError.message.includes('duplicate')) {
            throw new Error('❌ Profiles table not found.\n\nTo fix:\n1. Go to Supabase Dashboard → SQL Editor\n2. Run the SQL from SETUP_PROFILE.md\n3. Or create a profiles table with columns: id (UUID), name, email, bio, avatar_url\n\nSee SETUP_PROFILE.md for detailed instructions.');
          }
        } else {
          throw updateError;
        }
      }

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      setOriginalProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      setAvatarModalOpen(false);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      
      // Extract detailed error message
      let errorMessage = 'Unknown error occurred';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      }
      
      console.error('Detailed error:', {
        error,
        message: errorMessage,
        stack: error?.stack,
      });
      
      // Show detailed error in alert
      const detailedMessage = errorMessage.includes('Bucket') || errorMessage.includes('bucket')
        ? 'Avatar storage bucket not found. Please create an "avatars" bucket in Supabase Storage (Settings → Storage → Create bucket).'
        : errorMessage.includes('relation') || errorMessage.includes('profiles') || errorMessage.includes('404')
        ? '❌ Profiles table not found.\n\nTo fix:\n1. Go to Supabase Dashboard → SQL Editor\n2. Run the SQL from SETUP_PROFILE.md\n3. Or create a profiles table with columns: id (UUID), name, email, bio, avatar_url\n\nSee SETUP_PROFILE.md for detailed instructions.'
        : errorMessage.includes('permission') || errorMessage.includes('policy')
        ? 'Permission denied. Please check your Supabase Storage policies and ensure the avatars bucket is public or has proper RLS policies.'
        : `Failed to upload avatar: ${errorMessage}`;
      
      alert(detailedMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle preset avatar selection
  const handlePresetSelect = async (presetId: string) => {
    if (!user) return;

    setUploadingAvatar(true);
    try {
      // For presets, we'll use a placeholder URL pattern
      // In production, you might want to host preset images
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${presetId}-${user.id}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: avatarUrl,
        }, { onConflict: 'id' });

      if (updateError) {
        console.error('Error setting preset avatar:', updateError);
        if (updateError.message.includes('relation') || updateError.message.includes('does not exist') || updateError.message.includes('404')) {
          throw new Error('❌ Profiles table not found.\n\nTo fix:\n1. Go to Supabase Dashboard → SQL Editor\n2. Run the SQL from SETUP_PROFILE.md\n3. See SETUP_PROFILE.md for detailed instructions.');
        }
        throw updateError;
      }

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      setOriginalProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      setAvatarModalOpen(false);
    } catch (error: any) {
      console.error('Error setting preset avatar:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(errorMessage.includes('❌') ? errorMessage : `Failed to set avatar: ${errorMessage}\n\nSee SETUP_PROFILE.md for setup instructions.`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle field save
  const saveField = async (field: 'name' | 'bio') => {
    if (!user) return;

    const value = profile[field];
    const originalValue = originalProfile[field];

    // Only save if changed
    if (value === originalValue) {
      setSavedFields(prev => new Set(prev).add(field));
      setTimeout(() => {
        setSavedFields(prev => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
      }, 2000);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          [field]: value,
          email: profile.email, // Keep email
        }, { onConflict: 'id' });

      if (error) {
        console.error(`Error saving ${field}:`, error);
        if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('404')) {
          throw new Error('❌ Profiles table not found.\n\nTo fix:\n1. Go to Supabase Dashboard → SQL Editor\n2. Run the SQL from SETUP_PROFILE.md\n3. See SETUP_PROFILE.md for detailed instructions.');
        }
        throw error;
      }

      setOriginalProfile(prev => ({ ...prev, [field]: value }));
      setSavedFields(prev => new Set(prev).add(field));
      setTimeout(() => {
        setSavedFields(prev => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
      }, 2000);
    } catch (error: any) {
      console.error(`Error saving ${field}:`, error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(errorMessage.includes('❌') ? errorMessage : `Failed to save ${field}: ${errorMessage}\n\nSee SETUP_PROFILE.md for setup instructions.`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        {/* Page Title */}
        <div className="mb-10">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Profile</h1>
          <p className="text-slate-300">Manage your traveler identity and preferences</p>
        </div>

        {/* Traveler's Identity Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-8 mb-8"
        >
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              className="relative mb-4"
              onMouseEnter={() => setHoveredAvatar(true)}
              onMouseLeave={() => {
                setHoveredAvatar(false);
                handleAvatarMouseLeave();
              }}
              onMouseMove={handleAvatarMouseMove}
              style={{
                x: springX,
                y: springY,
              }}
            >
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 bg-gradient-to-br from-indigo-500 to-purple-600">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    {getInitials(profile.name)}
                  </div>
                )}
                
                {/* Edit Overlay */}
                <AnimatePresence>
                  {hoveredAvatar && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center cursor-pointer"
                      onClick={() => setAvatarModalOpen(true)}
                    >
                      <Camera className="w-8 h-8 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            <p className="text-slate-300 text-sm">Click to edit avatar</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Name Field */}
            <div className="relative">
              <motion.label
                initial={false}
                animate={{
                  y: focusedField === 'name' || profile.name ? -24 : 0,
                  scale: focusedField === 'name' || profile.name ? 0.875 : 1,
                  color: focusedField === 'name' ? '#cbd5e1' : '#94a3b8',
                }}
                className="absolute left-4 top-4 text-slate-400 pointer-events-none origin-left transition-colors"
              >
                Name
              </motion.label>
              <motion.input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                onFocus={() => setFocusedField('name')}
                onBlur={() => {
                  setFocusedField(null);
                  saveField('name');
                }}
                className={`w-full px-4 pt-6 pb-2 bg-slate-900/60 backdrop-blur-xl border rounded-2xl text-white placeholder-transparent focus:outline-none focus:ring-2 transition-all ${
                  savedFields.has('name')
                    ? 'border-green-500/50 ring-2 ring-green-500/20'
                    : 'border-white/20 focus:border-indigo-500/50 focus:ring-indigo-500/20'
                }`}
              />
              {savedFields.has('name') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-4 top-4"
                >
                  <Check className="w-5 h-5 text-green-500" />
                </motion.div>
              )}
            </div>

            {/* Email Field (read-only) */}
            <div className="relative">
              <motion.label
                initial={false}
                animate={{
                  y: focusedField === 'email' || profile.email ? -24 : 0,
                  scale: focusedField === 'email' || profile.email ? 0.875 : 1,
                  color: '#94a3b8',
                }}
                className="absolute left-4 top-4 text-slate-400 pointer-events-none origin-left"
              >
                Email
              </motion.label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 pt-6 pb-2 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* Bio Field */}
            <div className="relative">
              <motion.label
                initial={false}
                animate={{
                  y: focusedField === 'bio' || profile.bio ? -24 : 0,
                  scale: focusedField === 'bio' || profile.bio ? 0.875 : 1,
                  color: focusedField === 'bio' ? '#cbd5e1' : '#94a3b8',
                }}
                className="absolute left-4 top-4 text-slate-400 pointer-events-none origin-left transition-colors"
              >
                Bio
              </motion.label>
              <motion.textarea
                value={profile.bio}
                onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => {
                  setFocusedField(null);
                  saveField('bio');
                }}
                rows={4}
                className={`w-full px-4 pt-6 pb-2 bg-slate-900/60 backdrop-blur-xl border rounded-2xl text-white placeholder-transparent focus:outline-none focus:ring-2 transition-all resize-none ${
                  savedFields.has('bio')
                    ? 'border-green-500/50 ring-2 ring-green-500/20'
                    : 'border-white/20 focus:border-indigo-500/50 focus:ring-indigo-500/20'
                }`}
              />
              {savedFields.has('bio') && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-4 top-4"
                >
                  <Check className="w-5 h-5 text-green-500" />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Travel Statistics Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-3xl p-6 text-center"
          >
            <Plane className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">{stats.totalTrips}</div>
            <div className="text-slate-400 text-sm">Trips</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-6 text-center"
          >
            <User className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-1">{stats.connections}</div>
            <div className="text-slate-400 text-sm">Connections</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-3xl p-6 text-center"
          >
            <Compass className="w-10 h-10 text-orange-400 mx-auto mb-3" />
            <div className="text-lg font-bold text-white mb-1">{stats.explorerLevel}</div>
            <div className="text-slate-400 text-sm">Explorer Level</div>
          </motion.div>
        </div>

        {/* Avatar Upload Modal */}
        <AnimatePresence>
          {avatarModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  stopCamera();
                  setAvatarModalOpen(false);
                }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="glass-card rounded-3xl p-8 max-w-md w-full border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Edit Avatar</h2>
                    <button
                      onClick={() => {
                        stopCamera();
                        setAvatarModalOpen(false);
                      }}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>

                  {/* Camera Mode */}
                  {cameraMode ? (
                    <div className="mb-6">
                      <div className="relative bg-slate-900 rounded-2xl overflow-hidden mb-4 aspect-square border-2 border-white/20 min-h-[300px]">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover rounded-2xl"
                          style={{ transform: 'scaleX(-1)' }} // Mirror effect for better UX
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {!stream && (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
                            <div className="text-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              >
                                <Video className="w-12 h-12 mx-auto mb-2" />
                              </motion.div>
                              <p className="text-sm">Starting camera...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={stopCamera}
                          className="flex-1 px-6 py-3 bg-slate-700 border border-white/20 rounded-2xl text-white hover:bg-slate-600 transition-all"
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={capturePhoto}
                          disabled={uploadingAvatar}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl text-white hover:from-indigo-700 hover:to-violet-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Circle className="w-5 h-5 fill-white" />
                          {uploadingAvatar ? 'Uploading...' : 'Capture'}
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Take Photo Option */}
                      <div className="mb-6">
                        <label className="block mb-3 text-slate-300 text-sm font-semibold">Take Photo</label>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={startCamera}
                          disabled={uploadingAvatar}
                          className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-700 border border-white/20 rounded-2xl text-white hover:from-indigo-700 hover:to-violet-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          <Video className="w-5 h-5" />
                          Use Camera
                        </motion.button>
                      </div>

                      {/* Upload Option */}
                      <div className="mb-6">
                        <label className="block mb-3 text-slate-300 text-sm font-semibold">Upload Photo</label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          className="hidden"
                        />
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="w-full px-6 py-4 bg-slate-900/60 border border-white/20 rounded-2xl text-white hover:bg-slate-900/80 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          <Upload className="w-5 h-5" />
                          {uploadingAvatar ? 'Uploading...' : 'Choose File'}
                        </motion.button>
                      </div>
                    </>
                  )}

                  {/* Preset Avatars */}
                  {!cameraMode && (
                    <div>
                      <label className="block mb-3 text-slate-300 text-sm font-semibold">Or Choose a Preset</label>
                    <div className="grid grid-cols-4 gap-4">
                      {avatarPresets.map((preset) => {
                        const Icon = preset.icon;
                        return (
                          <motion.button
                            key={preset.id}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handlePresetSelect(preset.id)}
                            disabled={uploadingAvatar}
                            className={`p-4 rounded-2xl bg-gradient-to-br ${preset.color} border-2 border-white/20 hover:border-white/40 transition-all disabled:opacity-50`}
                          >
                            <Icon className="w-8 h-8 text-white mx-auto mb-2" />
                            <div className="text-xs text-white font-semibold">{preset.label}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
