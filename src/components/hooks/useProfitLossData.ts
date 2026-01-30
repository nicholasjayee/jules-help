
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSalesData } from '@/hooks/useSalesData';
import { useExpenses } from '@/hooks/useExpenses';
import { useStockSummaryData } from '@/hooks/useStockSummaryData';
import { useCarriageInwards } from '@/hooks/useCarriageInwards';
import { getDateRangeFromFilter } from '@/utils/dateFilters';
import { isSameDay } from 'date-fns';

export interface ProfitLossData {
  sales: number;
  salesReturns: number;
  netSales: number;
  openingStock: number;
  purchases: number;
  carriageInwards: number;
  closingStock: number;
  totalCostSales: number; // Added for new COGS calculation
  totalCOGS: number;
  grossProfit: number;
  expensesByCategory: { [key: string]: number };
  totalExpenses: number;
  netProfitLoss: number;
  taxPercentage: number;
  taxAmount: number;
  finalProfitAfterTax: number;
}

export const useProfitLossData = (
  dateFilter: string,
  dateRange: { from: Date | undefined; to: Date | undefined },
  specificDate: Date | undefined,
  taxPercentage: number = 0
) => {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const [isLoading, setIsLoading] = useState(false);

  // Get data from existing hooks
  const { sales, isLoading: salesLoading } = useSalesData(user?.id);
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { stockSummaryData, isLoading: stockLoading } = useStockSummaryData(dateRange);
  const { carriageInwards, isLoading: carriageLoading } = useCarriageInwards();

  const profitLossData = useMemo((): ProfitLossData => {
    // Calculate date range using the same logic as sold items report
    let from: Date, to: Date;

    if (dateFilter === 'specific' && specificDate) {
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

    // Filter sales by date range and exclude quotes using same logic as sold items report
    const filteredSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      
      if (dateFilter === 'specific' && specificDate) {
        return isSameDay(saleDate, specificDate) && sale.paymentStatus !== 'Quote';
      }
      
      return saleDate >= from && saleDate <= to && sale.paymentStatus !== 'Quote';
    });

    // Filter expenses by date range using same logic
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      
      if (dateFilter === 'specific' && specificDate) {
        return isSameDay(expenseDate, specificDate);
      }
      
      return expenseDate >= from && expenseDate <= to;
    });

    // Filter carriage inwards by date range using same logic
    const filteredCarriageInwards = carriageInwards.filter(record => {
      const recordDate = new Date(record.date);
      
      if (dateFilter === 'specific' && specificDate) {
        return isSameDay(recordDate, specificDate);
      }
      
      return recordDate >= from && recordDate <= to;
    });

    // Calculate Sales/Revenue
    const totalSales = filteredSales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
    }, 0);

    // Calculate Sales Returns (Return In using selling price)
    const totalSalesReturns = stockSummaryData.reduce((sum, item) => {
      return sum + (item.returnIn * item.sellingPrice);
    }, 0);

    // Net Sales
    const netSales = totalSales - totalSalesReturns;

    // Calculate Opening Stock value (using cost price)
    const totalOpeningStock = stockSummaryData.reduce((sum, item) => {
      return sum + (item.openingStock * item.costPrice);
    }, 0);

    // Calculate Purchases (Stock In value using cost price)
    const totalPurchases = stockSummaryData.reduce((sum, item) => {
      return sum + (item.stockIn * item.costPrice);
    }, 0);

    // Calculate Carriage Inwards
    const totalCarriageInwards = filteredCarriageInwards.reduce((sum, record) => {
      return sum + record.amount;
    }, 0);

    // Calculate Closing Stock value (using cost price)
    const totalClosingStock = stockSummaryData.reduce((sum, item) => {
      return sum + (item.closingStock * item.costPrice);
    }, 0);

    // Calculate Total Cost of Sales (cost price of all items sold)
    const totalCostSales = filteredSales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => itemSum + ((item.cost || 0) * item.quantity), 0);
    }, 0);

    // Total COGS = Total Cost Sales + Carriage Inwards
    const totalCOGS = totalCostSales + totalCarriageInwards;

    // Gross Profit
    const grossProfit = netSales - totalCOGS;

    // Group expenses by category
    const expensesByCategory: { [key: string]: number } = {};
    filteredExpenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
    });

    // Total Expenses
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, amount) => sum + amount, 0);

    // Net Profit/Loss
    const netProfitLoss = grossProfit - totalExpenses;

    // Tax calculations
    const taxAmount = netProfitLoss > 0 ? (netProfitLoss * taxPercentage) / 100 : 0;
    const finalProfitAfterTax = netProfitLoss - taxAmount;

    return {
      sales: totalSales,
      salesReturns: totalSalesReturns,
      netSales,
      openingStock: totalOpeningStock,
      purchases: totalPurchases,
      carriageInwards: totalCarriageInwards,
      closingStock: totalClosingStock,
      totalCostSales,
      totalCOGS,
      grossProfit,
      expensesByCategory,
      totalExpenses,
      netProfitLoss,
      taxPercentage,
      taxAmount,
      finalProfitAfterTax
    };
  }, [sales, expenses, stockSummaryData, carriageInwards, dateFilter, dateRange, specificDate, taxPercentage]);

  const loading = useMemo(() => {
    return salesLoading || expensesLoading || stockLoading || carriageLoading;
  }, [salesLoading, expensesLoading, stockLoading, carriageLoading]);

  return {
    profitLossData,
    isLoading: loading
  };
};
