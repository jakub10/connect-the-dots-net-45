import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, MessageCircle, Search, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

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
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchCurrentProfile();
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      
      // Subscribe to new messages
      const channel = supabase
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
            setMessages(prev => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const enrichedConversations = convData.map(conv => ({
      ...conv,
      other_profile: profilesMap.get(
        conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
      ),
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSendingMessage(true);
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
      <Sidebar currentProfile={currentProfile} />
      
      <main className="ml-64 py-0 px-0 h-screen">
        <div className="flex h-full">
          {/* Conversations list */}
          <div className="w-80 border-r border-border flex flex-col">
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
                <div className="absolute z-10 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg">
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
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-accent ${
                      selectedConversation?.id === conv.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conv.other_profile?.avatar_url || ''} />
                      <AvatarFallback>{conv.other_profile?.full_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conv.other_profile?.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: cs })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.other_profile?.avatar_url || ''} />
                    <AvatarFallback>{selectedConversation.other_profile?.full_name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedConversation.other_profile?.full_name}</p>
                    <p className="text-sm text-muted-foreground">@{selectedConversation.other_profile?.username}</p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            message.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p>{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: cs })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message input */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Napiš zprávu..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
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
    </div>
  );
};

export default Messages;
