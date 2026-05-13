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

  const activateRole = async (role: 'vip' | 'creator', code: string): Promise<boolean> => {
    if (!user) return false;

    if (roles.includes(role)) {
      toast({
        title: role === 'vip' ? 'Již máte VIP' : 'Již jste tvůrce',
        description: role === 'vip' ? 'Váš účet už má VIP status.' : 'Váš účet už má status tvůrce.',
      });
      return true;
    }

    const { data, error } = await supabase.functions.invoke('activate-role', {
      body: { role, code },
    });

    if (error || !data?.success) {
      toast({
        title: role === 'vip' ? 'Neplatný kód' : 'Nesprávné heslo',
        description: role === 'vip' ? 'VIP kód není správný.' : 'Heslo tvůrce není správné.',
        variant: 'destructive',
      });
      return false;
    }

    setRoles(prev => [...prev, role]);
    toast({
      title: role === 'vip' ? '🌟 VIP Aktivováno!' : '👑 Tvůrce Aktivován!',
      description: role === 'vip' ? 'Nyní máte přístup k VIP funkcím.' : 'Nyní máte plná oprávnění tvůrce.',
    });
    return true;
  };

  const activateVIP = useCallback((code: string) => activateRole('vip', code), [user, roles, toast]);
  const activateCreator = useCallback((password: string) => activateRole('creator', password), [user, roles, toast]);

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