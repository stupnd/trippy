'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, UserPlus, Clock, ChevronRight, Check, X as XIcon, CheckCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'message' | 'trip_request';
  trip_id: string;
  trip_name: string;
  sender_name: string;
  sender_id?: string;
  content: string;
  created_at: string;
  read: boolean;
  member_id?: string; // For trip requests
  request_id?: string; // For join requests from join_requests table
  status?: 'pending' | 'approved' | 'rejected'; // For join requests
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationRead?: () => void;
}

export default function NotificationCenter({ isOpen, onClose, onNotificationRead }: NotificationCenterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  // Load read status from localStorage
  const getReadNotifications = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(`notifications_read_${user?.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    if (typeof window === 'undefined' || !user) return;
    const readSet = getReadNotifications();
    readSet.add(notificationId);
    localStorage.setItem(`notifications_read_${user.id}`, JSON.stringify(Array.from(readSet)));
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    if (onNotificationRead) {
      onNotificationRead();
    }
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    if (typeof window === 'undefined' || !user) return;
    const readSet = getReadNotifications();
    
    // Add all current notification IDs to read set
    notifications.forEach(notification => {
      if (!notification.read) {
        readSet.add(notification.id);
      }
    });
    
    localStorage.setItem(`notifications_read_${user.id}`, JSON.stringify(Array.from(readSet)));
    
    // Update all notifications to read
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    
    if (onNotificationRead) {
      onNotificationRead();
    }
  };

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const readSet = getReadNotifications();

        // Get all trips user is a member of
        const { data: memberships } = await supabase
          .from('trip_members')
          .select('trip_id, id, user_id')
          .eq('user_id', user.id);

        if (!memberships || memberships.length === 0) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        const tripIds = memberships.map(m => m.trip_id);
        const memberIds = new Set(memberships.map(m => m.id));

        // Fetch recent messages from trips (last 50, excluding user's own messages)
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, trip_id, member_id, content, created_at')
          .in('trip_id', tripIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
        }

        // Fetch trip details for all trips
        const { data: trips } = await supabase
          .from('trips')
          .select('id, name')
          .in('id', tripIds);

        const tripMap = new Map((trips || []).map(t => [t.id, t.name]));

        // Fetch member details for message senders
        const allMemberIds = new Set<string>();
        if (messages) {
          messages.forEach(msg => {
            if (!memberIds.has(msg.member_id)) {
              allMemberIds.add(msg.member_id);
            }
          });
        }

        const memberIdsArray = Array.from(allMemberIds);
        let memberMap = new Map<string, string>();

        if (memberIdsArray.length > 0) {
          const { data: members } = await supabase
            .from('trip_members')
            .select('id, name')
            .in('id', memberIdsArray);

          if (members) {
            members.forEach(m => {
              memberMap.set(m.id, m.name);
            });
          }
        }

        // Build notification list from messages
        const messageNotifications: Notification[] = (messages || [])
          .filter(msg => !memberIds.has(msg.member_id)) // Only messages from others
          .map(msg => {
            const notificationId = `msg_${msg.id}`;
            return {
              id: notificationId,
              type: 'message' as const,
              trip_id: msg.trip_id,
              trip_name: tripMap.get(msg.trip_id) || 'Unknown Trip',
              sender_name: memberMap.get(msg.member_id) || 'Unknown',
              content: msg.content || '',
              created_at: msg.created_at,
              read: readSet.has(notificationId),
            };
          });

        // Fetch trip requests from join_requests table (pending requests for trips you created)
        const { data: userTrips } = await supabase
          .from('trips')
          .select('id, name')
          .eq('created_by', user.id);

        const userTripIds = (userTrips || []).map(t => t.id);
        const userTripMap = new Map((userTrips || []).map(t => [t.id, t.name]));

        let requestNotifications: Notification[] = [];

        if (userTripIds.length > 0) {
          // Fetch pending join requests for trips you created
          const { data: joinRequests, error: requestsError } = await supabase
            .from('join_requests')
            .select('*')
            .in('trip_id', userTripIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20);

          if (requestsError) {
            console.error('Error fetching join requests:', requestsError);
          } else if (joinRequests) {
            requestNotifications = joinRequests.map(request => {
              const notificationId = `req_${request.id}`;
              return {
                id: notificationId,
                type: 'trip_request' as const,
                trip_id: request.trip_id,
                trip_name: userTripMap.get(request.trip_id) || 'Unknown Trip',
                sender_name: request.display_name,
                sender_id: request.requester_id,
                content: request.message || `${request.display_name} wants to join your trip`,
                created_at: request.created_at,
                read: readSet.has(notificationId),
                request_id: request.id,
                status: request.status as 'pending' | 'approved' | 'rejected',
              };
            });
          }
        }

        // Combine and sort by date
        const allNotifications = [...messageNotifications, ...requestNotifications]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 30); // Limit to 30 most recent

        setNotifications(allNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Set up real-time subscription for new messages and requests
    const channel = supabase
      .channel('notification-center')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchNotifications();
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
          fetchNotifications();
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
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification: Notification, e?: React.MouseEvent) => {
    // Don't navigate if clicking approve/reject buttons
    if (e && (e.target as HTMLElement).closest('.action-buttons')) {
      return;
    }

    markAsRead(notification.id);

    if (notification.type === 'message') {
      // Navigate to trip with chat tab open
      router.push(`/trips/${notification.trip_id}?chat=1`);
    } else if (notification.type === 'trip_request') {
      // Navigate to requests page
      router.push(`/trips/${notification.trip_id}/requests`);
    }

    onClose();
  };

  const handleApproveRequest = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.request_id || !notification.trip_id) return;

    setProcessingRequest(notification.id);

    try {
      // First, get the request details
      const { data: requestData, error: fetchError } = await supabase
        .from('join_requests')
        .select('*')
        .eq('id', notification.request_id)
        .single();

      if (fetchError || !requestData) {
        throw fetchError || new Error('Request not found');
      }

      // Approve: Add member to trip
      const { error: memberError } = await supabase
        .from('trip_members')
        .upsert(
          {
            trip_id: notification.trip_id,
            user_id: requestData.requester_id,
            name: requestData.display_name,
          },
          { onConflict: 'trip_id, user_id' }
        );

      if (memberError) throw memberError;

      // Update request status
      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('id', notification.request_id);

      if (updateError) throw updateError;

      // Remove notification
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      markAsRead(notification.id);
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.request_id) return;

    setProcessingRequest(notification.id);

    try {
      // Update request status to rejected
      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: 'rejected' })
        .eq('id', notification.request_id);

      if (updateError) throw updateError;

      // Remove notification
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      markAsRead(notification.id);
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="w-4 h-4" />;
      case 'trip_request':
        return <UserPlus className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    const baseColor =
      type === 'message'
        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
    return read ? `${baseColor} opacity-70` : baseColor;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end pt-16 md:pt-20">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/20 dark:bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Notification Center Panel */}
      <motion.div
        ref={centerRef}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md h-[calc(100vh-5rem)] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-white/20 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && notifications.some(n => !n.read) && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 dark:text-slate-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors dark:hover:bg-white/10"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-600 dark:text-slate-400">Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-slate-500 dark:text-slate-500" />
              </div>
              <p className="text-slate-700 dark:text-slate-400 text-sm">No notifications yet</p>
              <p className="text-slate-500 text-xs mt-1">You'll see messages and trip updates here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  className={`w-full text-left p-4 hover:bg-slate-100 transition-colors group cursor-pointer dark:hover:bg-white/5 ${
                    !notification.read ? 'bg-slate-50 dark:bg-transparent' : ''
                  }`}
                  onClick={(e) => handleNotificationClick(notification, e)}
                  whileHover={{ x: -2 }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${getNotificationColor(notification.type, notification.read)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm truncate ${
                          notification.read ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white'
                        }`}>
                          {notification.sender_name}
                        </p>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                        {notification.trip_name}
                      </p>
                      {notification.content && (
                        <p className={`text-sm mt-1 line-clamp-2 ${
                          notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-300'
                        }`}>
                          {notification.content}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons or Arrow */}
                    {notification.type === 'trip_request' && notification.status === 'pending' ? (
                      <div className="action-buttons flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleApproveRequest(notification, e)}
                          disabled={processingRequest === notification.id}
                          className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleRejectRequest(notification, e)}
                          disabled={processingRequest === notification.id}
                          className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors flex-shrink-0 mt-1 dark:group-hover:text-slate-300" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
