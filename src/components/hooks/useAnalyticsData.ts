import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sale, AnalyticsData } from '@/types';
import { 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  isSameDay
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

interface UseAnalyticsDataProps {
  sales: Sale[];
  dateFilter: string;
  dateRange: { from: Date | undefined; to: Date | undefined; };
  specificDate?: Date | undefined;
  isCustomRange: boolean;
  isSpecificDate?: boolean;
}

export function useAnalyticsData({ sales, dateFilter, dateRange, specificDate, isCustomRange, isSpecificDate }: UseAnalyticsDataProps) {
  const [expenses, setExpenses] = useState<number>(0);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const { currentBusiness } = useBusiness();

  // Memoize the expensive calculations
  const calculateSaleTotals = useCallback((sale: Sale) => {
    // Calculate total sale price after discounts (same logic as revenue calculation)
    const totalSalePrice = sale.items && Array.isArray(sale.items) 
      ? sale.items.reduce((sum, item) => {
          const subtotal = item.price * item.quantity;
          const discountAmount = item.discountType === 'amount' 
            ? (item.discountAmount || 0)
            : (subtotal * (item.discountPercentage || 0)) / 100;
          return sum + (subtotal - discountAmount);
        }, 0)
      : 0;
    
    const totalCost = sale.items && Array.isArray(sale.items)
      ? sale.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0)
      : 0;
      
    return { totalSalePrice, totalCost };
  }, []);

  // Memoize date filtering function
  const matchesDateFilter = useCallback((saleDate: Date): boolean => {
    // Validate the sale date
    if (isNaN(saleDate.getTime())) {
      return false;
    }
    
    if (dateFilter === 'all') return true;
    
    if (dateFilter === 'custom' && isCustomRange) {
      if (dateRange.from && dateRange.to) {
        return isWithinInterval(saleDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }
      return true;
    }

    if (dateFilter === 'specific' && isSpecificDate) {
      if (specificDate) {
        return isSameDay(saleDate, specificDate);
      }
      return true;
    }
    
    const today = new Date();
    
    switch(dateFilter) {
      case 'today':
        return isWithinInterval(saleDate, {
          start: startOfDay(today),
          end: endOfDay(today)
        });
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return isWithinInterval(saleDate, {
          start: startOfDay(yesterday),
          end: endOfDay(yesterday)
        });
      case 'this-week':
        return isWithinInterval(saleDate, {
          start: startOfWeek(today, { weekStartsOn: 1 }),
          end: endOfWeek(today, { weekStartsOn: 1 })
        });
      case 'last-week':
        const lastWeekStart = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        return isWithinInterval(saleDate, {
          start: lastWeekStart,
          end: lastWeekEnd
        });
      case 'this-month':
        return isWithinInterval(saleDate, {
          start: startOfMonth(today),
          end: endOfMonth(today)
        });
      case 'last-month':
        const lastMonth = subMonths(today, 1);
        return isWithinInterval(saleDate, {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        });
      case 'this-year':
        return isWithinInterval(saleDate, {
          start: startOfYear(today),
          end: endOfYear(today)
        });
      default:
        return true;
    }
  }, [dateFilter, isCustomRange, isSpecificDate, dateRange, specificDate]);

  // Memoize filtered sales calculation
  const filteredSalesData = useMemo(() => {
    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return matchesDateFilter(saleDate);
    });
    
    return {
      all: filtered,
      nonQuotes: filtered.filter(sale => sale.paymentStatus !== 'Quote')
    };
  }, [sales, matchesDateFilter]);

  // Memoize analytics data calculation
  const analyticsData = useMemo((): AnalyticsData => {
    return filteredSalesData.nonQuotes.reduce((acc, sale) => {
      const { totalSalePrice, totalCost } = calculateSaleTotals(sale);
      // Calculate profit from actual revenue and cost to handle old sales correctly
      const actualProfit = totalSalePrice - totalCost;
      
      return {
        totalSales: acc.totalSales + totalSalePrice,
        totalProfit: acc.totalProfit + actualProfit,
        totalCost: acc.totalCost + totalCost,
        paidSalesCount: acc.paidSalesCount + (sale.paymentStatus === 'Paid' ? 1 : 0),
        pendingSalesCount: acc.pendingSalesCount + (sale.paymentStatus === 'NOT PAID' ? 1 : 0),
      };
    }, {
      totalSales: 0,
      totalProfit: 0,
      totalCost: 0,
      paidSalesCount: 0,
      pendingSalesCount: 0,
    });
  }, [filteredSalesData.nonQuotes, calculateSaleTotals]);

  // Memoize bar chart data
  const barChartData = useMemo(() => [
    { name: 'Total Sales', amount: analyticsData.totalSales },
    { name: 'Total Cost', amount: analyticsData.totalCost },
    { name: 'Total Expenses', amount: expenses },
    { name: 'Total Profit', amount: analyticsData.totalProfit },
  ], [analyticsData, expenses]);

  // Memoize recent sales calculation
  const recentSales = useMemo(() => {
    return [...filteredSalesData.all]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [filteredSalesData.all]);

  // Memoize non-quote sales count
  const nonQuoteSalesCount = useMemo(() => {
    return filteredSalesData.nonQuotes.length;
  }, [filteredSalesData.nonQuotes]);

  // Fetch expenses data based on the current date filter and business location
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!currentBusiness) {
        setExpenses(0);
        setIsLoadingExpenses(false);
        return;
      }

      setIsLoadingExpenses(true);
      try {
        let query = supabase
          .from('expenses')
          .select('amount, date')
          .eq('location_id', currentBusiness.id);
        
        // Apply the same date filtering to expenses as we do to sales
        if (isCustomRange && dateRange.from && dateRange.to) {
          query = query.gte('date', dateRange.from.toISOString())
                      .lte('date', dateRange.to.toISOString());
        } else if (isSpecificDate && specificDate) {
          const startOfSpecificDay = startOfDay(specificDate);
          const endOfSpecificDay = endOfDay(specificDate);
          query = query.gte('date', startOfSpecificDay.toISOString())
                      .lte('date', endOfSpecificDay.toISOString());
        } else if (dateFilter !== 'all') {
          const today = new Date();
          
          switch (dateFilter) {
            case 'today':
              query = query.gte('date', startOfDay(today).toISOString())
                          .lte('date', endOfDay(today).toISOString());
              break;
            case 'yesterday':
              const yesterday = subDays(today, 1);
              query = query.gte('date', startOfDay(yesterday).toISOString())
                          .lte('date', endOfDay(yesterday).toISOString());
              break;
            case 'this-week':
              query = query.gte('date', startOfWeek(today, { weekStartsOn: 1 }).toISOString())
                          .lte('date', endOfWeek(today, { weekStartsOn: 1 }).toISOString());
              break;
            case 'last-week':
              const lastWeekStart = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
              const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
              query = query.gte('date', lastWeekStart.toISOString())
                          .lte('date', lastWeekEnd.toISOString());
              break;
            case 'this-month':
              query = query.gte('date', startOfMonth(today).toISOString())
                          .lte('date', endOfMonth(today).toISOString());
              break;
            case 'last-month':
              const lastMonth = subMonths(today, 1);
              query = query.gte('date', startOfMonth(lastMonth).toISOString())
                          .lte('date', endOfMonth(lastMonth).toISOString());
              break;
            case 'this-year':
              query = query.gte('date', startOfYear(today).toISOString())
                          .lte('date', endOfYear(today).toISOString());
              break;
          }
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching expenses:', error);
          return;
        }
        
        const totalExpenses = data ? data.reduce((sum, expense) => sum + Number(expense.amount), 0) : 0;
        setExpenses(totalExpenses);
      } catch (error) {
        console.error('Failed to fetch expenses:', error);
      } finally {
        setIsLoadingExpenses(false);
      }
    };
    
    fetchExpenses();
  }, [dateFilter, isCustomRange, isSpecificDate, dateRange.from, dateRange.to, specificDate, currentBusiness]);

  return {
    filteredSales: filteredSalesData.all,
    nonQuoteSales: filteredSalesData.nonQuotes,
    analyticsData,
    barChartData,
    recentSales,
    nonQuoteSalesCount,
    expenses,
    isLoadingExpenses
  };
}
