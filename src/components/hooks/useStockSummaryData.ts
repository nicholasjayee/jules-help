import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StockSummaryData {
  productId: string;
  productName: string;
  itemNumber: string;
  imageUrl?: string | null;
  costPrice: number;
  sellingPrice: number;
  category?: string;
  openingStock: number;
  itemsSold: number;
  stockIn: number;
  transferOut: number;
  returnIn: number;
  returnOut: number;
  closingStock: number;
  revaluation: number;
}

export const useStockSummaryData = (
  dateRange: { from: Date | undefined; to: Date | undefined }
) => {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const fetchStockSummary = async (): Promise<StockSummaryData[]> => {
    if (!user?.id || !currentBusiness?.id || !dateRange?.from || !dateRange?.to) return [];

    console.log('[StockSummary] Fetching report...', {
      location: currentBusiness.id,
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString()
    });

    // We use "as any" to bypass strict type checking during this debug phase
    const { data, error } = await (supabase.rpc as any)('get_stock_summary_report', {
      p_location_id: currentBusiness.id,
      p_start_date: dateRange.from.toISOString(),
      p_end_date: dateRange.to.toISOString()
    });

    if (error) {
      // LOG AS STRING SO IT IS VISIBLE IN THE USER LOGS
      console.error('[StockSummary] CRITICAL ERROR MESSAGE:', error.message);
      console.error('[StockSummary] FULL ERROR OBJECT:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('[StockSummary] SUCCESS. Rows received:', data?.length || 0);
    return (data || []) as StockSummaryData[];
  };

  const { data: stockSummaryData = [], isLoading, refetch } = useQuery({
    queryKey: ['stockSummary', currentBusiness?.id, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: fetchStockSummary,
    enabled: !!user?.id && !!currentBusiness?.id && !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    stockSummaryData,
    isLoading,
    loadStockSummaryData: refetch,
    clearCache: () => {
      queryClient.invalidateQueries({ queryKey: ['stockSummary'] });
    },
    clearAllLocationCaches: () => {
      queryClient.invalidateQueries({ queryKey: ['stockSummary'] });
    }
  };
};
