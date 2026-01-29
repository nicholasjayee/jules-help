"use client";
import { useMemo } from 'react';
import { Product } from '@/types';
import { Sale } from '@/types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const useInventoryData = (
  filteredProducts: Product[],
  sales: Sale[],
  period: 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'all-time'
) => {
  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case 'this-week':
        return { from: startOfWeek(now), to: endOfWeek(now) };
      case 'last-week':
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return { from: startOfWeek(lastWeek), to: endOfWeek(lastWeek) };
      case 'this-month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last-month':
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'all-time':
      default:
        return { from: new Date(0), to: now };
    }
  }, [period]);

  // Memoize top selling products (by sales quantity in selected period)
  const topSellingProducts = useMemo(() => {
    try {
      // Early return if no data
      if (!sales || sales.length === 0 || !filteredProducts || filteredProducts.length === 0) {
        return [];
      }

      // Calculate sold quantities for each product in the selected period
      const productSalesMap = new Map<string, number>();
      
      // Filter sales by date range and payment status with safer date handling
      const filteredSales = sales.filter(sale => {
        try {
          if (!sale || sale.paymentStatus === 'Quote') return false;
          const saleDate = new Date(sale.date);
          // Check for invalid date
          if (isNaN(saleDate.getTime())) return false;
          return saleDate >= dateRange.from && saleDate <= dateRange.to;
        } catch (error) {
          console.warn('Error filtering sale:', error);
          return false;
        }
      });
      
      // Process filtered sales data to get total quantities sold per product
      filteredSales.forEach(sale => {
        try {
          if (!sale.items || !Array.isArray(sale.items)) return;
          
          sale.items.forEach(item => {
            if (item && item.productId && typeof item.quantity === 'number' && item.quantity > 0) {
              const currentQuantity = productSalesMap.get(item.productId) || 0;
              productSalesMap.set(item.productId, currentQuantity + item.quantity);
            }
          });
        } catch (error) {
          console.warn('Error processing sale items:', error);
        }
      });
      
      // Add sold quantity to products and sort by highest sales quantity
      const result = filteredProducts
        .map(product => {
          try {
            return {
              ...product,
              soldQuantity: productSalesMap.get(product.id) || 0
            };
          } catch (error) {
            console.warn('Error mapping product:', error);
            return null;
          }
        })
        .filter((product): product is Product & { soldQuantity: number } => product !== null && product.soldQuantity > 0) // Only show products that were sold
        .sort((a, b) => b.soldQuantity - a.soldQuantity)
        .slice(0, 10);

      return result;
    } catch (error) {
      console.error('Error calculating top selling products:', error);
      return [];
    }
  }, [filteredProducts, sales, dateRange]);

  return {
    topSellingProducts,
    dateRange
  };
};