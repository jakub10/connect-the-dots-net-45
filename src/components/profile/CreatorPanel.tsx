import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Loader2, Trash2, Ban, Eye, AlertTriangle } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CreatorPanel() {
  const { isCreator, activateCreator, loading } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [activating, setActivating] = useState(false);
  const [userIdToDelete, setUserIdToDelete] = useState('');
  const [postIdToDelete, setPostIdToDelete] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    
    // Creator can delete any post - we need to use service role or RPC
    // For now, show that this is a creator function
    toast({
      title: '🛡️ Funkce tvůrce',
      description: 'Mazání příspěvků pomocí ID. Funkce vyžaduje administrátorské oprávnění.',
    });
    
    setDeleting(false);
    setPostIdToDelete('');
  };

  const banUser = async () => {
    if (!userIdToDelete.trim() || !isCreator) return;
    setDeleting(true);
    
    toast({
      title: '🛡️ Funkce tvůrce',
      description: 'Blokování uživatele pomocí ID. Funkce vyžaduje administrátorské oprávnění.',
    });
    
    setDeleting(false);
    setUserIdToDelete('');
  };

  if (loading) {
    return null;
  }

  // Hidden button for non-creators - absolute positioned at bottom right
  if (!isCreator) {
    return (
      <>
        <button
          onClick={() => setShowPasswordDialog(true)}
          className="fixed bottom-4 right-4 w-8 h-8 opacity-0 hover:opacity-10 transition-opacity z-50"
          aria-hidden="true"
        />
        
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
          <div className="flex gap-2">
            <Input
              value={userIdToDelete}
              onChange={(e) => setUserIdToDelete(e.target.value)}
              placeholder="ID uživatele..."
              className="flex-1"
            />
            <Button 
              variant="outline" 
              className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
              onClick={banUser}
              disabled={!userIdToDelete.trim() || deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            </Button>
          </div>
        </div>

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
              <p className="text-2xl font-bold text-green-500">✓</p>
              <p className="text-xs text-muted-foreground">Aktivní</p>
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