'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { MessageCircle, Send, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface Message {
  id: string;
  trip_id: string;
  member_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface ChatBoxProps {
  tripId: string;
  members: Array<{ id: string; name: string; user_id?: string }>;
}

export default function ChatBox({ tripId, members }: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Color scheme matching facepile
  const getMemberColor = (memberId: string) => {
    const index = members.findIndex(m => m.id === memberId || m.user_id === memberId);
    const colors = [
      'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500'
    ];
    return colors[index % colors.length] || 'bg-slate-500';
  };

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

        // Enrich messages with sender names and reverse to show oldest first
        const enrichedMessages = (data || [])
          .map((msg) => {
            const member = members.find(m => m.id === msg.member_id || m.user_id === msg.member_id);
            return {
              ...msg,
              sender_name: member?.name || 'Unknown',
            };
          })
          .reverse(); // Reverse to show oldest first (chronological order)

        setMessages(enrichedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [tripId, members]);

  // Set up realtime subscription
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
          const newMsg = payload.new as Message;
          const member = members.find(m => m.id === newMsg.member_id || m.user_id === newMsg.member_id);
          
          setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              sender_name: member?.name || 'Unknown',
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, members]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find current member
  const currentMember = members.find(m => m.user_id === user?.id);
  const isMyMessage = (message: Message) => {
    return message.member_id === currentMember?.id;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentMember || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          trip_id: tripId,
          member_id: currentMember.id,
          content: newMessage.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to send message. Please check the console for details.');
      }
      
      setNewMessage('');
      
      // Visual feedback: brief animation on send
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      console.error('Full error object:', error);
      alert(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  if (!user || !currentMember) {
    return null;
  }

  return (
    <div className="glass-card rounded-3xl p-6 flex flex-col h-full min-h-[400px] max-h-[600px] relative z-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
        <MessageCircle className="w-5 h-5 text-blue-400 opacity-80" />
        <h3 className="text-lg font-semibold text-white tracking-tight">Group Chat</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          <Circle className="w-2 h-2 fill-green-500 text-green-500 live-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-hide"
      >
        {loading ? (
          <div className="text-slate-400 text-sm text-center py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => {
            const isMine = isMyMessage(message);
            const senderColor = getMemberColor(message.member_id);
            
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Sender name & timestamp */}
                  <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                    {!isMine && (
                      <div className={`w-5 h-5 ${senderColor} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                        {message.sender_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <span className="text-xs text-slate-400">{message.sender_name}</span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {/* Message bubble */}
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl px-4 py-2.5 ${
                      isMine
                        ? 'bg-indigo-600/80 text-white'
                        : 'bg-white/10 text-slate-200 border border-white/20'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </motion.div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message... (Press Enter to send)"
          disabled={sending}
          className="flex-1 px-4 py-2.5 bg-slate-900/60 backdrop-blur-xl border border-white/20 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none disabled:opacity-50 text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-violet-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
