import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CashAccount, CashTransaction } from '@/types/cash';

export const useCashAccounts = () => {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  // Memoize the load function to prevent unnecessary re-renders
  const loadAccounts = useCallback(async (): Promise<CashAccount[]> => {
    try {
      if (!currentBusiness) {
        return [];
      }
      
      // Optimize query - only select needed fields and limit for faster loading
      const { data, error } = await supabase
        .from('cash_accounts')
        .select('id, name, description, opening_balance, is_default, created_at, updated_at')
        .eq('location_id', currentBusiness.id)
        .order('is_default', { ascending: false })
        .order('name'); // Load all cash accounts

      if (error) throw error;

      const formattedAccounts: CashAccount[] = data?.map(account => ({
        id: account.id,
        name: account.name,
        description: account.description,
        openingBalance: account.opening_balance,
        isDefault: account.is_default,
        createdAt: new Date(account.created_at),
        updatedAt: new Date(account.updated_at)
      })) || [];

      return formattedAccounts;
    } catch (error) {
      console.error('Error loading cash accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load cash accounts. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [currentBusiness?.id, toast]);

  // React Query caching
  const queryKey = ['cash_accounts', currentBusiness?.id];
  const { data: queriedAccounts, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: loadAccounts,
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60_000, // 5 minutes - data stays fresh
    gcTime: 30 * 60_000, // 30 minutes - cache persists in memory
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Sync React Query data with local state
  useEffect(() => {
    if (queriedAccounts) {
      setAccounts(queriedAccounts);
    }
  }, [queriedAccounts]);

  // Derived loading state: only true when first loading (pre cache)
  const isLoading = isQueryLoading && !queriedAccounts;

  const refreshAccounts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Memoize create account function
  const createAccount = useCallback(async (accountData: {
    name: string;
    description?: string;
    openingBalance: number;
    isDefault?: boolean;
  }) => {
    try {
      if (!currentBusiness) {
        toast({
          title: "Error",
          description: "No business selected",
          variant: "destructive"
        });
        return null;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const insertData = {
        user_id: userData.user.id,
        location_id: currentBusiness.id,
        name: accountData.name,
        description: accountData.description || null,
        opening_balance: accountData.openingBalance,
        is_default: accountData.isDefault || false
      };

      const { data, error } = await supabase
        .from('cash_accounts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Format the new account and update cache immediately
      const newAccount: CashAccount = {
        id: data.id,
        name: data.name,
        description: data.description,
        openingBalance: data.opening_balance,
        isDefault: data.is_default,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Update local state immediately
      setAccounts(prev => [newAccount, ...prev]);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: CashAccount[] | undefined) => {
        return oldData ? [newAccount, ...oldData] : [newAccount];
      });
      
      toast({
        title: "Success",
        description: "Cash account created successfully"
      });

      return data;
    } catch (error) {
      console.error('Error creating cash account:', error);
      toast({
        title: "Error",
        description: "Failed to create cash account. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  }, [currentBusiness, loadAccounts, toast]);

  const updateAccount = async (id: string, updates: Partial<CashAccount>) => {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.openingBalance !== undefined) updateData.opening_balance = updates.openingBalance;
      if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;

      const { error } = await supabase
        .from('cash_accounts')
        .update(updateData)
        .eq('id', id)
        .eq('location_id', currentBusiness?.id);

      if (error) throw error;

      // Optimistic update - update local state
      setAccounts(prev => prev.map(a => a.id === id ? {
        ...a,
        name: updates.name ?? a.name,
        description: updates.description ?? a.description,
        openingBalance: updates.openingBalance ?? a.openingBalance,
        isDefault: updates.isDefault ?? a.isDefault,
        updatedAt: new Date()
      } : a));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: CashAccount[] | undefined) => {
        return oldData ? oldData.map(a => a.id === id ? {
          ...a,
          name: updates.name ?? a.name,
          description: updates.description ?? a.description,
          openingBalance: updates.openingBalance ?? a.openingBalance,
          isDefault: updates.isDefault ?? a.isDefault,
          updatedAt: new Date()
        } : a) : [];
      });
      
      toast({
        title: "Success",
        description: "Cash account updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating cash account:', error);
      toast({
        title: "Error",
        description: "Failed to update cash account. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteAccount = async (id: string, onDeleted?: () => void) => {
    try {
      if (!currentBusiness) return { success: false, hasTransactions: false };

      // Check if account has transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('account_id', id)
        .eq('location_id', currentBusiness.id);

      if (transactionError) throw transactionError;

      // Check if account has linked expenses
      const { data: expenses, error: expenseError } = await supabase
        .from('expenses')
        .select('id')
        .eq('cash_account_id', id)
        .eq('location_id', currentBusiness.id);

      if (expenseError) throw expenseError;

      const transactionCount = transactions?.length || 0;
      const expenseCount = expenses?.length || 0;
      const totalLinkedRecords = transactionCount + expenseCount;

      if (totalLinkedRecords > 0) {
        // Return an object indicating the account has linked records
        const details = [];
        if (transactionCount > 0) details.push(`${transactionCount} transaction(s)`);
        if (expenseCount > 0) details.push(`${expenseCount} expense(s)`);
        
        return {
          hasTransactions: true,
          transactionCount: totalLinkedRecords,
          details: `This account has ${details.join(' and ')}. What would you like to do?`,
          success: false
        };
      }

      // If no linked records, delete the account
      const { error } = await supabase
        .from('cash_accounts')
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness.id);

      if (error) throw error;
      // Optimistic remove
      setAccounts(prev => prev.filter(a => a.id !== id));
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: "Success",
        description: "Cash account deleted successfully"
      });

      // Call the callback function if provided
      if (onDeleted) {
        onDeleted();
      }
      
      return { success: true, hasTransactions: false };
    } catch (error) {
      console.error('Error deleting cash account:', error);
      toast({
        title: "Error",
        description: "Failed to delete cash account. Please try again.",
        variant: "destructive"
      });
      return { success: false, hasTransactions: false };
    }
  };

  const deleteAccountWithTransactions = async (id: string, deleteTransactions: boolean = false, onDeleted?: () => void) => {
    try {
      if (!currentBusiness) return false;

      if (deleteTransactions) {
        // First delete associated cash transactions
        const { error: transactionError } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('account_id', id)
          .eq('location_id', currentBusiness.id);

        if (transactionError) throw transactionError;

        // Then unlink or delete associated expenses
        const { error: expenseError } = await supabase
          .from('expenses')
          .update({ 
            cash_account_id: null,
            cash_transaction_id: null 
          })
          .eq('cash_account_id', id)
          .eq('location_id', currentBusiness.id);

        if (expenseError) throw expenseError;
      } else {
        // Just unlink expenses (set cash_account_id to null)
        const { error: expenseError } = await supabase
          .from('expenses')
          .update({ 
            cash_account_id: null,
            cash_transaction_id: null 
          })
          .eq('cash_account_id', id)
          .eq('location_id', currentBusiness.id);

        if (expenseError) throw expenseError;
      }

      // Then delete the account
      const { error: accountError } = await supabase
        .from('cash_accounts')
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness.id);

      if (accountError) throw accountError;
      // Optimistic remove
      setAccounts(prev => prev.filter(a => a.id !== id));
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: "Success",
        description: deleteTransactions 
          ? "Cash account and all associated records deleted successfully"
          : "Cash account deleted successfully (linked records unlinked)"
      });

      // Call the callback function if provided
      if (onDeleted) {
        onDeleted();
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting cash account with transactions:', error);
      toast({
        title: "Error",
        description: "Failed to delete cash account. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Updated balance calculation to use chunked loading like useCashTransactions
  const getAccountBalance = useCallback(async (accountId: string): Promise<number> => {
    try {
      if (!currentBusiness) return 0;

      // Get the account's opening balance
      const { data: account, error: accountError } = await supabase
        .from('cash_accounts')
        .select('opening_balance')
        .eq('id', accountId)
        .eq('location_id', currentBusiness.id)
        .single();

      if (accountError) throw accountError;

      // Get transaction count first to enable chunked loading
      const { count, error: countError } = await supabase
        .from('cash_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('location_id', currentBusiness.id);
      
      if (countError) {
        console.error('Error getting transaction count for balance calculation:', countError);
        throw countError;
      }

      console.log(`Calculating balance for account ${accountId}: ${count || 0} transactions found`);

      // Load all transactions in chunks of 1000 to bypass Supabase limit
      const allTransactions: any[] = [];
      const chunkSize = 1000;
      let start = 0;
      
      while (start < (count || 0)) {
        console.log(`Loading balance chunk ${Math.floor(start / chunkSize) + 1}: rows ${start} to ${start + chunkSize - 1}`);
        
        const { data: chunk, error: chunkError } = await supabase
          .from('cash_transactions')
          .select('amount, transaction_type')
          .eq('account_id', accountId)
          .eq('location_id', currentBusiness.id)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true })
          .range(start, start + chunkSize - 1);

        if (chunkError) {
          console.error('Error loading transaction chunk for balance:', chunkError);
          throw chunkError;
        }

        if (chunk && chunk.length > 0) {
          allTransactions.push(...chunk);
          console.log(`Balance chunk ${Math.floor(start / chunkSize) + 1}: loaded ${chunk.length} transactions`);
        }
        
        start += chunkSize;
      }

      console.log(`Total transactions loaded for balance calculation: ${allTransactions.length}`);

      // Calculate balance using the same logic as the summary - exactly matching DailyCashSummary calculation
      let balance = Number(account.opening_balance);
      
      allTransactions.forEach(transaction => {
        const amount = Number(transaction.amount);
        if (transaction.transaction_type === 'cash_in' || transaction.transaction_type === 'transfer_in') {
          balance += amount;
        } else if (transaction.transaction_type === 'cash_out' || transaction.transaction_type === 'transfer_out') {
          balance -= amount;
        }
      });

      console.log(`Final calculated balance for account ${accountId}: ${balance}`);
      return balance;
    } catch (error) {
      console.error('Error calculating account balance:', error);
      return 0;
    }
  }, [currentBusiness?.id]);

  // Initial load handled by React Query (no manual call)

  // Realtime: invalidate cash accounts cache on changes for current location
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const channel = supabase
      .channel('cash_accounts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_accounts',
        filter: `location_id=eq.${currentBusiness.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBusiness?.id]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    accounts,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount,
    deleteAccountWithTransactions,
    getAccountBalance,
    loadAccounts,
    refreshAccounts
  }), [accounts, isLoading, createAccount, getAccountBalance, loadAccounts]);
};
