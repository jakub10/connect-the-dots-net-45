import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'user' | 'vip' | 'creator';

export function useUserRole() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRoles();
    } else {
      setRoles([]);
      setLoading(false);
    }
  }, [user]);

  const fetchRoles = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    if (!error && data) {
      setRoles(data.map(r => r.role as AppRole));
    }
    setLoading(false);
  };

  const activateVIP = useCallback(async (code: string): Promise<boolean> => {
    if (!user) return false;
    
    if (code !== VIP_CODE) {
      toast({
        title: 'Neplatný kód',
        description: 'VIP kód není správný.',
        variant: 'destructive',
      });
      return false;
    }

    // Check if already VIP
    if (roles.includes('vip')) {
      toast({
        title: 'Již máte VIP',
        description: 'Váš účet už má VIP status.',
      });
      return true;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'vip' });

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se aktivovat VIP.',
        variant: 'destructive',
      });
      return false;
    }

    setRoles(prev => [...prev, 'vip']);
    toast({
      title: '🌟 VIP Aktivováno!',
      description: 'Nyní máte přístup k VIP funkcím.',
    });
    return true;
  }, [user, roles, toast]);

  const activateCreator = useCallback(async (password: string): Promise<boolean> => {
    if (!user) return false;
    
    if (password !== CREATOR_PASSWORD) {
      toast({
        title: 'Nesprávné heslo',
        description: 'Heslo tvůrce není správné.',
        variant: 'destructive',
      });
      return false;
    }

    // Check if already creator
    if (roles.includes('creator')) {
      toast({
        title: 'Již jste tvůrce',
        description: 'Váš účet už má status tvůrce.',
      });
      return true;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'creator' });

    if (error) {
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se aktivovat status tvůrce.',
        variant: 'destructive',
      });
      return false;
    }

    setRoles(prev => [...prev, 'creator']);
    toast({
      title: '👑 Tvůrce Aktivován!',
      description: 'Nyní máte plná oprávnění tvůrce.',
    });
    return true;
  }, [user, roles, toast]);

  const isVIP = roles.includes('vip');
  const isCreator = roles.includes('creator');

  return {
    roles,
    loading,
    isVIP,
    isCreator,
    activateVIP,
    activateCreator,
    refetch: fetchRoles,
  };
}