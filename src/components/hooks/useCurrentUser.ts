import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useCurrentUser = () => {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  
  // Get current user with faster initial check
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        // Try to get user from session first (faster)
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          setUserId(sessionData.session.user.id);
          return;
        }
        
        // Fallback to getUser if no session
        const { data: userData } = await supabase.auth.getUser();
        setUserId(userData.user?.id);
      } catch (error) {
        console.error('Error getting user:', error);
        setUserId(undefined);
      }
    };
    getCurrentUser();
  }, []);

  return { userId };
};