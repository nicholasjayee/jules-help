
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sale, AnalyticsData } from '@/components/types/index';
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
import { useBusiness } from '@/components/contexts/BusinessContext';
import { dataStore } from '@/lib/dataStore';
import { useAuth } from '@/components/auth/AuthProvider';

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
  const { user } = useAuth();

  const calculateSaleTotals = useCallback((sale: Sale) => {
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

  const matchesDateFilter = useCallback((saleDate: Date): boolean => {
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

  const analyticsData = useMemo((): AnalyticsData => {
    return filteredSalesData.nonQuotes.reduce((acc, sale) => {
      const { totalSalePrice, totalCost } = calculateSaleTotals(sale);
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

  const barChartData = useMemo(() => [
    { name: 'Total Sales', amount: analyticsData.totalSales },
    { name: 'Total Cost', amount: analyticsData.totalCost },
    { name: 'Total Expenses', amount: expenses },
    { name: 'Total Profit', amount: analyticsData.totalProfit },
  ], [analyticsData, expenses]);

  const recentSales = useMemo(() => {
    return [...filteredSalesData.all]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [filteredSalesData.all]);

  const nonQuoteSalesCount = useMemo(() => {
    return filteredSalesData.nonQuotes.length;
  }, [filteredSalesData.nonQuotes]);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!currentBusiness || !user) {
        setExpenses(0);
        setIsLoadingExpenses(false);
        return;
      }

      setIsLoadingExpenses(true);
      try {
        const allExpenses = await dataStore.getExpenses(user.id);
        
        // Client-side filtering
        const filteredExpenses = allExpenses.filter(expense => {
           // We assume dataStore returns all expenses for the user (or we need to filter by location if the store didn't)
           // If dataStore.getExpenses(userId) returns all, we should filter by location if locationId was part of expense interface (it is in Supabase DB schema, but maybe not in Expense interface?)
           // Expense interface in hooks/useExpenses.ts had location_id when mapping?
           // In types/index.ts: Expense doesn't have location_id explicit in the interface, but DBExpense does.
           // However, dataStore just returns what we put in.
           // For now, assuming dummy data is small, we filter by date only.

           const expenseDate = new Date(expense.date);
           return matchesDateFilter(expenseDate);
        });

        const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
        setExpenses(totalExpenses);
      } catch (error) {
        console.error('Failed to fetch expenses:', error);
      } finally {
        setIsLoadingExpenses(false);
      }
    };
    
    fetchExpenses();
  }, [dateFilter, isCustomRange, isSpecificDate, dateRange.from, dateRange.to, specificDate, currentBusiness, user, matchesDateFilter]);

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
