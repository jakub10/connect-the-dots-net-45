import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { MobileNav } from '@/components/social/MobileNav';
import { MobileHeader } from '@/components/social/MobileHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, MessageCircle, Search, ArrowLeft, Smile, Check, CheckCheck, Image } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Profile {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  updated_at: string;
  other_profile?: Profile;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface PresenceData {
  user_id: string;
  online_at: string;
  typing_in: string | null;
}

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversations();
    fetchCurrentProfile();
    updatePresence();

    // Update presence periodically
    const presenceInterval = setInterval(updatePresence, 30000);
    return () => clearInterval(presenceInterval);
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
      checkOtherUserOnline();
      
      // Subscribe to new messages
      const messagesChannel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => [...prev, newMsg]);
            // Mark as read if from other user
            if (newMsg.sender_id !== user?.id) {
              markMessageAsRead(newMsg.id);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          (payload) => {
            setMessages(prev => 
              prev.map(msg => msg.id === payload.new.id ? payload.new as Message : msg)
            );
          }
        )
        .subscribe();

      // Subscribe to typing indicator
      const otherUserId = selectedConversation.participant_1 === user?.id 
        ? selectedConversation.participant_2 
        : selectedConversation.participant_1;

      const presenceChannel = supabase
        .channel(`presence-${otherUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_presence',
            filter: `user_id=eq.${otherUserId}`,
          },
          (payload) => {
            const presence = payload.new as PresenceData;
            setOtherUserTyping(presence.typing_in === selectedConversation.id);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            setOtherUserOnline(new Date(presence.online_at) > fiveMinutesAgo);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(presenceChannel);
        // Clear typing when leaving
        updateTypingStatus(null);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updatePresence = async () => {
    if (!user) return;
    await supabase
      .from('user_presence')
      .upsert({ user_id: user.id, online_at: new Date().toISOString() });
  };

  const updateTypingStatus = async (conversationId: string | null) => {
    if (!user) return;
    await supabase
      .from('user_presence')
      .upsert({ 
        user_id: user.id, 
        online_at: new Date().toISOString(),
        typing_in: conversationId 
      });
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (selectedConversation && value.trim()) {
      updateTypingStatus(selectedConversation.id);
      
      // Clear typing after 2 seconds of no input
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(null);
      }, 2000);
    } else {
      updateTypingStatus(null);
    }
  };

  const checkOtherUserOnline = async () => {
    if (!selectedConversation || !user) return;
    
    const otherUserId = selectedConversation.participant_1 === user.id 
      ? selectedConversation.participant_2 
      : selectedConversation.participant_1;

    const { data } = await supabase
      .from('user_presence')
      .select('online_at')
      .eq('user_id', otherUserId)
      .maybeSingle();

    if (data) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      setOtherUserOnline(new Date(data.online_at) > fiveMinutesAgo);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!user) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('read', false);
  };

  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);
  };

  const fetchCurrentProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    setCurrentProfile(data);
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data: convData, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (error || !convData) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get other participants' profiles
    const otherUserIds = convData.map(c => 
      c.participant_1 === user.id ? c.participant_2 : c.participant_1
    );

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', otherUserIds);

    const profilesMap = new Map(
      profilesData?.map(p => [p.user_id, p]) || []
    );

    // Get unread counts
    const { data: unreadData } = await supabase
      .from('messages')
      .select('conversation_id')
      .neq('sender_id', user.id)
      .eq('read', false);

    const unreadCounts = new Map<string, number>();
    unreadData?.forEach(msg => {
      unreadCounts.set(msg.conversation_id, (unreadCounts.get(msg.conversation_id) || 0) + 1);
    });

    const enrichedConversations = convData.map(conv => ({
      ...conv,
      other_profile: profilesMap.get(
        conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
      ),
      unread_count: unreadCounts.get(conv.id) || 0,
    }));

    setConversations(enrichedConversations);
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .neq('user_id', user.id)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(5);

    setSearchResults(data || []);
  };

  const startConversation = async (otherUser: Profile) => {
    if (!user) return;

    // Check if conversation already exists
    const existing = conversations.find(c =>
      (c.participant_1 === user.id && c.participant_2 === otherUser.user_id) ||
      (c.participant_2 === user.id && c.participant_1 === otherUser.user_id)
    );

    if (existing) {
      setSelectedConversation({ ...existing, other_profile: otherUser });
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: otherUser.user_id,
      })
      .select()
      .single();

    if (!error && data) {
      const newConv = { ...data, other_profile: otherUser };
      setConversations(prev => [newConv, ...prev]);
      setSelectedConversation(newConv);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setNewMessage(prev => prev + emoji.native);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSendingMessage(true);
    updateTypingStatus(null);
    
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage.trim(),
      });

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se odeslat zprávu.',
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }
    setSendingMessage(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader currentProfile={currentProfile} />
      <Sidebar currentProfile={currentProfile} />
      
      <main className="pt-14 pb-16 md:pt-0 md:pb-0 md:ml-64 h-screen">
        <div className="flex h-full">
          {/* Conversations list */}
          <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-border flex-col bg-card`}>
            <div className="p-4 border-b border-border">
              <h1 className="text-xl font-bold mb-4">Zprávy</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat uživatele..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-50 mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg">
                  {searchResults.map(profile => (
                    <div
                      key={profile.user_id}
                      className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                      onClick={() => startConversation(profile)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback>{profile.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{profile.full_name}</p>
                        <p className="text-sm text-muted-foreground">@{profile.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Zatím žádné konverzace</p>
                  <p className="text-sm">Vyhledej uživatele a zahaj konverzaci</p>
                </div>
              ) : (
              conversations.map(conv => {
                  const isSelected = selectedConversation?.id === conv.id;
                  // Hide unread count if this conversation is currently selected
                  const displayUnread = !isSelected && conv.unread_count ? conv.unread_count : 0;
                  
                  return (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-accent transition-colors ${
                        isSelected ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.other_profile?.avatar_url || ''} />
                          <AvatarFallback>{conv.other_profile?.full_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conv.other_profile?.full_name}</p>
                          {displayUnread > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              {displayUnread}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: cs })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.other_profile?.avatar_url || ''} />
                      <AvatarFallback>{selectedConversation.other_profile?.full_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    {otherUserOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-online border-2 border-card rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{selectedConversation.other_profile?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {otherUserTyping ? (
                        <span className="text-primary">píše...</span>
                      ) : otherUserOnline ? (
                        <span className="text-online">online</span>
                      ) : (
                        `@${selectedConversation.other_profile?.username}`
                      )}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message, idx) => {
                      const isOwn = message.sender_id === user?.id;
                      const showReadStatus = isOwn && idx === messages.length - 1;
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="max-w-[70%]">
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p>{message.content}</p>
                            </div>
                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: cs })}
                              </p>
                              {isOwn && (
                                message.read ? (
                                  <CheckCheck className="h-3 w-3 text-primary" />
                                ) : (
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {otherUserTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-4 py-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message input */}
                <div className="p-4 border-t border-border bg-card">
                  <div className="flex gap-2 items-end">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
                          <Smile className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-0" align="start" side="top">
                        <Picker
                          data={data}
                          onEmojiSelect={handleEmojiSelect}
                          theme="auto"
                          locale="cs"
                          previewPosition="none"
                          skinTonePosition="none"
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      placeholder="Napiš zprávu..."
                      value={newMessage}
                      onChange={(e) => handleTyping(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Vyber konverzaci</p>
                  <p className="text-sm">nebo začni novou vyhledáním uživatele</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default Messages;
