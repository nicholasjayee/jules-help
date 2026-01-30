import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useBusiness } from '@/contexts/BusinessContext';
import { useProfiles } from '@/contexts/ProfileContext';

export type ActivityType = 'CREATE' | 'UPDATE' | 'DELETE';
export type ModuleType = 'SALES' | 'INVENTORY' | 'EXPENSES' | 'FINANCE' | 'CUSTOMERS' | 'TASKS';

export interface ActivityLogData {
  activityType: ActivityType;
  module: ModuleType;
  entityType: string;
  entityId?: string;
  entityName: string;
  description: string;
  metadata?: any;
}

export const useActivityLogger = () => {
  const { userId } = useCurrentUser();
  const { currentBusiness } = useBusiness();
  
  // Safely get current profile, handle case where ProfileProvider isn't available
  let currentProfile = null;
  try {
    const { currentProfile: profile } = useProfiles();
    currentProfile = profile;
  } catch {
    // ProfileProvider not available, continue without profile
    currentProfile = null;
  }

  const logActivity = async (data: ActivityLogData) => {
    if (!userId || !currentBusiness?.id) {
      console.warn('Cannot log activity: missing user or business context');
      return;
    }

    try {
      const { error } = await supabase
        .from('activity_history')
        .insert({
          user_id: userId,
          location_id: currentBusiness.id,
          activity_type: data.activityType,
          module: data.module,
          entity_type: data.entityType,
          entity_id: data.entityId || null,
          entity_name: data.entityName,
          description: data.description,
          metadata: data.metadata || null,
          profile_id: currentProfile?.id || null,
          profile_name: currentProfile?.profile_name || null
        });

      if (error) {
        console.error('Error logging activity:', error);
      }
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  return { logActivity };
};