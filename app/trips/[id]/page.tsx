'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Plane, Hotel, Target, Calendar, Utensils, Settings, Sparkles, Share2, Trash2, LogOut, Users, Circle, X, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';
import { TripRow, TripMemberRow } from '@/lib/supabase';

interface MemberWithStatus extends TripMemberRow {
  hasPreferences: boolean;
  avatar_url?: string | null;
}

type ModuleStatus = 'Awaiting Preferences' | 'Ready to Generate' | 'Locked';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [preferencesUpdatedAt, setPreferencesUpdatedAt] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState('');
  const [budgetBreakdownOpen, setBudgetBreakdownOpen] = useState(false);
  const [budgetTab, setBudgetTab] = useState<'breakdown' | 'itinerary'>('breakdown');
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState('');
  const [itineraryDays, setItineraryDays] = useState<
    {
      date: string;
      title: string;
      budget_range?: string;
      morning: string;
      afternoon: string;
      evening: string;
      notes?: string;
    }[]
  >([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    country: '',
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState('');
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'members' | 'chat'>('members');
  const [unreadCount, setUnreadCount] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const disableMotion = shouldReduceMotion;

  const tripStatusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'booked', label: 'Booked' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' },
  ];

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && !memberLoading && isMember === false) {
      router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && isMember) {
      fetchDashboardData();
    }
  }, [authLoading, user, memberLoading, isMember, tripId, router]);

  const fetchDashboardData = async () => {
    try {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      if (tripError && tripError.code !== 'PGRST116') {
        throw tripError;
      }

      if (!tripData) {
        router.push(`/trips/join?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
        return;
      }

      setTrip(tripData);
      setEditForm({
        name: tripData.name || '',
        city: tripData.destination_city || '',
        country: tripData.destination_country || '',
        startDate: tripData.start_date || '',
        endDate: tripData.end_date || '',
      });

      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('member_id, updated_at')
        .eq('trip_id', tripId);

      if (preferencesError) throw preferencesError;

      const membersWithPreferences = new Set(
        (preferencesData || []).map((p) => p.member_id)
      );

      // Fetch profile avatars for all members
      const memberUserIds = (membersData || []).map(m => (m as any).user_id).filter(Boolean);
      
      console.log('Member user IDs to fetch avatars for:', memberUserIds);
      
      let profilesData = null;
      if (memberUserIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', memberUserIds);
        
        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError);
          console.error('Error details:', JSON.stringify(profilesError, null, 2));
        } else {
          profilesData = data;
          console.log('✅ Fetched profiles for avatars:', profilesData);
          if (!profilesData || profilesData.length === 0) {
            console.warn('⚠️ No profiles found. This might be an RLS (Row Level Security) issue.');
            console.warn('Check Supabase RLS policies on the profiles table.');
          }
        }
      } else {
        console.warn('⚠️ No member user IDs found. All members might have null user_id.');
      }

      // Create a map of user_id -> avatar_url
      const avatarMap = new Map<string, string | null>();
      (profilesData || []).forEach(profile => {
        if (profile.id) {
          avatarMap.set(profile.id, profile.avatar_url || null);
          console.log(`Mapped avatar for user ${profile.id}:`, profile.avatar_url);
        }
      });

      const membersWithStatus: MemberWithStatus[] = (membersData || []).map(
        (member) => {
          const userId = (member as any).user_id;
          const avatarUrl = userId ? avatarMap.get(userId) || null : null;
          console.log(`Member ${member.name} (user_id: ${userId}): avatar_url =`, avatarUrl);
          return {
            ...member,
            hasPreferences: membersWithPreferences.has(member.id),
            avatar_url: avatarUrl,
          };
        }
      );

      console.log('Setting members with avatars:', membersWithStatus.map(m => ({ name: m.name, avatar_url: m.avatar_url })));
      setMembers(membersWithStatus);

      const latestPreferenceUpdate =
        (preferencesData || [])
          .map((p) => p.updated_at)
          .filter((value): value is string => !!value)
          .sort()
          .pop() || null;
      setPreferencesUpdatedAt(latestPreferenceUpdate);

      // After fetching, check if user is actually a member
      // If not found in members list, redirect to join
      if (user && membersWithStatus.length > 0) {
        const userIsMember = membersWithStatus.some(m => {
          return (m as any).user_id === user.id || m.id === user.id;
        });
        if (!userIsMember) {
          router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
          return;
        }
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load trip');
      if (user && error.code === 'PGRST116') {
        router.push(`/trips/join?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (moduleName: string): ModuleStatus => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    
    if (membersWithPrefs === 0) {
      return 'Awaiting Preferences';
    }
    
    return 'Ready to Generate';
  };

  const handleGenerate = async () => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    if (membersWithPrefs === 0) return;

    setGenerating(true);
    
    setTimeout(() => {
      setGenerating(false);
    }, 2000);
  };

  const membersWithPreferences = members.filter((m) => m.hasPreferences).length;
  const canGenerate = membersWithPreferences > 0;
  const isCreator = !!user && !!trip && user.id === trip.created_by;

  const hashString = (value: string) => {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const getApprovedItemsFromCache = () => {
    if (typeof window === 'undefined' || members.length === 0) {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    const suggestionsRaw = localStorage.getItem(`suggestions_${tripId}`);
    const votesRaw = localStorage.getItem(`votes_${tripId}`);
    if (!suggestionsRaw) {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    let suggestions;
    try {
      suggestions = JSON.parse(suggestionsRaw);
    } catch {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    let votes: Record<string, Record<string, boolean>> = {};
    if (votesRaw) {
      try {
        votes = JSON.parse(votesRaw);
      } catch {
        votes = {};
      }
    }

    const membersCount = members.length;
    const voteCountFor = (key: string) => {
      const optionVotes = votes[key] || {};
      return Object.values(optionVotes).filter(Boolean).length;
    };

    const flights = suggestions?.suggestions?.flights || [];
    const accommodations = suggestions?.suggestions?.accommodations || [];
    const activities = suggestions?.suggestions?.activities || [];

    return {
      flights: flights.filter((item: any) => voteCountFor(`flight_${item.id}`) === membersCount),
      accommodations: accommodations.filter((item: any) => voteCountFor(`accommodation_${item.id}`) === membersCount),
      activities: activities.filter((item: any) => voteCountFor(`activity_${item.id}`) === membersCount),
      counts: {
        flights: flights.length,
        accommodations: accommodations.length,
        activities: activities.length,
      },
    };
  };

  const maybeUpdateSummary = async (force = false) => {
    if (!trip || members.length === 0) return;

    const approved = getApprovedItemsFromCache();
    const summaryInput = JSON.stringify({
      tripId,
      trip: {
        destination_city: trip.destination_city,
        destination_country: trip.destination_country,
        start_date: trip.start_date,
        end_date: trip.end_date,
        timezone: trip.timezone,
      },
      members: members.map((m) => ({ id: m.id, name: m.name })),
      preferencesUpdatedAt,
      approvedIds: {
        flights: approved.flights.map((item: any) => item.id),
        accommodations: approved.accommodations.map((item: any) => item.id),
        activities: approved.activities.map((item: any) => item.id),
      },
      counts: approved.counts,
    });

    const summaryHash = hashString(summaryInput);
    const hashKey = `summary_hash_${tripId}`;
    const previousHash = typeof window !== 'undefined' ? localStorage.getItem(hashKey) : null;

    if (!force && previousHash === summaryHash && trip.summary) {
      return;
    }

    setSummaryLoading(true);
    setSummaryError('');

    try {
      const response = await fetch('/api/generate-trip-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          approved: {
            flights: approved.flights,
            accommodations: approved.accommodations,
            activities: approved.activities,
          },
          available_counts: approved.counts,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate trip summary');
      }

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              summary: data.summary,
              summary_updated_at: data.summary_updated_at,
            }
          : prev
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(hashKey, summaryHash);
      }
    } catch (summaryError: any) {
      console.error('Error generating trip summary:', summaryError);
      setSummaryError(summaryError.message || 'Failed to generate trip summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const maybeUpdateBudget = async (force = false) => {
    if (!trip || members.length === 0) return;

    const budgetInput = JSON.stringify({
      tripId,
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      start_date: trip.start_date,
      end_date: trip.end_date,
      timezone: trip.timezone,
      members: members.map((m) => ({ id: m.id, name: m.name })),
      preferencesUpdatedAt,
    });

    const budgetHash = hashString(budgetInput);
    const hashKey = `budget_hash_${tripId}`;
    const previousHash = typeof window !== 'undefined' ? localStorage.getItem(hashKey) : null;

    if (!force && previousHash === budgetHash && trip.budget_min != null && trip.budget_max != null) {
      return;
    }

    setBudgetLoading(true);
    setBudgetError('');

    try {
      const response = await fetch('/api/generate-trip-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate trip budget');
      }

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              budget_min: data.budget_min,
              budget_max: data.budget_max,
              budget_updated_at: data.budget_updated_at,
            }
          : prev
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(hashKey, budgetHash);
      }
    } catch (budgetError: any) {
      console.error('Error generating trip budget:', budgetError);
      setBudgetError(budgetError.message || 'Failed to generate trip budget');
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleEditTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    if (!editForm.name.trim()) {
      setEditError('Trip name is required.');
      return;
    }

    if (!editForm.city.trim() || !editForm.country.trim()) {
      setEditError('Destination city and country are required.');
      return;
    }

    if (!editForm.startDate || !editForm.endDate) {
      setEditError('Start and end dates are required.');
      return;
    }

    if (editForm.endDate < editForm.startDate) {
      setEditError('End date must be after the start date.');
      return;
    }

    setEditSaving(true);
    setEditError('');

    try {
      const { data, error: updateError } = await supabase
        .from('trips')
        .update({
          name: editForm.name.trim(),
          destination_city: editForm.city.trim(),
          destination_country: editForm.country.trim(),
          start_date: editForm.startDate,
          end_date: editForm.endDate,
        })
        .eq('id', tripId)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setTrip(data);
      setEditOpen(false);
      await maybeUpdateSummary(true);
      await maybeUpdateBudget(true);
    } catch (updateError: any) {
      console.error('Error updating trip:', updateError);
      setEditError(updateError.message || 'Failed to update trip');
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!trip || !isCreator || nextStatus === (trip.status || 'planning')) return;

    setStatusSaving(true);
    setStatusError('');

    try {
      const { data, error: updateError } = await supabase
        .from('trips')
        .update({ status: nextStatus })
        .eq('id', tripId)
        .select('status')
        .single();

      if (updateError) {
        throw updateError;
      }

      setTrip((prev) => (prev ? { ...prev, status: data?.status ?? nextStatus } : prev));
    } catch (updateError: any) {
      console.error('Error updating trip status:', updateError);
      setStatusError(updateError.message || 'Failed to update trip status');
    } finally {
      setStatusSaving(false);
    }
  };

  const fetchAiItinerary = async () => {
    if (!trip) return;

    setItineraryLoading(true);
    setItineraryError('');

    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem(`itinerary_${tripId}`) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItineraryDays(parsed);
          setItineraryLoading(false);
          return;
        }
      }

      const response = await fetch('/api/generate-trip-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate itinerary');
      }

      const days = Array.isArray(data.days) ? data.days : [];
      setItineraryDays(days);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`itinerary_${tripId}`, JSON.stringify(days));
      }
    } catch (err: any) {
      console.error('Error generating itinerary:', err);
      setItineraryError(err.message || 'Failed to generate itinerary');
    } finally {
      setItineraryLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip || !user || user.id !== trip.created_by) return;
    const confirmed = window.confirm(
      'Delete this trip for everyone? This cannot be undone.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('trip_id', tripId);
      if (preferencesError) throw preferencesError;

      const { error: membersError } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId);
      if (membersError) throw membersError;

      const { error: tripError } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);
      if (tripError) throw tripError;

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`suggestions_${tripId}`);
        localStorage.removeItem(`votes_${tripId}`);
      }

      router.push('/');
    } catch (deleteError: any) {
      console.error('Error deleting trip:', deleteError);
      setError(deleteError.message || 'Failed to delete trip');
      setDeleting(false);
    }
  };

  const handleLeaveTrip = async () => {
    if (!user || !trip || user.id === trip.created_by) return;
    const confirmed = window.confirm('Leave this trip? You can rejoin with the invite code.');
    if (!confirmed) return;

    setLeaving(true);
    setError('');

    try {
      const { error: leaveError } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', user.id);
      if (leaveError) throw leaveError;

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`suggestions_${tripId}`);
        localStorage.removeItem(`votes_${tripId}`);
      }

      router.push('/');
    } catch (leaveError: any) {
      console.error('Error leaving trip:', leaveError);
      setError(leaveError.message || 'Failed to leave trip');
      setLeaving(false);
    }
  };

  useEffect(() => {
    if (trip && members.length > 0) {
      maybeUpdateSummary();
      maybeUpdateBudget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, members.length, preferencesUpdatedAt]);

  useEffect(() => {
    if (budgetBreakdownOpen && budgetTab === 'itinerary' && itineraryDays.length === 0 && !itineraryLoading) {
      fetchAiItinerary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetBreakdownOpen, budgetTab]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && membersDrawerOpen) {
        setMembersDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [membersDrawerOpen]);

  // Track unread messages when drawer is closed
  useEffect(() => {
    if (!user || members.length === 0) return;

    const currentMember = members.find(m => m.user_id === user.id);
    if (!currentMember) return;

    // Only listen for new messages when drawer is closed or chat tab is not active
    const shouldTrackUnread = !membersDrawerOpen || drawerTab !== 'chat';

    if (!shouldTrackUnread) {
      return; // Don't track unread when chat is visible
    }

    const channel = supabase
      .channel(`trip_unread_messages_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only count messages from others
          if (newMsg.member_id !== currentMember.id) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, members, user, membersDrawerOpen, drawerTab]);

  // Real-time profile updates for avatar sync
  useEffect(() => {
    if (!tripId || members.length === 0) return;

    // Get all user IDs from current members
    const memberUserIds = members.map(m => (m as any).user_id).filter(Boolean);
    if (memberUserIds.length === 0) return;

    console.log('Setting up real-time profile subscription for user IDs:', memberUserIds);

    // Subscribe to each profile individually (Supabase filter might not work with multiple IDs)
    const channels = memberUserIds.map(userId => {
      const channel = supabase
        .channel(`trip_profile_${tripId}_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            console.log('Profile updated via real-time:', payload);
            // When a profile is updated (e.g., avatar_url changed), re-fetch members
            fetchDashboardData();
          }
        )
        .subscribe();
      return channel;
    });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, members]);

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-12 bg-white/5 rounded-3xl w-64 mb-4 shimmer-loader"></div>
            <div className="h-6 bg-white/5 rounded-3xl w-48 shimmer-loader"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="glass-card p-6 h-32 shimmer-loader"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4 tracking-tight">
            {error || 'Trip not found'}
          </h1>
          <Link href="/" className="text-blue-400 hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/trips/join?code=${trip.invite_code}`
      : '';

  return (
    <div className="min-h-screen">
      <AnimatePresence initial={false} mode="wait">
        {budgetBreakdownOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
            initial={disableMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card w-full max-w-5xl rounded-3xl p-6 border border-white/10 max-h-[90vh] overflow-hidden"
              initial={disableMotion ? false : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Budget Breakdown</h2>
                  <p className="text-sm text-slate-400">
                    {trip.budget_min != null && trip.budget_max != null
                      ? `Estimated range: $${trip.budget_min} - $${trip.budget_max} per person`
                      : 'Budget range not set yet'}
                  </p>
                </div>
                <button
                  onClick={() => setBudgetBreakdownOpen(false)}
                  className="text-slate-300 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                {['breakdown', 'itinerary'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBudgetTab(tab as 'breakdown' | 'itinerary')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      budgetTab === tab
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab === 'breakdown' ? 'Budget Breakdown' : 'Suggested Itinerary'}
                  </button>
                ))}
              </div>

              {trip.budget_min == null || trip.budget_max == null ? (
                <div className="glass-card p-6 rounded-2xl text-slate-300">
                  Set preferences to generate a budget range first.
                </div>
              ) : (
                <>
                  {budgetTab === 'breakdown' && (() => {
                    const nights = Math.max(
                      1,
                      differenceInCalendarDays(new Date(trip.end_date), new Date(trip.start_date)) || 1
                    );
                    const min = trip.budget_min || 0;
                    const max = trip.budget_max || 0;
                    const items = [
                      { label: 'Flights', pct: 0.25, icon: '✈️' },
                      { label: 'Lodging', pct: 0.4, icon: '🏨' },
                      { label: 'Activities', pct: 0.2, icon: '🎯' },
                      { label: 'Food', pct: 0.1, icon: '🍽️' },
                      { label: 'Buffer', pct: 0.05, icon: '🛡️' },
                    ];

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map((item) => (
                          <div key={item.label} className="glass-card p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-white">
                                <span className="text-lg">{item.icon}</span>
                                <span className="font-semibold">{item.label}</span>
                              </div>
                              <span className="text-slate-300 text-sm">
                                ${Math.round(min * item.pct)} - ${Math.round(max * item.pct)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              ~${Math.round((min * item.pct) / nights)} - ${Math.round((max * item.pct) / nights)} per night
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${Math.round(item.pct * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {budgetTab === 'itinerary' && (() => {
                    const days = Math.max(
                      1,
                      differenceInCalendarDays(new Date(trip.end_date), new Date(trip.start_date)) || 1
                    );
                    const perDayMin = Math.round((trip.budget_min || 0) / days);
                    const perDayMax = Math.round((trip.budget_max || 0) / days);
                    return (
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-slate-400">
                            AI itinerary aligned to your budget (${perDayMin}-{perDayMax} / day)
                          </div>
                          <button
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                localStorage.removeItem(`itinerary_${tripId}`);
                              }
                              setItineraryDays([]);
                              fetchAiItinerary();
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 border border-white/10 hover:bg-white/10 transition-all"
                          >
                            Regenerate
                          </button>
                        </div>

                        {itineraryLoading && (
                          <div className="glass-card p-4 rounded-2xl text-slate-300 text-sm">
                            Generating itinerary...
                          </div>
                        )}

                        {itineraryError && (
                          <div className="glass-card p-4 rounded-2xl text-red-200 text-sm border border-red-500/30 bg-red-500/10">
                            {itineraryError}
                          </div>
                        )}

                        {!itineraryLoading && itineraryDays.length === 0 && !itineraryError && (
                          <div className="glass-card p-4 rounded-2xl text-slate-300 text-sm">
                            No itinerary yet. Click regenerate to create one.
                          </div>
                        )}

                        {!itineraryLoading && itineraryDays.length > 0 && (
                          <>
                            {itineraryDays.map((day, idx) => (
                              <div key={`${day.date}-${idx}`} className="glass-card p-4 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-white font-semibold">
                                    Day {idx + 1} · {format(new Date(day.date), 'MMM d')}
                                  </div>
                                  <div className="text-xs text-slate-300">
                                    {day.budget_range || `$${perDayMin} - $${perDayMax} / day`}
                                  </div>
                                </div>
                                {day.title && (
                                  <div className="text-sm text-slate-300 mb-3">{day.title}</div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300">
                                  <div className="rounded-xl bg-white/5 p-3">
                                    <div className="text-slate-200 font-medium mb-1">Morning</div>
                                    {day.morning}
                                  </div>
                                  <div className="rounded-xl bg-white/5 p-3">
                                    <div className="text-slate-200 font-medium mb-1">Afternoon</div>
                                    {day.afternoon}
                                  </div>
                                  <div className="rounded-xl bg-white/5 p-3">
                                    <div className="text-slate-200 font-medium mb-1">Evening</div>
                                    {day.evening}
                                  </div>
                                </div>
                                {day.notes && (
                                  <div className="text-xs text-slate-400 mt-3">{day.notes}</div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card w-full max-w-lg rounded-3xl p-6 border border-white/10"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Edit Trip</h2>
                <button
                  onClick={() => setEditOpen(false)}
                  className="text-slate-300 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditTrip} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Trip Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Country</label>
                    <input
                      type="text"
                      value={editForm.country}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">End Date</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                {editError && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
                    {editError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="flex-1 rounded-2xl border border-white/10 px-4 py-2 text-slate-200 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="flex-1 rounded-2xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 md:px-8 max-w-7xl pt-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-200 transition-colors">
            My Trips
          </Link>
          <span>›</span>
          <span className="text-slate-300">{trip.name}</span>
        </div>
      </div>

      {/* Header - Transparent Section */}
      <div className="container mx-auto px-4 md:px-8 max-w-7xl pb-10">
        {unreadCount > 0 && drawerTab !== 'chat' && (
          <button
            type="button"
            onClick={() => {
              setMembersDrawerOpen(true);
              setDrawerTab('chat');
              setUnreadCount(0);
            }}
            className="w-full mb-4 glass-card border border-blue-500/30 bg-blue-500/10 text-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-blue-500/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">
                New chat message{unreadCount > 1 ? 's' : ''} in this trip
              </span>
            </div>
            <span className="text-xs font-semibold bg-blue-500 text-white px-2 py-1 rounded-full">
              View chat
            </span>
          </button>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Left Side: Title & Location */}
          <div className="flex-1 min-w-0">
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2 truncate">{trip.name}</h1>
            <p className="text-slate-400 truncate">
              {trip.destination_city}, {trip.destination_country}
            </p>
            {budgetError && (
              <p className="text-xs text-red-300 mt-2">{budgetError}</p>
            )}
            {statusError && (
              <p className="text-xs text-red-300 mt-1">{statusError}</p>
            )}
          </div>

          {/* Right Side: Badge & Action Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Budget Badge */}
            <button
              type="button"
              onClick={() => {
                setBudgetTab('breakdown');
                setBudgetBreakdownOpen(true);
              }}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs whitespace-nowrap hover:bg-white/10 transition-all"
            >
              {budgetLoading ? (
                <span>Budget: calculating...</span>
              ) : trip.budget_min != null && trip.budget_max != null ? (
                <span>Budget: ${trip.budget_min} - ${trip.budget_max}</span>
              ) : (
                <span>Budget: not set</span>
              )}
            </button>
            <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs whitespace-nowrap flex items-center gap-2">
              <span>
                Status:{' '}
                {tripStatusOptions.find((opt) => opt.value === (trip.status || 'planning'))?.label ||
                  'Planning'}
              </span>
              {isCreator && (
                <select
                  value={trip.status || 'planning'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={statusSaving}
                  className="bg-transparent text-slate-200 text-xs border border-white/10 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {tripStatusOptions.map((option) => (
                    <option key={option.value} value={option.value} className="text-slate-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 items-center">
              <Link
                href={`/trips/${tripId}/share`}
                className="px-4 py-2 rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all flex items-center gap-1.5 text-sm"
              >
                <Share2 className="w-4 h-4 opacity-70" />
                <span className="hidden sm:inline">Share</span>
              </Link>
              {isCreator && (
                <button
                  onClick={() => {
                    if (trip) {
                      setEditForm({
                        name: trip.name || '',
                        city: trip.destination_city || '',
                        country: trip.destination_country || '',
                        startDate: trip.start_date || '',
                        endDate: trip.end_date || '',
                      });
                    }
                    setEditError('');
                    setEditOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all flex items-center gap-1.5 text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
              {isCreator && (
                <button
                  onClick={handleDeleteTrip}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl font-medium text-red-300 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}
              {!isCreator && (
                <button
                  onClick={handleLeaveTrip}
                  disabled={leaving}
                  className="px-4 py-2 rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/10 hover:border-white/30 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{leaving ? 'Leaving...' : 'Leave'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {error && (
          <div className="glass-card border-red-500/50 bg-red-500/10 text-red-200 px-4 py-3 rounded-3xl mb-6">
            {error}
          </div>
        )}

        {/* Generate Button */}
        {canGenerate && (
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`px-8 py-4 rounded-3xl font-semibold text-lg transition-all glass-card-hover ${
                generating
                  ? 'bg-blue-500/30 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
              }`}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating Trip Options...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate Trip Options
                </span>
              )}
            </button>
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Member Status - Large Card (Clickable) */}
          <button
            onClick={() => {
              setMembersDrawerOpen(true);
              setDrawerTab('members');
            }}
            className="md:col-span-2 glass-card p-6 glass-card-hover cursor-pointer text-left w-full hover:bg-white/10 transition-all relative"
          >
            {unreadCount > 0 && (
              <span className="absolute top-4 right-4 w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center animate-pulse z-10">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-blue-400 opacity-80" />
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Trip Members ({members.length})
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <Circle className="w-2 h-2 fill-red-500 text-red-500 live-pulse" />
                <span className="text-xs text-slate-400">Live</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {members.map((member, index) => {
                const initials = member.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                const colors = [
                  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500',
                  'bg-orange-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500'
                ];
                const colorClass = colors[index % colors.length];
                
                return (
                  <div key={member.id} className="relative inline-flex items-center">
                    {/* Avatar Circle */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className={`relative w-12 h-12 ${colorClass} rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/20 overflow-hidden ${
                        !member.hasPreferences ? 'animate-pulse' : ''
                      }`}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            console.error('Failed to load avatar for', member.name, ':', member.avatar_url);
                            // Hide the image on error and show initials instead
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('Avatar loaded successfully for', member.name, ':', member.avatar_url);
                          }}
                        />
                      ) : (
                        initials
                      )}
                      
                      {/* Pulsing ring for "Live" members */}
                      {member.hasPreferences && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-green-400"
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.6, 0, 0.6],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}
                      
                      {/* Status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 ${
                        member.hasPreferences ? 'bg-green-400' : 'bg-yellow-400'
                      }`} />
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </button>

          {/* Preferences Card */}
          <Link
            href={`/trips/${tripId}/preferences`}
            className="glass-card p-6 glass-card-hover"
          >
            <Settings className="w-8 h-8 text-purple-400 opacity-80 mb-3" />
            <h3 className="text-lg font-semibold mb-2 text-white tracking-tight">
              Set Preferences
            </h3>
            <p className="text-slate-300 text-sm">
              Tell us what you want
            </p>
          </Link>

          {/* AI Suggestions Card */}
          <Link
            href={`/trips/${tripId}/suggestions`}
            className="glass-card p-6 glass-card-hover bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20"
          >
            <Sparkles className="w-8 h-8 text-purple-400 opacity-80 mb-3" />
            <h3 className="text-lg font-semibold mb-2 text-white tracking-tight">
              AI Suggestions
            </h3>
            <p className="text-slate-300 text-sm">
              View recommendations
            </p>
          </Link>
        </div>

        {/* Trip Summary - Concierge Perspective */}
        <div className="glass-card rounded-3xl p-6 mb-6 relative">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold text-white tracking-tight">Trip Summary</h2>
            <button
              onClick={() => maybeUpdateSummary(true)}
              disabled={summaryLoading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={summaryLoading ? 'Updating...' : 'Refresh Summary'}
            >
              <motion.div
                animate={summaryLoading ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: summaryLoading ? Infinity : 0, ease: 'linear' }}
              >
                <Settings className="w-4 h-4" />
              </motion.div>
            </button>
          </div>
          {summaryError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl mb-4 text-sm">
              {summaryError}
            </div>
          )}
          {summaryLoading && !trip.summary && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"
              />
              Generating summary...
            </div>
          )}
          {!summaryLoading && trip.summary && (
            <div className="space-y-3">
              {(() => {
                // Parse summary into bullet points (simple extraction)
                const lines = trip.summary.split('\n').filter(l => l.trim());
                const bullets = lines
                  .map(line => {
                    const clean = line.trim().replace(/^[•\-\*]\s*/, '');
                    if (clean.length < 20) return null;
                    
                    // Extract icon patterns
                    if (clean.toLowerCase().includes('destination') || clean.toLowerCase().includes('location')) {
                      return { icon: '📍', text: clean.replace(/.*?destination:?\s*/i, '').trim() || clean };
                    } else if (clean.toLowerCase().includes('traveler') || clean.toLowerCase().includes('member') || clean.toLowerCase().includes('people')) {
                      return { icon: '👥', text: clean };
                    } else if (clean.toLowerCase().includes('date') || clean.toLowerCase().includes('duration') || clean.toLowerCase().includes('when')) {
                      return { icon: '📅', text: clean };
                    } else if (clean.toLowerCase().includes('budget') || clean.toLowerCase().includes('cost')) {
                      return { icon: '💰', text: clean };
                    } else {
                      return { icon: '✨', text: clean };
                    }
                  })
                  .filter(Boolean)
                  .slice(0, 4); // Limit to 4 bullets
                
                return bullets.length > 0 ? bullets : [
                  { icon: '📍', text: `${trip.destination_city}, ${trip.destination_country}` },
                  { icon: '👥', text: `${members.length} Travelers` },
                  { icon: '📅', text: `${format(new Date(trip.start_date), 'MMM d')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}` },
                  { icon: '💰', text: trip.budget_min && trip.budget_max ? `Budget: $${trip.budget_min} - $${trip.budget_max}` : 'Budget: Flexible' }
                ];
              })().map((item: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-slate-300 text-sm">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <span className="flex-1 leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          )}
          {!summaryLoading && !trip.summary && !summaryError && (
            <div className="space-y-3 text-slate-400 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">📍</span>
                <span className="flex-1">{trip.destination_city}, {trip.destination_country}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">👥</span>
                <span className="flex-1">{members.length} Travelers</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">📅</span>
                <span className="flex-1">{format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Progress Overview - Module Cards with Staggered Animation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          {[
            { title: 'Flights', icon: Plane, status: getModuleStatus('flights'), href: `/trips/${tripId}/suggestions?tab=flights` },
            { title: 'Accommodations', icon: Hotel, status: getModuleStatus('accommodations'), href: `/trips/${tripId}/suggestions?tab=stays` },
            { title: 'Activities', icon: Target, status: getModuleStatus('activities'), href: `/trips/${tripId}/suggestions?tab=activities` },
            { title: 'Itinerary', icon: Calendar, status: getModuleStatus('itinerary'), href: `/trips/${tripId}/suggestions?tab=itinerary` },
            { title: 'Food Recommendations', icon: Utensils, status: getModuleStatus('food'), href: `/trips/${tripId}/food` },
          ].map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <ModuleCard
                title={module.title}
                icon={module.icon}
                status={module.status}
                href={module.href}
              />
            </motion.div>
          ))}
        </div>

        {/* Invite Card */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2 tracking-tight">
            <Share2 className="w-5 h-5 text-blue-400 opacity-80" />
            Invite Friends
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={trip.invite_code}
                      className="flex-1 px-4 py-3 border border-white/20 rounded-2xl bg-slate-900/60 backdrop-blur-xl font-mono text-sm font-bold text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(trip.invite_code);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all glass-card-hover"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Share this code or{' '}
              <a
                href={inviteLink}
                className="text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                use the invite link
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Members Drawer */}
      <AnimatePresence>
        {membersDrawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMembersDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/20 dark:bg-black/50 backdrop-blur-sm z-[90]"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
              }}
              className="fixed top-16 right-0 h-[calc(100vh-4rem)] w-full max-w-md bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-white/20 z-[100] shadow-2xl"
            >
            <div className="h-full flex flex-col pt-4">
              {/* Header */}
              <div className="p-6 border-b border-slate-200 dark:border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {drawerTab === 'members' ? 'Trip Members' : 'Group Chat'}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {drawerTab === 'members' ? `${members.length} members` : 'Live chat'}
                    </p>
                  </div>
                  <button
                    onClick={() => setMembersDrawerOpen(false)}
                    className="glass-card p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors z-10 relative"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setDrawerTab('members')}
                    className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                      drawerTab === 'members'
                        ? 'bg-sky-100 text-slate-900 border border-sky-200 dark:bg-white/10 dark:text-white dark:border-white/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Users className="w-4 h-4" />
                      Members
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setDrawerTab('chat');
                      setUnreadCount(0); // Clear unread count when opening chat
                    }}
                    className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all relative ${
                      drawerTab === 'chat'
                        ? 'bg-sky-100 text-slate-900 border border-sky-200 dark:bg-white/10 dark:text-white dark:border-white/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Chat
                      {unreadCount > 0 && drawerTab === 'members' && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Content based on selected tab */}
              {drawerTab === 'members' ? (
                <>
                  {/* Member List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {members.map((member, index) => {
                  const initials = member.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                  const colors = [
                    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500',
                    'bg-orange-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500'
                  ];
                  const colorClass = colors[index % colors.length];

                  return (
                    <div
                      key={member.id}
                      className="glass-card p-4 rounded-2xl flex items-center gap-4 border-slate-200 dark:border-white/20"
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className={`w-14 h-14 ${colorClass} rounded-full flex items-center justify-center text-white font-bold text-base border-2 border-slate-200 dark:border-white/20 overflow-hidden ${
                          !member.hasPreferences ? 'animate-pulse' : ''
                        }`}>
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        
                        {/* Live indicator ring */}
                        {member.hasPreferences && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-green-400"
                            animate={{
                              scale: [1, 1.3, 1],
                              opacity: [0.6, 0, 0.6],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        )}
                        
                        {/* Status dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-950 ${
                          member.hasPreferences ? 'bg-green-400' : 'bg-yellow-400'
                        }`} />
                      </div>

                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{member.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {member.hasPreferences ? (
                            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 font-medium dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30">
                              ✓ Ready
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full border border-yellow-200 font-medium dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30">
                              ⏳ Thinking
                            </span>
                          )}
                          {member.hasPreferences && (
                            <div className="flex items-center gap-1">
                              <Circle className="w-2 h-2 fill-red-500 text-red-500 live-pulse" />
                              <span className="text-xs text-slate-600 dark:text-slate-400">Live</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

                  {/* Footer - Invite Link */}
                  <div className="p-6 border-t border-slate-200 dark:border-white/20">
                    <div className="glass-card p-4 rounded-2xl">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Invite Code</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={trip.invite_code}
                          className="flex-1 px-3 py-2 border border-slate-200 dark:border-white/20 rounded-xl bg-white dark:bg-slate-900/60 backdrop-blur-xl font-mono text-sm font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-300/60 dark:focus:ring-blue-500/50"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(trip.invite_code);
                          }}
                          className="px-4 py-2 bg-sky-200 text-slate-900 rounded-xl font-semibold hover:bg-sky-300 transition-colors text-sm dark:bg-gradient-to-r dark:from-blue-600 dark:to-purple-600 dark:text-white dark:hover:from-blue-700 dark:hover:to-purple-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <DrawerChat tripId={tripId} members={members} />
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Drawer Chat Component
function DrawerChat({ tripId, members }: { tripId: string; members: MemberWithStatus[] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);

  // Get member color matching drawer avatars
  const getMemberColor = (memberId: string) => {
    const index = members.findIndex(m => m.id === memberId || m.user_id === memberId);
    const colors = [
      'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500'
    ];
    return colors[index % colors.length] || 'bg-slate-500';
  };

  const currentMember = members.find(m => m.user_id === user?.id);
  const isMyMessage = (message: any) => message.member_id === currentMember?.id;

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const enrichedMessages = (data || [])
          .map((msg) => {
            const member = members.find(m => m.id === msg.member_id || m.user_id === msg.member_id);
            return { ...msg, sender_name: member?.name || 'Unknown' };
          })
          .reverse();

        setMessages(enrichedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [tripId, members]);

  // Set up realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`trip_messages_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          const member = members.find(m => m.id === newMsg.member_id || m.user_id === newMsg.member_id);
          setMessages((prev) => [
            ...prev,
            { ...newMsg, sender_name: member?.name || 'Unknown' },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, members]);

  // Set up realtime subscription for typing indicators
  useEffect(() => {
    if (!currentMember) return;

    const typingChannel = supabase.channel(`trip_typing_${tripId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { member_id, is_typing } = payload.payload || {};
        
        if (!member_id) return;
        
        // Don't show typing indicator for self
        if (member_id === currentMember.id) return;

        if (is_typing) {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.add(member_id);
            return next;
          });
          // Clear typing indicator after 3 seconds of inactivity
          setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(member_id);
              return next;
            });
          }, 3000);
        } else {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(member_id);
            return next;
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Typing channel subscribed');
        }
      });

    typingChannelRef.current = typingChannel;

    return () => {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
      }
    };
  }, [tripId, currentMember]);

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!currentMember) return;
    
    const channel = typingChannelRef.current;
    if (!channel) {
      return;
    }
    
    // Check if channel is ready
    const channelState = (channel as any).state;
    if (channelState !== 'joined' && channelState !== 'SUBSCRIBED') {
      // Try again after a short delay
      setTimeout(() => broadcastTyping(isTyping), 100);
      return;
    }

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        member_id: currentMember.id,
        member_name: currentMember.name,
        is_typing: isTyping,
      },
    }).catch((err) => {
      console.error('Broadcast error:', err);
    });
  }, [currentMember]);

  // Handle typing with debounce
  const handleTyping = () => {
    if (!newMessage.trim()) {
      broadcastTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    // Broadcast that we're typing
    broadcastTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 3000);
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentMember || sending) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          trip_id: tripId,
          member_id: currentMember.id,
          content: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
      broadcastTyping(false); // Stop typing indicator when message is sent
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (!user || !currentMember) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-slate-50/80 dark:bg-transparent border border-slate-200/70 dark:border-transparent rounded-2xl transition-colors">
        {loading ? (
          <div className="text-slate-600 dark:text-slate-400 text-sm text-center py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-600 dark:text-slate-400 text-sm text-center py-8">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => {
            const isMine = isMyMessage(message);
            const senderColor = getMemberColor(message.member_id);
            const senderMember = members.find(m => m.id === message.member_id || m.user_id === message.member_id);
            const senderInitials = message.sender_name
              ?.split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?';

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Sender name */}
                  <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                    {!isMine && (
                      <div className={`w-6 h-6 ${senderColor} rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/20 overflow-hidden`}>
                        {senderMember?.avatar_url ? (
                          <img
                            src={senderMember.avatar_url}
                            alt={message.sender_name || 'User'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          senderInitials
                        )}
                      </div>
                    )}
                    <span className="text-xs text-slate-600 dark:text-slate-400">{message.sender_name}</span>
                  </div>
                  
                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-3 py-2 ${
                      isMine
                        ? 'bg-blue-100 text-slate-900 dark:bg-indigo-600/80 dark:text-white'
                        : 'bg-slate-50 text-slate-900 border border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/20'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Typing Indicators */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="flex flex-col max-w-[75%]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {Array.from(typingUsers)
                    .map((memberId) => {
                      const member = members.find(m => m.id === memberId || m.user_id === memberId);
                      return member?.name || 'Someone';
                    })
                    .join(', ')}
                  {typingUsers.size === 1 ? ' is' : ' are'} typing
                </span>
              </div>
              <div className="bg-slate-50 text-slate-900 border border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/20 rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center">
                  <motion.div
                    className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-white/20 transition-colors">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
                broadcastTyping(false);
              }
            }}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none disabled:opacity-50 text-sm transition-colors dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:placeholder-slate-400 dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-3 py-2 bg-sky-200 text-slate-900 rounded-xl font-medium hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-700 dark:text-white dark:hover:from-indigo-700 dark:hover:to-violet-800"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Module Card Component
function ModuleCard({
  title,
  icon: Icon,
  status,
  href,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: ModuleStatus;
  href: string;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'Awaiting Preferences':
        return 'text-slate-400';
      case 'Ready to Generate':
        return 'text-green-400';
      case 'Locked':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'Awaiting Preferences':
        return '⏳';
      case 'Ready to Generate':
        return '✓';
      case 'Locked':
        return '🔒';
      default:
        return '⏳';
    }
  };

  return (
    <Link
      href={href}
      className="glass-card p-6 glass-card-hover flex flex-col"
    >
      <Icon className="w-8 h-8 text-blue-400 opacity-80 mb-3" />
      <h3 className="text-lg font-semibold mb-3 text-slate-50">{title}</h3>
      <div className="flex items-center gap-2 mt-auto">
        <span className={`text-lg ${getStatusColor()}`}>{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {status}
        </span>
      </div>
    </Link>
  );
}
