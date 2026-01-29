
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sale, DbSale, mapDbSaleToSale } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { useBusiness } from '@/contexts/BusinessContext';
import { useProducts } from '@/hooks/useProducts';
import { useInventoryActions } from '@/hooks/useInventoryActions';
import { clearInventoryCaches } from '@/utils/inventoryCacheUtils';

export interface TopCustomer {
  id?: string;
  name: string;
  totalPurchases: number;
  orderCount: number;
}

export const useSalesData = (userId: string | undefined, sortOrder: string = 'desc', pageSize?: number) => {

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { currentBusiness } = useBusiness();
  const { updateProduct, loadProducts, updateProductsBulk } = useProducts(userId);
  const { restoreStockForSale } = useInventoryActions(userId);

  const loadSales = useCallback(async (): Promise<Sale[]> => {
    try {
      if (!userId || !currentBusiness) {
        return [];
      }

      // If pageSize is specified, load only that many records (for dashboard optimization)
      if (pageSize && pageSize > 0) {
        const { data, error } = await supabase
          .from('sales' as any)
          .select(`
              id,
              user_id,
              receipt_number,
              customer_name,
              customer_address,
              customer_contact,
              customer_id,
              items,
              payment_status,
              profit,
              date,
              tax_rate,
              created_at,
              updated_at,
              cash_transaction_id,
              amount_paid,
              amount_due,
              location_id,
              category_id
            `)
          .eq('location_id', currentBusiness.id)
          .order('created_at', { ascending: sortOrder === 'asc' })
          .limit(pageSize);

        if (error) throw error;

        // Convert database sales to frontend Sale format
        const formattedSales: Sale[] = data ? data.map((item: any) => {
          const dbSale: DbSale = {
            id: item.id,
            user_id: item.user_id,
            location_id: item.location_id,
            receipt_number: item.receipt_number,
            customer_name: item.customer_name,
            customer_address: item.customer_address,
            customer_contact: item.customer_contact,
            customer_id: item.customer_id,
            items: item.items,
            payment_status: item.payment_status,
            profit: item.profit,
            date: item.date,
            tax_rate: item.tax_rate || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
            cash_transaction_id: item.cash_transaction_id,
            amount_paid: item.amount_paid,
            amount_due: item.amount_due,
            category_id: item.category_id
          };
          return mapDbSaleToSale(dbSale);
        }) : [];

        return formattedSales;
      } else {
        // Load ALL sales using chunked approach to bypass Supabase's 1000 row limit
        const chunkSize = 1000;
        let allSales: any[] = [];
        let start = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: chunk, error } = await supabase
            .from('sales' as any)
            .select(`
                  id,
                  user_id,
                  receipt_number,
                  customer_name,
                  customer_address,
                  customer_contact,
                  customer_id,
                  items,
                  payment_status,
                  profit,
                  date,
                  tax_rate,
                  created_at,
                  updated_at,
                  cash_transaction_id,
                  amount_paid,
                  amount_due,
                  location_id,
                  category_id
                `)
            .eq('location_id', currentBusiness.id)
            .order('created_at', { ascending: sortOrder === 'asc' })
            .range(start, start + chunkSize - 1);

          if (error) throw error;

          if (chunk && chunk.length > 0) {
            allSales.push(...chunk);
            start += chunkSize;

            // Check if we've loaded all available records
            hasMore = chunk.length === chunkSize;
          } else {
            hasMore = false;
          }
        }

        const data = allSales;

        // Convert database sales to frontend Sale format
        const formattedSales: Sale[] = data ? data.map((item: any) => {
          const dbSale: DbSale = {
            id: item.id,
            user_id: item.user_id,
            location_id: item.location_id,
            receipt_number: item.receipt_number,
            customer_name: item.customer_name,
            customer_address: item.customer_address,
            customer_contact: item.customer_contact,
            customer_id: item.customer_id,
            items: item.items,
            payment_status: item.payment_status,
            profit: item.profit,
            date: item.date,
            tax_rate: item.tax_rate || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
            cash_transaction_id: item.cash_transaction_id,
            amount_paid: item.amount_paid,
            amount_due: item.amount_due,
            category_id: item.category_id
          };
          return mapDbSaleToSale(dbSale);
        }) : [];

        return formattedSales;
      }

    } catch (error) {
      console.error('Error loading sales:', error);
      toast({
        title: "Error",
        description: "Failed to load sales data. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [userId, currentBusiness?.id, sortOrder, pageSize, toast]);

  // React Query caching with persistent storage for improved performance
  const baseQueryKey = useMemo(() => ['sales', currentBusiness?.id, userId], [currentBusiness?.id, userId]);
  const queryKey = useMemo(() => [...baseQueryKey, sortOrder, pageSize], [baseQueryKey, sortOrder, pageSize]);

  const {
    data: sales = [],
    isLoading: isQueryLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey,
    queryFn: loadSales,
    enabled: !!userId && !!currentBusiness?.id,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Derived loading state
  const isLoading = isQueryLoading || (isFetching && sales.length === 0);

  // Set up real-time subscription with optimized incremental updates
  useEffect(() => {
    if (!userId || !currentBusiness?.id) return;

    const channel = supabase
      .channel('sales_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `location_id=eq.${currentBusiness.id}`,
        },
        (payload) => {
          // Invalidate cache to trigger refetch or handle optimistic updates via setQueryData if needed
          // For now, invalidation is safer to ensure consistency
          queryClient.invalidateQueries({ queryKey: baseQueryKey });
          clearSoldItemsCache();
          clearInventoryCaches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentBusiness?.id, baseQueryKey, queryClient]);

  const getTopCustomers = useMemo((): TopCustomer[] => {
    // Skip quotes since they're not actual purchases
    const nonQuoteSales = sales.filter(sale => sale.paymentStatus !== "Quote");

    // Group sales by customer name
    const customerMap = new Map<string, { total: number, count: number, customerId?: string }>();

    nonQuoteSales.forEach(sale => {
      const customerName = sale.customerName;
      const saleTotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, {
          total: saleTotal,
          count: 1,
          customerId: sale.customerId
        });
      } else {
        const current = customerMap.get(customerName)!;
        customerMap.set(customerName, {
          total: current.total + saleTotal,
          count: current.count + 1,
          customerId: current.customerId || sale.customerId
        });
      }
    });

    // Convert map to array and sort by total purchases
    return Array.from(customerMap.entries())
      .map(([name, data]) => ({
        id: data.customerId,
        name,
        totalPurchases: data.total,
        orderCount: data.count
      }))
      .sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [sales]);

  // Memoize customer lifetime purchases function
  const getCustomerLifetimePurchases = useMemo(() => {
    return (customerName: string) => {
      // Filter sales by customer name and exclude quotes
      const customerSales = sales.filter(sale =>
        sale.customerName.toLowerCase() === customerName.toLowerCase() &&
        sale.paymentStatus !== "Quote"
      );

      // Calculate total purchase amount and count
      const total = customerSales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0), 0
      );

      return {
        total,
        count: customerSales.length
      };
    };
  }, [sales]);

  const deleteSale = async (id: string) => {
    try {
      // First, find the sale to get its details for logging
      const saleToDelete = sales.find(sale => sale.id === id);
      if (!saleToDelete) {
        throw new Error('Sale not found');
      }

      console.log('Deleting sale:', id, 'with cash transaction:', saleToDelete.cashTransactionId);

      // Delete associated installment payments first (they might reference cash transactions)
      const { error: installmentError } = await supabase
        .from('installment_payments' as any)
        .delete()
        .eq('sale_id', id);

      if (installmentError) {
        console.error('Error deleting installment payments:', installmentError);
        // Continue with sale deletion even if installment deletion fails
      }

      // If there's an associated cash transaction, delete it
      if (saleToDelete.cashTransactionId) {
        console.log('Deleting associated cash transaction:', saleToDelete.cashTransactionId);
        const { error: cashError } = await (supabase as any)
          .from('cash_transactions')
          .delete()
          .eq('id', saleToDelete.cashTransactionId);

        if (cashError) {
          console.error('Error deleting cash transaction:', cashError);
          toast({
            title: "Warning",
            description: "Sale deleted but failed to remove associated cash transaction. Please check your cash accounts.",
            variant: "destructive"
          });
        } else {
          console.log('Successfully deleted cash transaction');
        }
      }

      // Restore product quantities back to inventory (Only if it wasn't a quote which doesn't deduct stock)
      if (saleToDelete.paymentStatus !== 'Quote' && saleToDelete.items.length > 0) {
        console.log('Restoring product quantities via useInventoryActions...');
        const success = await restoreStockForSale(saleToDelete.items, id, saleToDelete.receiptNumber, currentBusiness?.id);

        if (!success) {
          toast({
            title: "Inventory Update Warning",
            description: "Sale deleted, but inventory restoration might have failed. Please check your stock levels.",
            variant: "destructive"
          });
        }
      } else {
        console.log('Skipping product restoration (Quote or No items)');
      }

      // If we made it here, proceed to delete the sale.
      const { error } = await supabase
        .from('sales' as any)
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness?.id);

      if (error) throw error;

      // Update React Query cache
      queryClient.setQueryData(queryKey, (oldData: Sale[] | undefined) => {
        return oldData ? oldData.filter(sale => sale.id !== id) : [];
      });
      queryClient.invalidateQueries({ queryKey: baseQueryKey });

      // Clear sold items cache after deletion
      clearSoldItemsCache();

      // Log activity for sale deletion
      await logActivity({
        activityType: 'DELETE',
        module: 'SALES',
        entityType: 'sale',
        entityId: id,
        entityName: `Sale #${saleToDelete.receiptNumber}`,
        description: `Deleted sale for ${saleToDelete.customerName} - Total: UGX ${((saleToDelete.amountPaid || 0) + (saleToDelete.amountDue || 0)).toLocaleString()} (Stock restored)`,
        metadata: {
          receiptNumber: saleToDelete.receiptNumber,
          customerName: saleToDelete.customerName,
          customerAddress: saleToDelete.customerAddress,
          customerContact: saleToDelete.customerContact,
          totalAmount: (saleToDelete.amountPaid || 0) + (saleToDelete.amountDue || 0),
          amountPaid: saleToDelete.amountPaid,
          profit: saleToDelete.profit,
          paymentStatus: saleToDelete.paymentStatus,
          taxRate: saleToDelete.taxRate,
          itemCount: saleToDelete.items.length,
          items: saleToDelete.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            total: item.quantity * item.price,
            discountPercentage: item.discountPercentage,
            discountAmount: item.discountAmount
          })),
          notes: saleToDelete.notes,
          cashTransactionDeleted: !!saleToDelete.cashTransactionId
        }
      });

      toast({
        title: "Sale Deleted",
        description: saleToDelete.cashTransactionId
          ? "The sale record and associated cash transaction have been successfully deleted."
          : "The sale record has been successfully deleted."
      });

      clearInventoryCaches();
      return true;
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast({
        title: "Error",
        description: "Failed to delete sale. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const clearSoldItemsCache = useCallback(() => {
    if (!currentBusiness?.id) return;
    const key = `soldItemsFilters_${currentBusiness.id}`;
    localStorage.removeItem(key);

    // Also clear legacy keys for safety
    localStorage.removeItem('soldItemsFilters');
  }, [currentBusiness?.id]);

  const addSale = useCallback((newSale: Sale) => {
    queryClient.setQueryData(queryKey, (oldData: Sale[] | undefined) => {
      return oldData ? [newSale, ...oldData] : [newSale];
    });
    queryClient.invalidateQueries({ queryKey: baseQueryKey });
    clearSoldItemsCache();
    clearInventoryCaches();
  }, [queryClient, queryKey, baseQueryKey, clearSoldItemsCache, clearInventoryCaches]);

  const updateSale = useCallback((updatedSale: Sale) => {
    queryClient.setQueryData(queryKey, (oldData: Sale[] | undefined) => {
      return oldData ? oldData.map(s => s.id === updatedSale.id ? updatedSale : s) : [updatedSale];
    });
    queryClient.invalidateQueries({ queryKey: baseQueryKey });
    clearSoldItemsCache();
    clearInventoryCaches();
  }, [queryClient, queryKey, baseQueryKey, clearSoldItemsCache, clearInventoryCaches]);

  return {
    sales,
    // Removed setSales to prevent manual manipulation outside of mutations
    isLoading,
    deleteSale,
    addSale,
    updateSale,
    getTopCustomers,
    getCustomerLifetimePurchases,
    clearSoldItemsCache,
    refetch,
    isFetching
  };
};
