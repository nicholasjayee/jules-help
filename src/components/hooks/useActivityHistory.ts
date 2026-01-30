import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { ActivityFilters } from '@/pages/History';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface ActivityHistoryItem {
  id: string;
  user_id: string;
  location_id: string;
  activity_type: 'CREATE' | 'UPDATE' | 'DELETE';
  module: 'SALES' | 'INVENTORY' | 'EXPENSES' | 'FINANCE' | 'CUSTOMERS' | 'TASKS';
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  description: string;
  metadata: any;
  created_at: string;
  profile_id: string | null;
  profile_name: string | null;
}

const ITEMS_PER_PAGE = 20;

export const useActivityHistory = (locationId?: string, filters?: ActivityFilters) => {
  const { userId } = useCurrentUser();
  const [activities, setActivities] = useState<ActivityHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const queryClient = useQueryClient();

  const fetchActivities = useCallback(async (): Promise<{ activities: ActivityHistoryItem[], count: number }> => {
    if (!userId || !locationId) {
      return { activities: [], count: 0 };
    }

    try {
      let query = supabase
        .from('activity_history')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      // Apply filters
      if (filters) {
        if (filters.activityType !== 'ALL') {
          query = query.eq('activity_type', filters.activityType);
        }
        if (filters.module !== 'ALL') {
          query = query.eq('module', filters.module);
        }
        if (filters.search) {
          query = query.or(`entity_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
        if (filters.dateRange.from) {
          query = query.gte('created_at', filters.dateRange.from.toISOString());
        }
        if (filters.dateRange.to) {
          const toDate = new Date(filters.dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte('created_at', toDate.toISOString());
        }
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching activity history:', error);
        return { activities: [], count: 0 };
      }

      return { activities: (data || []) as ActivityHistoryItem[], count: count || 0 };
    } catch (error) {
      console.error('Error fetching activity history:', error);
      return { activities: [], count: 0 };
    }
  }, [userId, locationId, currentPage, filters]);

  // React Query caching
  const queryKey = ['activity_history', userId, locationId, currentPage, filters];
  const { data: queriedData, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: fetchActivities,
    enabled: !!userId && !!locationId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (queriedData) {
      setActivities(queriedData.activities);
      setTotalCount(queriedData.count);
      setTotalPages(Math.ceil(queriedData.count / ITEMS_PER_PAGE));
    }
  }, [queriedData]);

  // Derived loading state - only true when no cached page data
  const isLoading = isQueryLoading && !queriedData;

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [filters]);

  const refetchActivities = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // Realtime: invalidate activity history cache on changes for current location
  useEffect(() => {
    if (!userId || !locationId) return;

    const channel = supabase
      .channel('activity_history_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_history',
        filter: `location_id=eq.${locationId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, locationId, currentPage, filters]);

  return {
    activities,
    isLoading,
    totalCount,
    currentPage,
    totalPages,
    setCurrentPage,
    refetch: refetchActivities
  };
};