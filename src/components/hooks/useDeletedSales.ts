
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrentUser } from './useCurrentUser';

export interface DeletedSale {
    id: string;
    receiptNumber: string;
    customerName: string;
    amount: number;
    totalQuantity: number;
    deletedAt: string;
    deletedBy: string;
    items: any[];
    fullMetadata: any;
}

export const useDeletedSales = () => {
    const [deletedSales, setDeletedSales] = useState<DeletedSale[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { currentBusiness } = useBusiness();
    const { userId } = useCurrentUser();

    const fetchDeletedSales = useCallback(async () => {
        if (!currentBusiness?.id || !userId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_history' as any)
                .select('*')
                .eq('location_id', currentBusiness.id)
                .eq('module', 'SALES')
                .eq('activity_type', 'DELETE')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted: DeletedSale[] = (data || []).map((log: any) => {
                const metadata = log.metadata || {};
                const items = Array.isArray(metadata.items) ? metadata.items : [];

                // Fallback: If totalAmount is missing or 0, calculate it from items
                let amount = Number(metadata.totalAmount || 0);
                if (amount === 0 && items.length > 0) {
                    amount = items.reduce((sum: number, item: any) => {
                        const itemTotal = Number(item.total) || (Number(item.price || 0) * Number(item.quantity || 0));
                        return sum + itemTotal;
                    }, 0);
                }

                // Calculate total quantity
                const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity ?? item.qty ?? 0)), 0);

                return {
                    id: log.id,
                    receiptNumber: metadata.receiptNumber || 'N/A',
                    customerName: metadata.customerName || 'Unknown',
                    amount: amount,
                    totalQuantity: totalQuantity,
                    deletedAt: log.created_at,
                    deletedBy: log.profile_name || 'Admin',
                    items: items,
                    fullMetadata: metadata
                };
            });

            setDeletedSales(formatted);
        } catch (error) {
            console.error('Error fetching deleted sales:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentBusiness?.id, userId]);

    useEffect(() => {
        fetchDeletedSales();
    }, [fetchDeletedSales]);

    return {
        deletedSales,
        isLoading,
        refetch: fetchDeletedSales
    };
};
