
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StockSummaryData {
  productId: string;
  productName: string;
  itemNumber: string;
  imageUrl?: string | null;
  costPrice: number;
  sellingPrice: number;
  openingStock: number;
  itemsSold: number;
  stockIn: number;
  transferOut: number;
  returnIn: number;
  returnOut: number;
  adjustments: number;
  adjustmentsValue: number;
  closingStock: number;
  revaluation: number;
}

interface StockSummaryOverviewProps {
  data: StockSummaryData[];
}

const StockSummaryOverview: React.FC<StockSummaryOverviewProps> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const financialTotals = React.useMemo(() => {
    const totals = data.reduce((acc, item) => ({
      openingStock: acc.openingStock + (item.openingStock * item.costPrice),
      itemsSold: acc.itemsSold + (item.itemsSold * item.costPrice),
      stockIn: acc.stockIn + (item.stockIn * item.costPrice),
      transferOut: acc.transferOut + (item.transferOut * item.costPrice),
      returnIn: acc.returnIn + (item.returnIn * item.costPrice),
      returnOut: acc.returnOut + (item.returnOut * item.costPrice),
      adjustments: acc.adjustments + (item.adjustmentsValue || 0),
      revaluation: acc.revaluation + item.revaluation
    }), {
      openingStock: 0,
      itemsSold: 0,
      stockIn: 0,
      transferOut: 0,
      returnIn: 0,
      returnOut: 0,
      adjustments: 0,
      revaluation: 0
    });

    // Calculate closing stock value as a derived value to ensure balance:
    // Closing = Opening + StockIn + ReturnIn + Adjustments - ItemsSold - TransferOut - ReturnOut
    const closingStock = totals.openingStock + totals.stockIn + totals.returnIn + totals.adjustments
      - totals.itemsSold - totals.transferOut - totals.returnOut;

    return { ...totals, closingStock };
  }, [data]);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Summary Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">OPENING STOCK</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(financialTotals.openingStock)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">ITEMS SOLD</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(financialTotals.itemsSold)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">STOCK IN</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(financialTotals.stockIn)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">TRANSFER OUT</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(financialTotals.transferOut)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">RETURN IN</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(financialTotals.returnIn)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">RETURN OUT</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(financialTotals.returnOut)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">CLOSING STOCK</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(financialTotals.closingStock)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">REVALUATION</p>
            <p className={`text-xl font-bold ${financialTotals.revaluation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(financialTotals.revaluation)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockSummaryOverview;
