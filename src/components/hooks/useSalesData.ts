
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sale } from '@/components/types/index';
import { useToast } from '@/components/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useProducts } from '@/components/hooks/useProducts';
import { dataStore } from '@/lib/dataStore';

export interface TopCustomer {
  id?: string;
  name: string;
  totalPurchases: number;
  orderCount: number;
}

export const useSalesData = (userId: string | undefined, sortOrder: string = 'desc', pageSize?: number) => {

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  // We don't necessarily need useProducts here if we use dataStore directly, but keeping it if needed

  const loadSales = useCallback(async (): Promise<Sale[]> => {
    try {
      if (!userId || !currentBusiness) {
        return [];
      }

      const sales = await dataStore.getSales(userId, currentBusiness.id);

      // Sort
      const sorted = [...sales].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });

      if (pageSize && pageSize > 0) {
          return sorted.slice(0, pageSize);
      }
      return sorted;

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
  });

  const isLoading = isQueryLoading || (isFetching && sales.length === 0);

  const getTopCustomers = useMemo((): TopCustomer[] => {
    const nonQuoteSales = sales.filter(sale => sale.paymentStatus !== "Quote");
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

    return Array.from(customerMap.entries())
      .map(([name, data]) => ({
        id: data.customerId,
        name,
        totalPurchases: data.total,
        orderCount: data.count
      }))
      .sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [sales]);

  const getCustomerLifetimePurchases = useMemo(() => {
    return (customerName: string) => {
      const customerSales = sales.filter(sale =>
        sale.customerName.toLowerCase() === customerName.toLowerCase() &&
        sale.paymentStatus !== "Quote"
      );

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
      await dataStore.deleteSale(id);
      queryClient.invalidateQueries({ queryKey: baseQueryKey });

      toast({
        title: "Sale Deleted",
        description: "The sale record has been successfully deleted."
      });

      return true;
    } catch (error) {
      console.error('Error deleting sale:', error);
      return false;
    }
  };

  const clearSoldItemsCache = useCallback(() => {
      // no-op
  }, []);

  const addSale = useCallback((newSale: Sale) => {
    dataStore.createSale(newSale).then(() => {
        queryClient.invalidateQueries({ queryKey: baseQueryKey });
    });
  }, [queryClient, baseQueryKey]);

  const updateSale = useCallback((updatedSale: Sale) => {
      dataStore.updateSale(updatedSale.id, updatedSale).then(() => {
          queryClient.invalidateQueries({ queryKey: baseQueryKey });
      });
  }, [queryClient, baseQueryKey]);

  return {
    sales,
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
