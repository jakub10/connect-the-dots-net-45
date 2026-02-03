import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Loader2, Trash2, Ban, Eye, AlertTriangle, UserX, RefreshCw } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BannedUser {
  id: string;
  user_id: string;
  reason: string | null;
  banned_at: string;
}

export function CreatorPanel() {
  const { isCreator, activateCreator, loading } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [activating, setActivating] = useState(false);
  const [userIdToBan, setUserIdToBan] = useState('');
  const [banReason, setBanReason] = useState('');
  const [postIdToDelete, setPostIdToDelete] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loadingBanned, setLoadingBanned] = useState(false);

  const fetchBannedUsers = async () => {
    if (!isCreator) return;
    setLoadingBanned(true);
    const { data, error } = await supabase
      .from('banned_users')
      .select('*')
      .order('banned_at', { ascending: false });
    
    if (!error && data) {
      setBannedUsers(data);
    }
    setLoadingBanned(false);
  };

  useEffect(() => {
    if (isCreator) {
      fetchBannedUsers();
    }
  }, [isCreator]);

  const handleActivate = async () => {
    if (!password.trim()) return;
    setActivating(true);
    const success = await activateCreator(password.trim());
    setActivating(false);
    if (success) {
      setShowPasswordDialog(false);
    }
    setPassword('');
  };

  const deletePost = async () => {
    if (!postIdToDelete.trim() || !isCreator) return;
    setDeleting(true);
    
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postIdToDelete.trim());

      if (error) throw error;

      toast({
        title: '🗑️ Příspěvek smazán',
        description: 'Příspěvek byl úspěšně odstraněn.',
      });
      setPostIdToDelete('');
    } catch (error: any) {
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se smazat příspěvek.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const banUser = async () => {
    if (!userIdToBan.trim() || !isCreator) return;
    setDeleting(true);
    
    try {
      const { error } = await supabase
        .from('banned_users')
        .upsert({
          user_id: userIdToBan.trim(),
          banned_by: user?.id,
          reason: banReason.trim() || null,
        });

      if (error) throw error;

      toast({
        title: '🚫 Uživatel zablokován',
        description: 'Uživatel byl přidán na seznam zablokovaných.',
      });
      setUserIdToBan('');
      setBanReason('');
      fetchBannedUsers();
    } catch (error: any) {
      toast({
        title: 'Chyba',
        description: error.message || 'Nepodařilo se zablokovat uživatele.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('banned_users')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: '✅ Uživatel odblokován',
        description: 'Uživatel byl odebrán ze seznamu zablokovaných.',
      });
      fetchBannedUsers();
    } catch (error: any) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se odblokovat uživatele.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return null;
  }

  // Hidden button for non-creators - positioned at bottom of profile page
  if (!isCreator) {
    return (
      <>
        <div className="flex justify-end mt-8">
          <button
            onClick={() => setShowPasswordDialog(true)}
            className="w-12 h-12 opacity-0 hover:opacity-5 transition-opacity"
            aria-hidden="true"
          />
        </div>
        
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Přístup tvůrce
              </DialogTitle>
              <DialogDescription>
                Zadejte heslo pro získání oprávnění tvůrce
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Heslo tvůrce..."
                type="password"
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              />
              <Button 
                onClick={handleActivate} 
                disabled={!password.trim() || activating}
                className="w-full"
              >
                {activating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Potvrdit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Card className="border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-500" />
          Panel tvůrce
        </CardTitle>
        <CardDescription>
          Administrátorské nástroje pro správu sítě
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delete Post */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            Smazat příspěvek
          </label>
          <div className="flex gap-2">
            <Input
              value={postIdToDelete}
              onChange={(e) => setPostIdToDelete(e.target.value)}
              placeholder="ID příspěvku..."
              className="flex-1"
            />
            <Button 
              variant="destructive" 
              onClick={deletePost}
              disabled={!postIdToDelete.trim() || deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Ban User */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Ban className="h-4 w-4 text-orange-500" />
            Blokovat uživatele
          </label>
          <div className="flex flex-col gap-2">
            <Input
              value={userIdToBan}
              onChange={(e) => setUserIdToBan(e.target.value)}
              placeholder="ID uživatele..."
            />
            <Input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Důvod (volitelné)..."
            />
            <Button 
              variant="outline" 
              className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
              onClick={banUser}
              disabled={!userIdToBan.trim() || deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Zablokovat
            </Button>
          </div>
        </div>

        {/* Banned Users List */}
        {bannedUsers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                Zablokovaní uživatelé ({bannedUsers.length})
              </label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchBannedUsers}
                disabled={loadingBanned}
              >
                <RefreshCw className={`h-4 w-4 ${loadingBanned ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {bannedUsers.map((banned) => (
                <div key={banned.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2 text-sm">
                  <div className="flex-1 truncate">
                    <span className="font-mono text-xs">{banned.user_id.slice(0, 8)}...</span>
                    {banned.reason && (
                      <span className="text-muted-foreground ml-2">({banned.reason})</span>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => unbanUser(banned.user_id)}
                    className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                  >
                    Odblokovat
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Přehled
          </h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-purple-500">∞</p>
              <p className="text-xs text-muted-foreground">Oprávnění</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-500">{bannedUsers.length}</p>
              <p className="text-xs text-muted-foreground">Zablokovaných</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <span className="text-muted-foreground">
            Používejte tyto nástroje zodpovědně. Všechny akce jsou zaznamenávány.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}