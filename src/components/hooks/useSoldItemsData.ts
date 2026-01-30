import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSalesData } from '@/hooks/useSalesData';
import { useProducts } from '@/hooks/useProducts';
import { getDateRangeFromFilter } from '@/utils/dateFilters';
import { isSameDay } from 'date-fns';
import { calculateItemActualAmount, calculateItemActualPrice } from '@/utils/discountCalculations';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SoldItem {
  description: string;
  totalQuantity: number;
  averagePrice: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  totalDiscount: number;
  averageCost?: number;
  productIds: string[];
}

export const useSoldItemsData = (
  dateFilter: string,
  dateRange: { from: Date | undefined; to: Date | undefined },
  specificDate: Date | undefined,
  showOnlyNotInInventory: boolean
) => {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { sales, isLoading: salesLoading, clearSoldItemsCache } = useSalesData(user?.id, 'desc');

  // Fetch product inventory status for checking if items exist in inventory
  const { data: dbInventoryMap, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory_check_map', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return new Map<string, boolean>();

      const { data: dbProducts } = await supabase
        .from('products' as any)
        .select('id, name')
        .eq('location_id', currentBusiness.id)
        .limit(10000);

      const invMap = new Map<string, boolean>();
      (dbProducts || []).forEach((p: any) => {
        if (p.id) invMap.set(p.id, true);
        if (p.name) invMap.set(p.name.trim().toLowerCase(), true);
      });
      return invMap;
    },
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  });

  // Calculate sold items derived from sales and inventory map
  const soldItems = useMemo(() => {
    if (!sales || sales.length === 0) return [];

    let from: Date, to: Date;

    if (dateFilter === 'specific-date' && specificDate) {
      from = new Date(specificDate);
      from.setHours(0, 0, 0, 0);
      to = new Date(specificDate);
      to.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      from = dateRange.from;
      to = dateRange.to;
    } else {
      const range = getDateRangeFromFilter(dateFilter);
      from = range.from;
      to = range.to;
    }

    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      if (dateFilter === 'specific-date' && specificDate) {
        return isSameDay(saleDate, specificDate) && sale.paymentStatus !== 'Quote';
      }
      return saleDate >= from && saleDate <= to && sale.paymentStatus !== 'Quote';
    });

    const itemsMap = new Map<string, { totalQuantity: number; totalAmount: number; totalCost: number; totalProfit: number; totalDiscount: number; prices: number[]; costs: number[]; productIds: string[] }>();

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.description;
        const subtotal = item.price * item.quantity;
        const amount = calculateItemActualAmount(item);
        const discount = subtotal - amount;
        const cost = (item.cost || 0) * item.quantity;
        const profit = amount - cost;
        const actualPrice = calculateItemActualPrice(item);

        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key)!;
          existing.totalQuantity += item.quantity;
          existing.totalAmount += amount;
          existing.totalCost += cost;
          existing.totalProfit += profit;
          existing.totalDiscount += discount;
          existing.prices.push(actualPrice);
          existing.costs.push(item.cost || 0);
          if (item.productId && !existing.productIds.includes(item.productId)) {
            existing.productIds.push(item.productId);
          }
        } else {
          itemsMap.set(key, {
            totalQuantity: item.quantity,
            totalAmount: amount,
            totalCost: cost,
            totalProfit: profit,
            totalDiscount: discount,
            prices: [actualPrice],
            costs: [item.cost || 0],
            productIds: item.productId ? [item.productId] : []
          });
        }
      });
    });

    const result: SoldItem[] = Array.from(itemsMap.entries()).map(([description, data]) => ({
      description,
      totalQuantity: data.totalQuantity,
      averagePrice: data.prices.reduce((sum, price) => sum + price, 0) / data.prices.length,
      totalAmount: data.totalAmount,
      totalCost: data.totalCost,
      totalProfit: data.totalProfit,
      totalDiscount: data.totalDiscount,
      averageCost: data.costs.reduce((sum, cost) => sum + cost, 0) / data.costs.length,
      productIds: data.productIds
    }));

    const sortedResult = result.sort((a, b) => b.totalAmount - a.totalAmount);

    // Apply inventory filter if needed
    if (showOnlyNotInInventory && dbInventoryMap) {
      return sortedResult.filter(item => {
        const existsById = item.productIds.some(id => dbInventoryMap.has(id));
        if (existsById) return false;

        const trimmedDesc = item.description.trim().toLowerCase();
        return !dbInventoryMap.has(trimmedDesc);
      });
    }

    return sortedResult;
  }, [sales, dateFilter, dateRange, specificDate, dbInventoryMap, showOnlyNotInInventory]);

  return {
    soldItems,
    isLoading: salesLoading || inventoryLoading,
    loadSoldItemsData: () => {
      // Force reload by invalidating sales query (since we rely on it)
      clearSoldItemsCache(); // This helper from useSalesData will clear caches, but real reload comes from useSalesData invalidation
    }
  };
};
