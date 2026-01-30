import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CashTransaction,
  DbCashTransaction,
  CashTransactionFormData,
  DailyCashSummary,
  CashAccount,
  mapDbCashTransactionToCashTransaction,
  mapCashTransactionFormToDbInsert
} from '@/types/cash';

export const useCashTransactions = (accountId?: string) => {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [summaryCache, setSummaryCache] = useState<Map<string, DailyCashSummary>>(new Map());
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Chunked transaction loading to bypass Supabase 1000 row limit
  const loadTransactions = useCallback(async (): Promise<CashTransaction[]> => {
    try {
      if (!user || !currentBusiness) {
        return [];
      }

      // First, get the total count
      let countQuery = supabase
        .from('cash_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', currentBusiness.id);

      if (accountId) {
        countQuery = countQuery.eq('account_id', accountId);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error getting transaction count:', countError);
        throw countError;
      }

      // Load transactions in chunks of 1000 to bypass limit
      const allTransactions: any[] = [];
      const chunkSize = 1000;
      let start = 0;

      while (start < (count || 0)) {
        let chunkQuery = supabase
          .from('cash_transactions')
          .select(`
            id,
            user_id,
            account_id,
            amount,
            transaction_type,
            category,
            description,
            person_in_charge,
            tags,
            date,
            payment_method,
            receipt_image,
            created_at,
            updated_at
          `)
          .eq('location_id', currentBusiness.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(start, start + chunkSize - 1);

        // Apply account filter if specified
        if (accountId) {
          chunkQuery = chunkQuery.eq('account_id', accountId);
        }

        const { data: chunkData, error: chunkError } = await chunkQuery;

        if (chunkError) {
          console.error('Error loading transaction chunk:', chunkError);
          throw chunkError;
        }

        if (chunkData && chunkData.length > 0) {
          allTransactions.push(...chunkData);
        }

        // If we got less than chunkSize, we've reached the end
        if (!chunkData || chunkData.length < chunkSize) {
          break;
        }

        start += chunkSize;
      }

      // Format all transactions
      const formattedTransactions = allTransactions.map((item: any) => {
        const dbTransaction: DbCashTransaction = {
          id: item.id,
          user_id: item.user_id,
          account_id: item.account_id,
          amount: item.amount,
          transaction_type: item.transaction_type,
          category: item.category,
          description: item.description,
          person_in_charge: item.person_in_charge,
          tags: item.tags,
          date: item.date,
          payment_method: item.payment_method,
          receipt_image: item.receipt_image,
          created_at: item.created_at,
          updated_at: item.updated_at
        };
        return mapDbCashTransactionToCashTransaction(dbTransaction);
      });

      // Sort transactions by date and created_at descending (most recent first)
      formattedTransactions.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return formattedTransactions;
    } catch (error) {
      console.error('Error loading cash transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load cash transactions. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [user, currentBusiness?.id, accountId, toast]);

  // React Query caching
  const queryKey = ['cash_transactions', currentBusiness?.id, user?.id, accountId];
  const { data: queriedTransactions, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: loadTransactions,
    enabled: !!user && !!currentBusiness?.id,
    staleTime: 5 * 60_000, // 5 minutes - data stays fresh
    gcTime: 30 * 60_000, // 30 minutes - cache persists in memory
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Sync React Query data with local state
  useEffect(() => {
    if (queriedTransactions) {
      setTransactions(queriedTransactions);
      setSummaryCache(new Map()); // Clear summary cache when transactions change
    }
  }, [queriedTransactions]);

  // Derived loading state to avoid flash on background refetch
  const isLoading = isQueryLoading && !queriedTransactions;

  const createTransaction = async (transactionData: CashTransactionFormData) => {
    try {
      if (!user || !currentBusiness) throw new Error('User not authenticated or no business selected');

      // Get account names for proper transfer descriptions
      const getAccountName = async (accountId: string) => {
        const { data, error } = await supabase
          .from('cash_accounts')
          .select('name')
          .eq('id', accountId)
          .eq('location_id', currentBusiness.id)
          .single();

        if (error) throw error;
        return data?.name || 'Unknown Account';
      };

      // Handle transfer transaction - create two transactions
      if (transactionData.transactionType === 'transfer' && transactionData.toAccountId) {
        const fromAccountName = await getAccountName(transactionData.accountId);
        const toAccountName = await getAccountName(transactionData.toAccountId);

        const transferOutData: CashTransactionFormData = {
          ...transactionData,
          transactionType: 'cash_out',
          description: `Transfer to ${toAccountName}: ${transactionData.description}`
        };

        const transferInData: CashTransactionFormData = {
          ...transactionData,
          accountId: transactionData.toAccountId,
          transactionType: 'cash_in',
          description: `Transfer from ${fromAccountName}: ${transactionData.description}`
        };

        const dbTransferOut = {
          ...mapCashTransactionFormToDbInsert(transferOutData, user.id),
          location_id: currentBusiness.id,
          transaction_type: 'transfer_out'
        };
        const dbTransferIn = {
          ...mapCashTransactionFormToDbInsert(transferInData, user.id),
          location_id: currentBusiness.id,
          transaction_type: 'transfer_in'
        };

        const { data: transferOutResult, error: error1 } = await supabase
          .from('cash_transactions')
          .insert(dbTransferOut)
          .select()
          .single();

        const { data: transferInResult, error: error2 } = await supabase
          .from('cash_transactions')
          .insert(dbTransferIn)
          .select()
          .single();

        if (error1 || error2) throw error1 || error2;

        toast({
          title: "Success",
          description: "Transfer completed successfully"
        });

        queryClient.invalidateQueries({ queryKey });
        return;
      }

      const dbInsertData = {
        ...mapCashTransactionFormToDbInsert(transactionData, user.id),
        location_id: currentBusiness.id
      };

      const { data, error } = await supabase
        .from('cash_transactions')
        .insert(dbInsertData)
        .select()
        .single();

      if (error) throw error;

      const newTransaction = mapDbCashTransactionToCashTransaction(data);

      // Update local state immediately
      setTransactions(prev => [newTransaction, ...prev]);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: CashTransaction[] | undefined) => {
        return oldData ? [newTransaction, ...oldData] : [newTransaction];
      });

      toast({
        title: "Success",
        description: "Cash transaction created successfully"
      });

      return newTransaction;
    } catch (error) {
      console.error('Error creating cash transaction:', error);
      toast({
        title: "Error",
        description: "Failed to create cash transaction. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const createBulkTransactions = async (transactionsData: CashTransactionFormData[]) => {
    try {
      if (!user || !currentBusiness) throw new Error('User not authenticated or no business selected');

      // Optimization: Fetch all accounts once for transfer descriptions
      const { data: allAccounts, error: accountsError } = await (supabase as any)
        .from('cash_accounts')
        .select('id, name')
        .eq('location_id', currentBusiness.id);

      if (accountsError) throw accountsError;

      const accountMap = new Map(allAccounts?.map((acc: any) => [acc.id, acc.name]));
      const getAccountName = (id: string) => accountMap.get(id) || 'Unknown Account';

      const dbInserts: any[] = [];

      for (const transactionData of transactionsData) {
        // Handle transfer transaction - create two transactions
        if (transactionData.transactionType === 'transfer' && transactionData.toAccountId) {
          const fromAccountName = getAccountName(transactionData.accountId);
          const toAccountName = getAccountName(transactionData.toAccountId);

          const transferOutData: CashTransactionFormData = {
            ...transactionData,
            transactionType: 'cash_out',
            description: `Transfer to ${toAccountName}: ${transactionData.description}`
          };

          const transferInData: CashTransactionFormData = {
            ...transactionData,
            accountId: transactionData.toAccountId,
            transactionType: 'cash_in',
            description: `Transfer from ${fromAccountName}: ${transactionData.description}`
          };

          dbInserts.push({
            ...mapCashTransactionFormToDbInsert(transferOutData, user.id),
            location_id: currentBusiness.id,
            transaction_type: 'transfer_out'
          });

          dbInserts.push({
            ...mapCashTransactionFormToDbInsert(transferInData, user.id),
            location_id: currentBusiness.id,
            transaction_type: 'transfer_in'
          });
        } else {
          // If it's a transfer but toAccountId is missing, fallback to cash_out to avoid DB errors
          const finalTransactionType = transactionData.transactionType === 'transfer'
            ? 'cash_out'
            : transactionData.transactionType;

          dbInserts.push({
            ...mapCashTransactionFormToDbInsert({
              ...transactionData,
              transactionType: finalTransactionType as any
            }, user.id),
            location_id: currentBusiness.id,
            // Explicitly set transaction_type (though map already handles it)
            transaction_type: finalTransactionType === 'cash_out' ? 'cash_out' : finalTransactionType
          });
        }
      }

      const { data, error } = await (supabase as any)
        .from('cash_transactions')
        .insert(dbInserts)
        .select();

      if (error) throw error;

      const newTransactions = data.map((item: any) => mapDbCashTransactionToCashTransaction(item));

      // Update local state immediately
      setTransactions(prev => [...newTransactions, ...prev]);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: CashTransaction[] | undefined) => {
        return oldData ? [...newTransactions, ...oldData] : newTransactions;
      });

      toast({
        title: "Success",
        description: `Successfully created ${transactionsData.length} transactions`
      });

      return newTransactions;
    } catch (error) {
      console.error('Error creating bulk transactions:', error);
      toast({
        title: "Error",
        description: "Failed to create bulk transactions. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<CashTransactionFormData>) => {
    try {
      if (!user || !currentBusiness) throw new Error('User not authenticated or no business selected');

      const updateData: any = {};

      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.personInCharge !== undefined) updateData.person_in_charge = updates.personInCharge || null;
      if (updates.tags !== undefined) updateData.tags = updates.tags.length > 0 ? updates.tags : null;
      if (updates.date !== undefined) updateData.date = updates.date.toISOString().split('T')[0];
      if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod || null;
      if (updates.receiptImage !== undefined) updateData.receipt_image = updates.receiptImage || null;

      const { data, error } = await supabase
        .from('cash_transactions')
        .update(updateData)
        .eq('id', id)
        .eq('location_id', currentBusiness.id)
        .select()
        .single();

      if (error) throw error;

      const updatedTransaction = mapDbCashTransactionToCashTransaction(data);

      // Update local state immediately
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: CashTransaction[] | undefined) => {
        return oldData ? oldData.map(t => t.id === id ? updatedTransaction : t) : [updatedTransaction];
      });

      // Clear summary cache since transaction data changed
      setSummaryCache(new Map());

      toast({
        title: "Success",
        description: "Transaction updated successfully"
      });

      return updatedTransaction;
    } catch (error) {
      console.error('Error updating cash transaction:', error);
      toast({
        title: "Error",
        description: "Failed to update transaction. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteTransaction = async (id: string, onDeleted?: () => void) => {
    try {
      if (!currentBusiness) throw new Error('No business selected');

      console.log('Attempting to delete transaction:', id);

      // First, check if this transaction is linked to any installment payments
      const { data: installmentPayments, error: installmentError } = await supabase
        .from('installment_payments')
        .select('id, sale_id')
        .eq('cash_transaction_id', id);

      if (installmentError) {
        console.error('Error checking installment payments:', installmentError);
        // Continue with deletion even if we can't check installments
      }

      // If there are linked installment payments, we need to unlink them first
      if (installmentPayments && installmentPayments.length > 0) {
        console.log('Found linked installment payments:', installmentPayments);

        // Update installment payments to remove the cash transaction reference
        const { error: unlinkError } = await supabase
          .from('installment_payments')
          .update({ cash_transaction_id: null })
          .eq('cash_transaction_id', id);

        if (unlinkError) {
          console.error('Error unlinking installment payments:', unlinkError);
          throw new Error('Failed to unlink installment payments before deleting transaction');
        }

        console.log('Successfully unlinked installment payments from transaction');
      }

      // Now delete the cash transaction
      const { error } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness.id);

      if (error) throw error;

      // Optimistic update - remove from local state immediately
      setTransactions(prev => prev.filter(t => t.id !== id));

      // Clear summary cache since transaction data changed
      setSummaryCache(new Map());

      console.log('Successfully deleted transaction:', id);

      toast({
        title: "Success",
        description: installmentPayments && installmentPayments.length > 0
          ? "Cash transaction deleted and unlinked from installment payments successfully"
          : "Cash transaction deleted successfully"
      });

      queryClient.invalidateQueries({ queryKey });

      // Call the callback function if provided
      if (onDeleted) {
        onDeleted();
      }

      return true;
    } catch (error) {
      console.error('Error deleting cash transaction:', error);
      toast({
        title: "Error",
        description: "Failed to delete cash transaction. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Optimized opening balance fetching with better error handling
  const getAccountOpeningBalance = useCallback(async (accountId: string): Promise<number> => {
    try {
      if (!currentBusiness) {
        console.warn('No current business for getting opening balance');
        return 0;
      }

      const { data, error } = await supabase
        .from('cash_accounts')
        .select('opening_balance')
        .eq('id', accountId)
        .eq('location_id', currentBusiness.id)
        .single();

      if (error) {
        console.error('Error fetching account opening balance:', error);
        return 0;
      }

      const balance = Number(data?.opening_balance || 0);
      console.log('Retrieved opening balance for account', accountId, ':', balance);
      return balance;
    } catch (error) {
      console.error('Error fetching account opening balance:', error);
      return 0;
    }
  }, [currentBusiness?.id]);

  // Optimized daily summary calculation with caching and memoization
  const getDailySummary = useCallback(async (date: Date, accountId?: string): Promise<DailyCashSummary> => {
    const dateStr = date.toISOString().split('T')[0];
    const cacheKey = `${dateStr}-${accountId || 'all'}`;

    // Check cache first
    if (summaryCache.has(cacheKey)) {
      console.log('Using cached summary for:', cacheKey);
      return summaryCache.get(cacheKey)!;
    }

    console.log('Calculating daily summary for date:', dateStr, 'account:', accountId);

    // Filter transactions using already loaded data - no additional DB calls
    let filteredTransactions = transactions.filter(t =>
      t.date.toISOString().split('T')[0] === dateStr
    );

    if (accountId) {
      filteredTransactions = filteredTransactions.filter(t => t.accountId === accountId);
    }

    console.log('Filtered transactions for summary:', filteredTransactions.length);

    const cashIn = filteredTransactions
      .filter(t => t.transactionType === 'cash_in' || t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const cashOut = filteredTransactions
      .filter(t => t.transactionType === 'cash_out' || t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersIn = filteredTransactions
      .filter(t => t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = filteredTransactions
      .filter(t => t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate opening balance from yesterday's closing balance using loaded transactions
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let yesterdayTransactions = transactions.filter(t =>
      t.date.toISOString().split('T')[0] <= yesterdayStr
    );

    if (accountId) {
      yesterdayTransactions = yesterdayTransactions.filter(t => t.accountId === accountId);
    }

    const yesterdayCashIn = yesterdayTransactions
      .filter(t => t.transactionType === 'cash_in' || t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const yesterdayCashOut = yesterdayTransactions
      .filter(t => t.transactionType === 'cash_out' || t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get account's opening balance
    let accountOpeningBalance = 0;
    if (accountId) {
      accountOpeningBalance = await getAccountOpeningBalance(accountId);
    }

    const openingBalance = accountOpeningBalance + yesterdayCashIn - yesterdayCashOut;
    const closingBalance = openingBalance + cashIn - cashOut;

    const summary: DailyCashSummary = {
      date,
      openingBalance,
      cashIn,
      cashOut,
      transfersIn,
      transfersOut,
      closingBalance
    };

    // Cache the result
    setSummaryCache(prev => new Map(prev).set(cacheKey, summary));

    console.log('Daily summary calculated:', { openingBalance, cashIn, cashOut, closingBalance });

    return summary;
  }, [transactions, getAccountOpeningBalance, summaryCache]);

  // Optimized date range summary with better performance
  const getDateRangeSummary = useCallback(async (startDate: Date, endDate: Date, accountId?: string): Promise<DailyCashSummary> => {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const cacheKey = `${startDateStr}-${endDateStr}-${accountId || 'all'}`;

    // Check cache first
    if (summaryCache.has(cacheKey)) {
      console.log('Using cached range summary for:', cacheKey);
      return summaryCache.get(cacheKey)!;
    }

    let filteredTransactions = transactions.filter(t => {
      const transactionDateStr = t.date.toISOString().split('T')[0];
      return transactionDateStr >= startDateStr && transactionDateStr <= endDateStr;
    });

    if (accountId) {
      filteredTransactions = filteredTransactions.filter(t => t.accountId === accountId);
    }

    const cashIn = filteredTransactions
      .filter(t => t.transactionType === 'cash_in' || t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const cashOut = filteredTransactions
      .filter(t => t.transactionType === 'cash_out' || t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersIn = filteredTransactions
      .filter(t => t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = filteredTransactions
      .filter(t => t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate opening balance from before the start date using loaded transactions
    const dayBeforeStart = new Date(startDate);
    dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
    const dayBeforeStartStr = dayBeforeStart.toISOString().split('T')[0];

    let transactionsBeforeRange = transactions.filter(t =>
      t.date.toISOString().split('T')[0] <= dayBeforeStartStr
    );

    if (accountId) {
      transactionsBeforeRange = transactionsBeforeRange.filter(t => t.accountId === accountId);
    }

    const cashInBeforeRange = transactionsBeforeRange
      .filter(t => t.transactionType === 'cash_in' || t.transactionType === 'transfer_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const cashOutBeforeRange = transactionsBeforeRange
      .filter(t => t.transactionType === 'cash_out' || t.transactionType === 'transfer_out')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get account's opening balance
    let accountOpeningBalance = 0;
    if (accountId) {
      accountOpeningBalance = await getAccountOpeningBalance(accountId);
    }

    const openingBalance = accountOpeningBalance + cashInBeforeRange - cashOutBeforeRange;
    const closingBalance = openingBalance + cashIn - cashOut;

    const summary: DailyCashSummary = {
      date: startDate,
      openingBalance,
      cashIn,
      cashOut,
      transfersIn,
      transfersOut,
      closingBalance
    };

    // Cache the result
    setSummaryCache(prev => new Map(prev).set(cacheKey, summary));

    return summary;
  }, [transactions, getAccountOpeningBalance, summaryCache]);

  const refreshTransactions = loadTransactions;

  // Realtime: invalidate cash transactions cache on changes for current location
  useEffect(() => {
    if (!user || !currentBusiness?.id) return;

    const channel = supabase
      .channel('cash_transactions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_transactions',
        filter: `location_id=eq.${currentBusiness.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
        // Clear summary cache since transaction data changed
        setSummaryCache(new Map());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentBusiness?.id, accountId]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    transactions,
    isLoading,
    createTransaction,
    createBulkTransactions,
    updateTransaction,
    deleteTransaction,
    getDailySummary,
    getDateRangeSummary,
    refreshTransactions
  }), [transactions, isLoading, getDailySummary, getDateRangeSummary, refreshTransactions, createBulkTransactions]);
};
