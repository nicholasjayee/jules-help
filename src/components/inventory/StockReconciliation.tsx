import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, TrendingDown, TrendingUp, PackagePlus, PackageMinus } from 'lucide-react';
import { Product } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface StockReconciliationProps {
  product: Product;
  onClose: () => void;
  onReconciled: () => void;
}

interface ReconciliationData {
  currentStock: number;
  openingStock: number;
  itemsSold: number;
  stockAdded: number;
  stockIn: number;
  transferOut: number;
  returnIn: number;
  returnOut: number;
  calculatedClosingStock: number;
  discrepancy: number;
  dailyBreakdown: DailyBreakdown[];
}

interface DailyBreakdown {
  date: string;
  startingStock: number;
  itemsSold: number;
  stockAdded: number;
  stockIn: number;
  transferOut: number;
  returnIn: number;
  returnOut: number;
  endingStock: number;
}

const StockReconciliation: React.FC<StockReconciliationProps> = ({
  product,
  onClose,
  onReconciled,
}) => {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { settings } = useBusinessSettings();
  const [isApplying, setIsApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData>({
    currentStock: 0,
    openingStock: 0,
    itemsSold: 0,
    stockAdded: 0,
    stockIn: 0,
    transferOut: 0,
    returnIn: 0,
    returnOut: 0,
    calculatedClosingStock: 0,
    discrepancy: 0,
    dailyBreakdown: [],
  });

  // New state for price adjustments
  const [adjustedCostPrice, setAdjustedCostPrice] = useState<number>(product.costPrice || 0);
  const [adjustedSellingPrice, setAdjustedSellingPrice] = useState<number>(product.sellingPrice || 0);

  // Initialize prices when product changes
  useEffect(() => {
    setAdjustedCostPrice(product.costPrice || 0);
    setAdjustedSellingPrice(product.sellingPrice || 0);
  }, [product.id, product.costPrice, product.sellingPrice]);

  useEffect(() => {
    const calculateReconciliation = async () => {
      if (!user?.id || !currentBusiness?.id) return;

      setIsLoading(true);
      try {
        // 1. Get Opening Stock from first stock history entry (initial stock)
        const { data: firstEntry } = await supabase
          .from('stock_history')
          .select('new_quantity, created_at')
          .eq('product_id', product.id)
          .eq('location_id', currentBusiness.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        const openingStock = firstEntry ? Number(firstEntry.new_quantity) || 0 : 0;

        // 2. Get all transactions with dates using chunked pagination to bypass 1000 row limit
        const chunkSize = 1000;

        // Load all sales
        let allSalesData: any[] = [];
        let salesStart = 0;
        let hasSalesMore = true;

        while (hasSalesMore) {
          const { data: salesChunk, error: salesError } = await supabase
            .from('sales' as any)
            .select('items, date')
            .eq('location_id', currentBusiness.id)
            .range(salesStart, salesStart + chunkSize - 1);

          if (salesError) throw salesError;

          if (salesChunk && salesChunk.length > 0) {
            allSalesData.push(...salesChunk);
            salesStart += chunkSize;
            hasSalesMore = salesChunk.length === chunkSize;
          } else {
            hasSalesMore = false;
          }
        }

        // Load all stock added (Purchase)
        let allStockAddedData: any[] = [];
        let stockAddedStart = 0;
        let hasStockAddedMore = true;

        while (hasStockAddedMore) {
          const { data: stockAddedChunk, error: stockAddedError } = await supabase
            .from('stock_history')
            .select('previous_quantity, new_quantity, created_at, change_reason')
            .eq('product_id', product.id)
            .eq('location_id', currentBusiness.id)
            .ilike('change_reason', '%Purchase:%')
            .range(stockAddedStart, stockAddedStart + chunkSize - 1);

          if (stockAddedError) throw stockAddedError;

          if (stockAddedChunk && stockAddedChunk.length > 0) {
            allStockAddedData.push(...stockAddedChunk);
            stockAddedStart += chunkSize;
            hasStockAddedMore = stockAddedChunk.length === chunkSize;
          } else {
            hasStockAddedMore = false;
          }
        }

        // Calculate total stockAdded for the summary
        const totalStockAddedSum = allStockAddedData.reduce((sum, entry) => {
          return sum + (Number(entry.new_quantity) - Number(entry.previous_quantity));
        }, 0);

        // Load all transfer out
        let allTransferOutData: any[] = [];
        let transferOutStart = 0;
        let hasTransferOutMore = true;

        while (hasTransferOutMore) {
          const { data: transferOutChunk, error: transferOutError } = await supabase
            .from('stock_history')
            .select('previous_quantity, new_quantity, created_at')
            .eq('product_id', product.id)
            .eq('location_id', currentBusiness.id)
            .eq('change_reason', 'Transfer Out')
            .range(transferOutStart, transferOutStart + chunkSize - 1);

          if (transferOutError) throw transferOutError;

          if (transferOutChunk && transferOutChunk.length > 0) {
            allTransferOutData.push(...transferOutChunk);
            transferOutStart += chunkSize;
            hasTransferOutMore = transferOutChunk.length === chunkSize;
          } else {
            hasTransferOutMore = false;
          }
        }

        // Load all return in
        let allReturnInData: any[] = [];
        let returnInStart = 0;
        let hasReturnInMore = true;

        while (hasReturnInMore) {
          const { data: returnInChunk, error: returnInError } = await supabase
            .from('stock_history')
            .select('previous_quantity, new_quantity, created_at')
            .eq('product_id', product.id)
            .eq('location_id', currentBusiness.id)
            .in('change_reason', ['Customer Return', 'Return In'])
            .range(returnInStart, returnInStart + chunkSize - 1);

          if (returnInError) throw returnInError;

          if (returnInChunk && returnInChunk.length > 0) {
            allReturnInData.push(...returnInChunk);
            returnInStart += chunkSize;
            hasReturnInMore = returnInChunk.length === chunkSize;
          } else {
            hasReturnInMore = false;
          }
        }

        // Load all return out
        let allReturnOutData: any[] = [];
        let returnOutStart = 0;
        let hasReturnOutMore = true;

        while (hasReturnOutMore) {
          const { data: returnOutChunk, error: returnOutError } = await supabase
            .from('stock_history')
            .select('previous_quantity, new_quantity, created_at')
            .eq('product_id', product.id)
            .eq('location_id', currentBusiness.id)
            .in('change_reason', ['Return to Supplier', 'Return Out'])
            .range(returnOutStart, returnOutStart + chunkSize - 1);

          if (returnOutError) throw returnOutError;

          if (returnOutChunk && returnOutChunk.length > 0) {
            allReturnOutData.push(...returnOutChunk);
            returnOutStart += chunkSize;
            hasReturnOutMore = returnOutChunk.length === chunkSize;
          } else {
            hasReturnOutMore = false;
          }
        }

        // Build daily transactions map
        const dailyTransactions = new Map<string, {
          itemsSold: number;
          stockAdded: number;
          transferOut: number;
          returnIn: number;
          returnOut: number;
        }>();

        // Process sales by date
        if (allSalesData) {
          allSalesData.forEach((sale: any) => {
            const date = new Date(sale.date).toISOString().split('T')[0];
            const items = Array.isArray(sale.items) ? sale.items : [];
            items.forEach((item: any) => {
              if (item.productId === product.id) {
                const existing = dailyTransactions.get(date) || { itemsSold: 0, stockAdded: 0, transferOut: 0, returnIn: 0, returnOut: 0 };
                existing.itemsSold += Number(item.quantity) || 0;
                dailyTransactions.set(date, existing);
              }
            });
          });
        }

        // Process stock added (Purchase) by date
        if (allStockAddedData) {
          allStockAddedData.forEach((entry: any) => {
            const date = new Date(entry.created_at).toISOString().split('T')[0];
            const delta = Number(entry.new_quantity) - Number(entry.previous_quantity);
            if (delta > 0) {
              const existing = dailyTransactions.get(date) || { itemsSold: 0, stockAdded: 0, transferOut: 0, returnIn: 0, returnOut: 0 };
              existing.stockAdded += delta;
              dailyTransactions.set(date, existing);
            }
          });
        }

        // Process transfers out by date
        if (allTransferOutData) {
          allTransferOutData.forEach((entry: any) => {
            const date = new Date(entry.created_at).toISOString().split('T')[0];
            const delta = Number(entry.previous_quantity) - Number(entry.new_quantity);
            if (delta > 0) {
              const existing = dailyTransactions.get(date) || { itemsSold: 0, stockAdded: 0, transferOut: 0, returnIn: 0, returnOut: 0 };
              existing.transferOut += delta;
              dailyTransactions.set(date, existing);
            }
          });
        }

        // Process returns in by date
        if (allReturnInData) {
          allReturnInData.forEach((entry: any) => {
            const date = new Date(entry.created_at).toISOString().split('T')[0];
            const delta = Number(entry.new_quantity) - Number(entry.previous_quantity);
            if (delta > 0) {
              const existing = dailyTransactions.get(date) || { itemsSold: 0, stockAdded: 0, transferOut: 0, returnIn: 0, returnOut: 0 };
              existing.returnIn += delta;
              dailyTransactions.set(date, existing);
            }
          });
        }

        // Process returns out by date
        if (allReturnOutData) {
          allReturnOutData.forEach((entry: any) => {
            const date = new Date(entry.created_at).toISOString().split('T')[0];
            const delta = Number(entry.previous_quantity) - Number(entry.new_quantity);
            if (delta > 0) {
              const existing = dailyTransactions.get(date) || { itemsSold: 0, stockAdded: 0, transferOut: 0, returnIn: 0, returnOut: 0 };
              existing.returnOut += delta;
              dailyTransactions.set(date, existing);
            }
          });
        }

        // Sort dates and calculate daily breakdown
        const sortedDates = Array.from(dailyTransactions.keys()).sort();
        const dailyBreakdown: DailyBreakdown[] = [];
        let runningStock = openingStock;

        sortedDates.forEach(date => {
          const day = dailyTransactions.get(date)!;
          const startingStock = runningStock;

          // Apply formula: Closing = Opening - Items Sold + Stock Added - Transfer Out + Return In - Return Out
          const endingStock = startingStock - day.itemsSold + day.stockAdded - day.transferOut + day.returnIn - day.returnOut;

          dailyBreakdown.push({
            date,
            startingStock,
            itemsSold: day.itemsSold,
            stockAdded: day.stockAdded,
            stockIn: 0,
            transferOut: day.transferOut,
            returnIn: day.returnIn,
            returnOut: day.returnOut,
            endingStock,
          });

          runningStock = endingStock;
        });

        // Calculate totals
        const totalItemsSold = dailyBreakdown.reduce((sum, day) => sum + day.itemsSold, 0);
        const totalStockAdded = dailyBreakdown.reduce((sum, day) => sum + day.stockAdded, 0);
        const totalTransferOut = dailyBreakdown.reduce((sum, day) => sum + day.transferOut, 0);
        const totalReturnIn = dailyBreakdown.reduce((sum, day) => sum + day.returnIn, 0);
        const totalReturnOut = dailyBreakdown.reduce((sum, day) => sum + day.returnOut, 0);

        const calculatedClosingStock = runningStock;

        const { data: productData } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', product.id)
          .single();

        const currentStock = Number(productData?.quantity) || 0;
        const discrepancy = currentStock - calculatedClosingStock;

        setReconciliationData({
          currentStock,
          openingStock,
          itemsSold: totalItemsSold,
          stockAdded: totalStockAdded,
          stockIn: 0,
          transferOut: totalTransferOut,
          returnIn: totalReturnIn,
          returnOut: totalReturnOut,
          calculatedClosingStock,
          discrepancy,
          dailyBreakdown,
        });
      } catch (error) {
        console.error('Error calculating reconciliation:', error);
        toast.error('Failed to calculate reconciliation data');
      } finally {
        setIsLoading(false);
      }
    };

    calculateReconciliation();
  }, [user?.id, currentBusiness?.id, product.id]);

  // Valuation calculations
  const currentCostValue = reconciliationData.currentStock * (product.costPrice || 0);
  const currentStockValue = reconciliationData.currentStock * (product.sellingPrice || 0);

  const reconciledCostValue = reconciliationData.calculatedClosingStock * adjustedCostPrice;
  const reconciledStockValue = reconciliationData.calculatedClosingStock * adjustedSellingPrice;

  const costValueDiff = reconciledCostValue - currentCostValue;
  const stockValueDiff = reconciledStockValue - currentStockValue;

  const hasDiscrepancy = Math.abs(reconciliationData.discrepancy) > 0.01;

  const handleApplyCorrection = async () => {
    if (!user?.id || !currentBusiness?.id) return;

    setIsApplying(true);

    try {
      // Update product quantity and prices
      const { error: updateError } = await supabase
        .from('products')
        .update({
          quantity: reconciliationData.calculatedClosingStock,
          cost_price: adjustedCostPrice,
          selling_price: adjustedSellingPrice
        })
        .eq('id', product.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Create a stock history entry for the correction
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert({
          product_id: product.id,
          user_id: user.id,
          location_id: currentBusiness.id,
          previous_quantity: reconciliationData.currentStock,
          new_quantity: reconciliationData.calculatedClosingStock,
          change_reason: 'Stock Reconciliation',
          reference_id: null,
          created_at: new Date().toISOString(),
        });

      if (historyError) throw historyError;

      toast.success(
        `Stock reconciled successfully! Corrected ${Math.abs(
          reconciliationData.discrepancy
        ).toFixed(2)} units.`
      );

      onReconciled();
      onClose();
    } catch (error) {
      console.error('Error reconciling stock:', error);
      toast.error('Failed to reconcile stock. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasDiscrepancy ? (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Stock Reconciliation - {product.name}
          </DialogTitle>
          <DialogDescription>
            Review stock calculations and apply corrections if needed
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading reconciliation data...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reconciliationData.currentStock.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Calculated Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reconciliationData.calculatedClosingStock.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pricing Adjustments */}
            <Card className="border-sales-primary/20 bg-sales-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sales-primary" />
                  Valuation & Price Adjustment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adjustment Cost Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{settings.currency}</span>
                      <input
                        type="number"
                        value={adjustedCostPrice}
                        onChange={(e) => setAdjustedCostPrice(Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-2 bg-white border rounded-md text-sm focus:ring-2 focus:ring-sales-primary/20 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Affects Cost Value</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adjustment Selling Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{settings.currency}</span>
                      <input
                        type="number"
                        value={adjustedSellingPrice}
                        onChange={(e) => setAdjustedSellingPrice(Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-2 bg-white border rounded-md text-sm focus:ring-2 focus:ring-sales-primary/20 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Affects Stock Value</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-sales-primary/10 grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-white border shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Cost Valuation Impact</p>
                    <div className="flex items-end justify-between">
                      <span className={`text-base font-bold ${costValueDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {costValueDiff >= 0 ? '+' : ''}{costValueDiff.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white border shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Stock Valuation Impact</p>
                    <div className="flex items-end justify-between">
                      <span className={`text-base font-bold ${stockValueDiff >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                        {stockValueDiff >= 0 ? '+' : ''}{stockValueDiff.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculation Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock Calculation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Opening Stock</span>
                  <span className="font-medium">
                    {reconciliationData.openingStock.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-red-600">
                  <span className="text-sm flex items-center gap-1">
                    <TrendingDown className="h-4 w-4" />
                    Items Sold
                  </span>
                  <span className="font-medium">
                    - {reconciliationData.itemsSold.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-emerald-600">
                  <span className="text-sm flex items-center gap-1">
                    <PackagePlus className="h-4 w-4" />
                    Stock Added (Purchase)
                  </span>
                  <span className="font-medium">
                    + {reconciliationData.stockAdded.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-green-600">
                  <span className="text-sm flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Stock In (Carriage)
                  </span>
                  <span className="font-medium">
                    + {reconciliationData.stockIn.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-orange-600">
                  <span className="text-sm flex items-center gap-1">
                    <PackageMinus className="h-4 w-4" />
                    Transfer Out
                  </span>
                  <span className="font-medium">
                    - {reconciliationData.transferOut.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-blue-600">
                  <span className="text-sm flex items-center gap-1">
                    <PackagePlus className="h-4 w-4" />
                    Return In
                  </span>
                  <span className="font-medium">
                    + {reconciliationData.returnIn.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-purple-600">
                  <span className="text-sm flex items-center gap-1">
                    <PackageMinus className="h-4 w-4" />
                    Return Out
                  </span>
                  <span className="font-medium">
                    - {reconciliationData.returnOut.toFixed(2)}
                  </span>
                </div>

                <div className="border-t pt-3 flex justify-between items-center font-semibold">
                  <span>Calculated Closing Stock</span>
                  <span>{reconciliationData.calculatedClosingStock.toFixed(2)}</span>
                </div>

                {/* Discrepancy */}
                {hasDiscrepancy && (
                  <div
                    className={`border-t pt-3 flex justify-between items-center ${reconciliationData.discrepancy > 0
                      ? 'text-green-600'
                      : 'text-red-600'
                      }`}
                  >
                    <span className="font-semibold">Discrepancy</span>
                    <Badge
                      variant={
                        reconciliationData.discrepancy > 0 ? 'default' : 'destructive'
                      }
                    >
                      {reconciliationData.discrepancy > 0 ? '+' : ''}
                      {reconciliationData.discrepancy.toFixed(2)} units
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {reconciliationData.dailyBreakdown.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No transactions found for this product
                      </div>
                    ) : (
                      reconciliationData.dailyBreakdown.map((day, index) => (
                        <Card key={index} className="p-3 bg-slate-50">
                          <div className="font-semibold text-sm mb-2 text-slate-700">
                            {new Date(day.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Starting Stock:</span>
                              <span className="font-medium">{day.startingStock.toFixed(2)}</span>
                            </div>
                            {day.itemsSold > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Items Sold:</span>
                                <span className="font-medium">-{day.itemsSold.toFixed(2)}</span>
                              </div>
                            )}
                            {day.stockAdded > 0 && (
                              <div className="flex justify-between text-emerald-600">
                                <span>Stock Added:</span>
                                <span className="font-medium">+{day.stockAdded.toFixed(2)}</span>
                              </div>
                            )}
                            {day.stockIn > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Stock In:</span>
                                <span className="font-medium">+{day.stockIn.toFixed(2)}</span>
                              </div>
                            )}
                            {day.transferOut > 0 && (
                              <div className="flex justify-between text-orange-600">
                                <span>Transfer Out:</span>
                                <span className="font-medium">-{day.transferOut.toFixed(2)}</span>
                              </div>
                            )}
                            {day.returnIn > 0 && (
                              <div className="flex justify-between text-blue-600">
                                <span>Return In:</span>
                                <span className="font-medium">+{day.returnIn.toFixed(2)}</span>
                              </div>
                            )}
                            {day.returnOut > 0 && (
                              <div className="flex justify-between text-purple-600">
                                <span>Return Out:</span>
                                <span className="font-medium">-{day.returnOut.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-1.5 border-t border-slate-200">
                              <span className="font-semibold text-slate-700">Ending Stock:</span>
                              <span className="font-bold text-slate-900">{day.endingStock.toFixed(2)}</span>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Preview Changes */}
            {hasDiscrepancy && showPreview && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base text-blue-900">
                    Preview Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-800">Before:</span>
                    <span className="font-medium text-blue-900">
                      {reconciliationData.currentStock.toFixed(2)} units
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-800">After:</span>
                    <span className="font-medium text-blue-900">
                      {reconciliationData.calculatedClosingStock.toFixed(2)} units
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="text-sm font-semibold text-blue-800">
                      Change:
                    </span>
                    <span className="font-semibold text-blue-900">
                      {reconciliationData.discrepancy > 0 ? '+' : ''}
                      {Math.abs(reconciliationData.discrepancy).toFixed(2)} units
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Message */}
            {!hasDiscrepancy && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800">
                  Stock levels are accurate. No reconciliation needed.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {hasDiscrepancy && (
            <>
              {!showPreview ? (
                <Button onClick={() => setShowPreview(true)}>
                  Preview Changes
                </Button>
              ) : (
                <Button
                  onClick={handleApplyCorrection}
                  disabled={isApplying}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isApplying ? 'Applying...' : 'Apply Correction'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockReconciliation;
