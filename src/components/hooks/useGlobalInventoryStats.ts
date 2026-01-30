import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalInventoryStats {
    totalCostValue: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
}

export const useGlobalInventoryStats = (businessId: string | undefined) => {
    return useQuery<GlobalInventoryStats>({
        queryKey: ['inventory_global_stats', businessId],
        queryFn: async (): Promise<GlobalInventoryStats> => {
            if (!businessId) {
                return {
                    totalCostValue: 0,
                    totalStockValue: 0,
                    lowStockCount: 0,
                    outOfStockCount: 0
                };
            }

            const { data, error } = await (supabase.rpc as any)('get_inventory_stats', {
                p_location_id: businessId
            });

            if (error) {
                console.error('Error fetching global stats:', error);
                throw error;
            }

            // Map the snake_case or json keys to our interface
            // The RPC returns a JSON object, so keys will be exactly what we built in json_build_object
            const result = data as any;

            return {
                totalCostValue: Number(result.totalCostValue) || 0,
                totalStockValue: Number(result.totalStockValue) || 0,
                lowStockCount: Number(result.lowStockCount) || 0,
                outOfStockCount: Number(result.outOfStockCount) || 0
            };
        },
        enabled: !!businessId,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // Keep cache for 5 mins
    });
};
