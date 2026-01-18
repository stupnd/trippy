'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationCenter from './NotificationCenter';

export default function NotificationBadge() {
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get read notifications from localStorage
  const getReadNotifications = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(`notifications_read_${user?.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  useEffect(() => {
    if (!user) {
      setNotificationCount(0);
      return;
    }

    const fetchNotificationCount = async () => {
      try {
        const readSet = getReadNotifications();

        // Get all trips user is a member of
        const { data: memberships } = await supabase
          .from('trip_members')
          .select('trip_id, id')
          .eq('user_id', user.id);

        if (!memberships || memberships.length === 0) {
          setNotificationCount(0);
          return;
        }

        const tripIds = memberships.map(m => m.trip_id);
        const memberIds = new Set(memberships.map(m => m.id));

        // Fetch all messages in user's trips
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, trip_id, member_id, created_at')
          .in('trip_id', tripIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (messagesError) {
          console.error('Error fetching notifications:', messagesError);
        }

        // Count unread messages
        let unreadMessageCount = 0;
        if (messages) {
          const otherMessages = messages.filter(msg => !memberIds.has(msg.member_id));
          otherMessages.forEach(msg => {
            const notificationId = `msg_${msg.id}`;
            if (!readSet.has(notificationId)) {
              unreadMessageCount++;
            }
          });
        }

        // Fetch pending join requests for trips user created
        const { data: userTrips } = await supabase
          .from('trips')
          .select('id')
          .eq('created_by', user.id);

        const userTripIds = (userTrips || []).map(t => t.id);
        let unreadRequestCount = 0;

        if (userTripIds.length > 0) {
          const { data: joinRequests, error: requestsError } = await supabase
            .from('join_requests')
            .select('id')
            .in('trip_id', userTripIds)
            .eq('status', 'pending');

          if (!requestsError && joinRequests) {
            joinRequests.forEach(request => {
              const notificationId = `req_${request.id}`;
              if (!readSet.has(notificationId)) {
                unreadRequestCount++;
              }
            });
          }
        }

        // Total unread notifications
        setNotificationCount(unreadMessageCount + unreadRequestCount);
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();

    // Set up real-time subscription for new messages and requests
    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchNotificationCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'join_requests',
        },
        () => {
          fetchNotificationCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'join_requests',
        },
        () => {
          fetchNotificationCount();
        }
      )
      .subscribe();

    // Poll every 30 seconds to catch any missed updates
    const interval = setInterval(fetchNotificationCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, refreshKey]);

  const handleClick = () => {
    // Open notification center
    setCenterOpen(true);
  };

  const handleNotificationRead = () => {
    // Trigger refetch by updating refresh key
    setRefreshKey(prev => prev + 1);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors dark:hover:bg-white/10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        <AnimatePresence>
          {notificationCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-slate-50 dark:border-slate-900"
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <NotificationCenter 
        isOpen={centerOpen} 
        onClose={() => setCenterOpen(false)}
        onNotificationRead={handleNotificationRead}
      />
    </>
  );
}
