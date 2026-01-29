import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, Edit, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useProducts } from '@/hooks/useProducts';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import StockHistoryDateFilter from './StockHistoryDateFilter';
import EditStockHistoryDialog from './EditStockHistoryDialog';
import { EditGroupDateDialog } from './EditGroupDateDialog';
import DeleteStockHistoryDialog from './DeleteStockHistoryDialog';
import { DeleteInvoiceDialog } from './DeleteInvoiceDialog';
import { StockHistoryEntry } from '@/types';

// Inline mock for missing utils
const getDateRangeFromFilter = (filter: string) => {
    const now = new Date();
    if (filter === 'today') return { from: new Date(now.setHours(0,0,0,0)), to: new Date(now.setHours(23,59,59,999)) };
    if (filter === 'this-month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    return null;
}

// Inline mock hook for missing useStockHistory
const useStockHistory = (userId: string | undefined) => {
    // Return empty history or some mock
    const stockHistory: StockHistoryEntry[] = [];
    return {
        stockHistory,
        isLoading: false,
        updateStockHistoryEntry: async () => true,
        deleteStockHistoryEntry: async () => true,
        deleteMultipleStockHistoryEntries: async () => true,
        recalculateProductStock: async () => true,
        loadStockHistory: async () => {}
    };
}

// Inline mock for useStockSummaryData (unused but imported in original)
const useStockSummaryData = (props: any) => ({
    clearAllLocationCaches: () => {}
});

const StockInputHistory = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { stockHistory, isLoading, updateStockHistoryEntry, deleteStockHistoryEntry, deleteMultipleStockHistoryEntries, recalculateProductStock, loadStockHistory } = useStockHistory(user?.id);
  const { products, loadProducts } = useProducts(user?.id, 10000);
  const settings = { currency: 'UGX' }; // Mock settings
  const { clearAllLocationCaches } = useStockSummaryData({ from: undefined, to: undefined });

  const [dateFilter, setDateFilter] = useState<string>('this-month');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [editHistoryDialog, setEditHistoryDialog] = useState<{ open: boolean; entry: StockHistoryEntry | null }>({ open: false, entry: null });
  const [editGroupDateDialog, setEditGroupDateDialog] = useState<{ open: boolean; group: { date: Date; entries: StockHistoryEntry[]; supplier?: string; invoice?: string } | null }>({ open: false, group: null });
  const [deleteHistoryDialog, setDeleteHistoryDialog] = useState<{ open: boolean; entry: StockHistoryEntry | null }>({ open: false, entry: null });
  const [deleteInvoiceDialog, setDeleteInvoiceDialog] = useState<{ open: boolean; group: { supplier: string; invoice: string; entries: StockHistoryEntry[] } | null }>({ open: false, group: null });
  // Removed scavengedNames as it was Supabase dependent

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const currencySymbol = settings.currency;

  const formatNumber = (num: number) => {
    return parseFloat(num.toFixed(5)).toLocaleString();
  };

  const dateRange = dateFilter === 'all' ? null : getDateRangeFromFilter(dateFilter);

  const { filteredBulkGroups, filteredRegularGroups } = useMemo(() => {
    // Simplified logic as stockHistory is likely empty or mock
    return { filteredBulkGroups: [], filteredRegularGroups: [] };
  }, [stockHistory, products, dateRange, debouncedSearchTerm, isLoading]);

  const getProductDetails = useCallback((entry: StockHistoryEntry) => {
     // Mock implementation
      return {
        name: "Mock Product",
        costPrice: 0,
        sellingPrice: 0
      };
  }, [products]);

  const calculateGroupTotals = (entries: StockHistoryEntry[]) => {
    return { totalQty: 0, totalAmount: 0 };
  };

  const handleProductClick = (productId: string) => {
    router.push(`/inventory/${productId}`);
  };

  const handleEditStockHistory = async (entryId: string, newQuantity: number, newReason: string, newDate?: Date) => {
    return true;
  };

  const handleDeleteStockHistory = async (entryId: string) => {
    return true;
  };

  const handleDeleteInvoice = (group: { supplier: string; invoice: string; entries: StockHistoryEntry[] }) => {
    setDeleteInvoiceDialog({ open: true, group });
  };

  const handleEditGroupDate = (group: { date: Date; entries: StockHistoryEntry[]; supplier?: string; invoice?: string }) => {
    setEditGroupDateDialog({ open: true, group });
  };

  const handleEditGroupDateConfirm = async (newDate: Date) => {
    return true;
  };

  const handleDeleteInvoiceConfirm = async (entryIds: string[]) => {
    return true;
  };

  return (
    <Card className="mt-6 shadow-sm">
      <CardHeader className="pb-3 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <History size={20} />
            <div>
              <CardTitle className="text-base md:text-lg">Stock Input History</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View all stock additions and increases
              </p>
            </div>
          </div>

          <StockHistoryDateFilter
            selectedFilter={dateFilter}
            onFilterChange={setDateFilter}
          />
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by supplier, invoice, or item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="text-center py-8 text-muted-foreground">
            <History size={48} className="mx-auto mb-4 opacity-50" />
            <p>No stock input history found (Dummy Mode).</p>
        </div>
      </CardContent>

      <EditStockHistoryDialog
        open={editHistoryDialog.open}
        onOpenChange={(open) => setEditHistoryDialog({ open, entry: null })}
        entry={editHistoryDialog.entry}
        onConfirm={handleEditStockHistory}
        productCreatedAt={undefined}
      />

      <DeleteStockHistoryDialog
        open={deleteHistoryDialog.open}
        onOpenChange={(open) => setDeleteHistoryDialog({ open, entry: null })}
        entry={deleteHistoryDialog.entry}
        onConfirm={handleDeleteStockHistory}
      />

      <DeleteInvoiceDialog
        open={deleteInvoiceDialog.open}
        onOpenChange={(open) => setDeleteInvoiceDialog({ open, group: null })}
        group={deleteInvoiceDialog.group}
        onConfirm={handleDeleteInvoiceConfirm}
      />

      <EditGroupDateDialog
        open={editGroupDateDialog.open}
        onOpenChange={(open) => setEditGroupDateDialog({ open, group: null })}
        group={editGroupDateDialog.group}
        onConfirm={handleEditGroupDateConfirm}
      />
    </Card>
  );
};

export default StockInputHistory;
