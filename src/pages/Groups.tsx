import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/social/Sidebar';
import { RightSidebar } from '@/components/social/RightSidebar';
import { MobileNav } from '@/components/social/MobileNav';
import { MobileHeader } from '@/components/social/MobileHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Users, MessageCircle, Send, Lock, Globe, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  username: string;
  full_name: string;
  avatar_url: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  is_private: boolean;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

const Groups = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCurrentProfile();
      fetchGroups();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup && user) {
      fetchMessages(selectedGroup.id);
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`group-${selectedGroup.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${selectedGroup.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as GroupMessage;
            // Fetch profile for new message
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('user_id', newMsg.sender_id)
              .maybeSingle();
            
            setMessages(prev => [...prev, { ...newMsg, profile: profile || undefined }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedGroup, user]);

  const fetchCurrentProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    setCurrentProfile(data);
  };

  const fetchGroups = async () => {
    if (!user) return;
    
    const { data: groupsData, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching groups:', error);
      setLoading(false);
      return;
    }

    // Check membership for each group
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const membershipSet = new Set(memberships?.map(m => m.group_id) || []);

    // Get member counts
    const groupsWithData = await Promise.all(
      (groupsData || []).map(async (group) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        return {
          ...group,
          member_count: count || 0,
          is_member: membershipSet.has(group.id) || group.owner_id === user.id,
        };
      })
    );

    setGroups(groupsWithData);
    setLoading(false);
  };

  const fetchMessages = async (groupId: string) => {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch profiles for messages
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setMessages(
        data.map(msg => ({
          ...msg,
          profile: profileMap.get(msg.sender_id) || undefined,
        }))
      );
    }
  };

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setCreating(true);

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
        owner_id: user.id,
        is_private: newGroupPrivate,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se vytvořit skupinu.',
        variant: 'destructive',
      });
    } else {
      // Add owner as member
      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'owner' });

      toast({
        title: 'Skupina vytvořena!',
        description: `Skupina "${group.name}" byla úspěšně vytvořena.`,
      });
      setShowCreateDialog(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupPrivate(false);
      fetchGroups();
    }
    setCreating(false);
  };

  const joinGroup = async (group: Group) => {
    if (!user) return;

    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se připojit ke skupině.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Připojeno!',
        description: `Nyní jste členem skupiny "${group.name}".`,
      });
      fetchGroups();
    }
  };

  const leaveGroup = async (group: Group) => {
    if (!user || group.owner_id === user.id) return;

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', user.id);

    if (!error) {
      toast({
        title: 'Opuštěno',
        description: `Opustili jste skupinu "${group.name}".`,
      });
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
        setMessages([]);
      }
      fetchGroups();
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedGroup || !newMessage.trim()) return;
    setSendingMessage(true);

    const { error } = await supabase
      .from('group_messages')
      .insert({
        group_id: selectedGroup.id,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader currentProfile={currentProfile} />
        <Sidebar currentProfile={currentProfile} />
        <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
        <RightSidebar />
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader currentProfile={currentProfile} />
      <Sidebar currentProfile={currentProfile} />
      
      <main className="pt-16 pb-20 md:pt-6 md:pb-6 md:ml-64 lg:mr-80 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Skupiny
            </h1>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nová skupina
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vytvořit skupinu</DialogTitle>
                  <DialogDescription>
                    Vytvořte novou skupinu a pozvěte přátele
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Název skupiny..."
                  />
                  <Textarea
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Popis skupiny (volitelné)..."
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="private"
                      checked={newGroupPrivate}
                      onChange={(e) => setNewGroupPrivate(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="private" className="text-sm flex items-center gap-1">
                      <Lock className="h-4 w-4" />
                      Soukromá skupina
                    </label>
                  </div>
                  <Button 
                    onClick={createGroup} 
                    disabled={!newGroupName.trim() || creating}
                    className="w-full"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Vytvořit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Groups List */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Všechny skupiny</h2>
              {groups.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-muted-foreground">Zatím nejsou žádné skupiny</p>
                  </CardContent>
                </Card>
              ) : (
                groups.map(group => (
                  <Card 
                    key={group.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedGroup?.id === group.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => group.is_member && setSelectedGroup(group)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={group.avatar_url || ''} />
                            <AvatarFallback>{group.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {group.name}
                              {group.is_private ? (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Globe className="h-3 w-3 text-muted-foreground" />
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {group.member_count} členů
                            </CardDescription>
                          </div>
                        </div>
                        {group.is_member ? (
                          group.owner_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                leaveGroup(group);
                              }}
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              joinGroup(group);
                            }}
                          >
                            Připojit se
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    {group.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>

            {/* Group Chat */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">
                {selectedGroup ? selectedGroup.name : 'Vyberte skupinu'}
              </h2>
              
              {selectedGroup ? (
                <Card className="h-[500px] flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Zatím žádné zprávy</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${
                              msg.sender_id === user?.id ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={msg.profile?.avatar_url || ''} />
                              <AvatarFallback>
                                {msg.profile?.full_name?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                msg.sender_id === user?.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-xs font-medium opacity-70 mb-1">
                                {msg.profile?.full_name || 'Neznámý'}
                              </p>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  
                  <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Napište zprávu..."
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        disabled={sendingMessage}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        size="icon"
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="h-[500px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>Vyberte skupinu pro zobrazení chatu</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <RightSidebar />
      <MobileNav />
    </div>
  );
};

export default Groups;