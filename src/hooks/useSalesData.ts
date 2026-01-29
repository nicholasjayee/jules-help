"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sale } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/contexts/BusinessContext';
import { useProducts } from '@/hooks/useProducts';
import { getSales, addSaleToDb, deleteSaleFromDb } from '@/lib/dummyData';

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
  const { updateProduct } = useProducts(userId);

  const loadSales = useCallback(async (): Promise<Sale[]> => {
    try {
      if (!userId || !currentBusiness) {
        return [];
      }
      const data = await getSales();
      // Sort logic
      return data.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } catch (error) {
      console.error('Error loading sales:', error);
      toast({
        title: "Error",
        description: "Failed to load sales data.",
        variant: "destructive"
      });
      return [];
    }
  }, [userId, currentBusiness?.id, sortOrder, toast]);

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
      await deleteSaleFromDb(id);

      // Update local cache
      queryClient.setQueryData(queryKey, (oldData: Sale[] | undefined) => {
        return oldData ? oldData.filter(sale => sale.id !== id) : [];
      });
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
    // No-op or clear local storage if needed
  }, []);

  const addSale = useCallback(async (newSale: Sale) => {
    await addSaleToDb(newSale);
    queryClient.invalidateQueries({ queryKey: baseQueryKey });
  }, [queryClient, baseQueryKey]);

  const updateSale = useCallback(async (updatedSale: Sale) => {
      // For now, just invalidate. To implement properly, update dummyData.
      queryClient.invalidateQueries({ queryKey: baseQueryKey });
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
