import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category?: string;
  date: Date;
  paymentMethod?: string;
  personInCharge?: string;
  receiptImage?: string;
  cashAccountId?: string;
  cashTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const loadExpenses = useCallback(async (): Promise<Expense[]> => {
    if (!currentBusiness) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedExpenses: Expense[] = data?.map(expense => ({
        id: expense.id,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: new Date(expense.date),
        paymentMethod: expense.payment_method,
        personInCharge: expense.person_in_charge,
        receiptImage: expense.receipt_image,
        cashAccountId: expense.cash_account_id,
        cashTransactionId: expense.cash_transaction_id,
        createdAt: new Date(expense.created_at),
        updatedAt: new Date(expense.updated_at)
      })) || [];

      return formattedExpenses;
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast({
        title: "Error",
        description: "Failed to load expenses. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [currentBusiness?.id, toast]);

  // React Query caching
  const queryKey = ['expenses', currentBusiness?.id];
  const { data: queriedExpenses, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: loadExpenses,
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (queriedExpenses) {
      setExpenses(queriedExpenses);
    }
  }, [queriedExpenses]);

  // Only report loading when there is no cached data yet to avoid skeleton flash
  const isLoading = isQueryLoading && !queriedExpenses;

  const createExpense = async (expenseData: {
    amount: number;
    description: string;
    category?: string;
    date: Date;
    paymentMethod?: string;
    personInCharge?: string;
    receiptImage?: string;
    linkToCash?: boolean;
    cashAccountId?: string;
  }) => {
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('useExpenses: Creating expense with data:', expenseData);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const insertData = {
        user_id: userData.user.id,
        location_id: currentBusiness.id,
        amount: expenseData.amount,
        description: expenseData.description,
        category: expenseData.category || null,
        date: expenseData.date.toISOString(),
        payment_method: expenseData.paymentMethod || null,
        person_in_charge: expenseData.personInCharge || null,
        receipt_image: expenseData.receiptImage || null,
        cash_account_id: expenseData.linkToCash && expenseData.cashAccountId ? expenseData.cashAccountId : null
      };

      console.log('useExpenses: Insert data being sent to database:', insertData);

      const { data, error } = await supabase
        .from('expenses')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('useExpenses: Database error creating expense:', error);
        throw error;
      }

      console.log('useExpenses: Successfully created expense:', data);

      // Format the new expense and update cache immediately
      const newExpense: Expense = {
        id: data.id,
        amount: data.amount,
        description: data.description,
        category: data.category,
        date: new Date(data.date),
        paymentMethod: data.payment_method,
        personInCharge: data.person_in_charge,
        receiptImage: data.receipt_image,
        cashAccountId: data.cash_account_id,
        cashTransactionId: data.cash_transaction_id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Update local state immediately
      setExpenses(prev => [newExpense, ...prev]);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: Expense[] | undefined) => {
        return oldData ? [newExpense, ...oldData] : [newExpense];
      });

      // If linking to cash account, create a cash transaction
      if (expenseData.linkToCash && expenseData.cashAccountId && data) {
        try {
          console.log('useExpenses: Creating cash transaction for expense');

          // Format the date to YYYY-MM-DD format while preserving the user's selected date
          const expenseDate = new Date(expenseData.date);
          const formattedDate = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;

          const cashTransactionData = {
            user_id: userData.user.id,
            location_id: currentBusiness.id,
            account_id: expenseData.cashAccountId,
            amount: expenseData.amount,
            transaction_type: 'cash_out',
            category: expenseData.category || 'Expense',
            description: `Expense: ${expenseData.description}`,
            person_in_charge: expenseData.personInCharge || null,
            date: formattedDate,
            payment_method: expenseData.paymentMethod || null,
            receipt_image: expenseData.receiptImage || null,
            tags: null
          };

          console.log('useExpenses: Cash transaction data:', cashTransactionData);

          const { data: cashTransactionResult, error: cashError } = await supabase
            .from('cash_transactions')
            .insert(cashTransactionData)
            .select()
            .single();

          if (cashError) {
            console.error('useExpenses: Error creating cash transaction:', cashError);
            // Don't throw here - expense was created successfully, just log the cash transaction error
            toast({
              title: "Warning",
              description: "Expense created but failed to link to cash account",
              variant: "destructive"
            });
          } else {
            console.log('useExpenses: Successfully created cash transaction:', cashTransactionResult);

            // Update the expense with the cash transaction ID
            const { error: updateError } = await supabase
              .from('expenses')
              .update({ cash_transaction_id: cashTransactionResult.id })
              .eq('id', data.id);

            if (updateError) {
              console.error('useExpenses: Error updating expense with cash transaction ID:', updateError);
            } else {
              console.log('useExpenses: Successfully linked expense to cash transaction');
            }
          }
        } catch (cashError) {
          console.error('useExpenses: Exception creating cash transaction:', cashError);
          // Don't fail the entire operation
        }
      }

      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense created successfully"
      });
    } catch (error) {
      console.error('Error creating expense:', error);
      toast({
        title: "Error",
        description: "Failed to create expense. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense & { linkToCash?: boolean }>) => {
    try {
      console.log('useExpenses: Updating expense with data:', updates);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Get the current expense to check existing cash transaction
      const currentExpense = expenses.find(exp => exp.id === id);
      if (!currentExpense) throw new Error('Expense not found');

      const updateData: any = {};

      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.date !== undefined) updateData.date = updates.date.toISOString();
      if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
      if (updates.personInCharge !== undefined) updateData.person_in_charge = updates.personInCharge;
      if (updates.receiptImage !== undefined) updateData.receipt_image = updates.receiptImage;

      // Handle cash account linking
      const shouldLinkToCash = updates.linkToCash && updates.cashAccountId;
      const wasLinkedToCash = !!currentExpense.cashTransactionId;

      if (shouldLinkToCash) {
        updateData.cash_account_id = updates.cashAccountId;
      } else {
        updateData.cash_account_id = null;
      }

      // Update the expense first
      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update local state immediately
      setExpenses(prev => prev.map(exp => {
        if (exp.id === id) {
          return {
            ...exp,
            ...updates,
            cashAccountId: shouldLinkToCash ? updates.cashAccountId : undefined
          };
        }
        return exp;
      }));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: Expense[] | undefined) => {
        return oldData ? oldData.map(exp => {
          if (exp.id === id) {
            return {
              ...exp,
              ...updates,
              cashAccountId: shouldLinkToCash ? updates.cashAccountId : undefined
            };
          }
          return exp;
        }) : [];
      });

      // Handle cash transaction logic
      if (shouldLinkToCash && !wasLinkedToCash) {
        // Create new cash transaction
        console.log('useExpenses: Creating new cash transaction for updated expense');

        // Format the date to YYYY-MM-DD format while preserving the user's selected date
        const expenseDate = updates.date || currentExpense.date;
        const formattedDate = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;

        const cashTransactionData = {
          user_id: userData.user.id,
          location_id: currentBusiness!.id,
          account_id: updates.cashAccountId,
          amount: updates.amount || currentExpense.amount,
          transaction_type: 'cash_out',
          category: updates.category || currentExpense.category || 'Expense',
          description: `Expense: ${updates.description || currentExpense.description}`,
          person_in_charge: updates.personInCharge || currentExpense.personInCharge || null,
          date: formattedDate,
          payment_method: updates.paymentMethod || currentExpense.paymentMethod || null,
          receipt_image: updates.receiptImage || currentExpense.receiptImage || null,
          tags: null
        };

        const { data: cashTransactionResult, error: cashError } = await supabase
          .from('cash_transactions')
          .insert(cashTransactionData)
          .select()
          .single();

        if (cashError) {
          console.error('useExpenses: Error creating cash transaction:', cashError);
          toast({
            title: "Warning",
            description: "Expense updated but failed to link to cash account",
            variant: "destructive"
          });
        } else {
          console.log('useExpenses: Successfully created cash transaction:', cashTransactionResult);

          // Update the expense with the cash transaction ID
          await supabase
            .from('expenses')
            .update({ cash_transaction_id: cashTransactionResult.id })
            .eq('id', id);
        }
      } else if (shouldLinkToCash && wasLinkedToCash) {
        // Update existing cash transaction
        console.log('useExpenses: Updating existing cash transaction');

        // Format the date to YYYY-MM-DD format while preserving the user's selected date
        const expenseDate = updates.date || currentExpense.date;
        const formattedDate = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;

        const cashTransactionUpdateData = {
          account_id: updates.cashAccountId,
          amount: updates.amount || currentExpense.amount,
          category: updates.category || currentExpense.category || 'Expense',
          description: `Expense: ${updates.description || currentExpense.description}`,
          person_in_charge: updates.personInCharge || currentExpense.personInCharge || null,
          date: formattedDate,
          payment_method: updates.paymentMethod || currentExpense.paymentMethod || null,
          receipt_image: updates.receiptImage || currentExpense.receiptImage || null
        };

        const { error: cashUpdateError } = await supabase
          .from('cash_transactions')
          .update(cashTransactionUpdateData)
          .eq('id', currentExpense.cashTransactionId);

        if (cashUpdateError) {
          console.error('useExpenses: Error updating cash transaction:', cashUpdateError);
          toast({
            title: "Warning",
            description: "Expense updated but failed to update cash transaction",
            variant: "destructive"
          });
        }
      } else if (!shouldLinkToCash && wasLinkedToCash) {
        // Delete existing cash transaction
        console.log('useExpenses: Deleting cash transaction');

        const { error: cashDeleteError } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('id', currentExpense.cashTransactionId);

        if (cashDeleteError) {
          console.error('useExpenses: Error deleting cash transaction:', cashDeleteError);
          toast({
            title: "Warning",
            description: "Expense updated but failed to unlink from cash account",
            variant: "destructive"
          });
        } else {
          // Clear the cash transaction ID from the expense
          await supabase
            .from('expenses')
            .update({ cash_transaction_id: null })
            .eq('id', id);
        }
      }

      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense updated successfully"
      });
    } catch (error) {
      console.error('Error updating expense:', error);
      toast({
        title: "Error",
        description: "Failed to update expense. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      // Optimistic update: remove locally
      setExpenses(prev => prev.filter(e => e.id !== id));
      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const filtered = (old as Expense[]).filter(e => e.id !== id);
        return filtered;
      });
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense deleted successfully"
      });

      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const refreshExpenses = async () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // Realtime: invalidate cache on expense table changes for this location
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const channel = supabase
      .channel('expenses_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'expenses',
        filter: `location_id=eq.${currentBusiness.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBusiness?.id]);

  const createBulkExpenses = async (expensesData: {
    amount: number;
    description: string;
    category?: string;
    date: Date;
    paymentMethod?: string;
    personInCharge?: string;
    receiptImage?: string;
    linkToCash?: boolean;
    cashAccountId?: string;
  }[]) => {
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const bulkResults: Expense[] = [];

      // Process each expense. We could batch the DB inserts but linking to cash requires individual processing 
      // or a more complex batched approach if we want to associate transaction IDs back.
      // For simplicity and to reuse the logic, we'll loop, but we can optimize non-linked ones.

      for (const expenseData of expensesData) {
        const insertData = {
          user_id: userData.user.id,
          location_id: currentBusiness.id,
          amount: expenseData.amount,
          description: expenseData.description,
          category: expenseData.category || null,
          date: expenseData.date.toISOString(),
          payment_method: expenseData.paymentMethod || null,
          person_in_charge: expenseData.personInCharge || null,
          receipt_image: expenseData.receiptImage || null,
          cash_account_id: expenseData.linkToCash && expenseData.cashAccountId ? expenseData.cashAccountId : null
        };

        const { data, error } = await supabase
          .from('expenses')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        let cashTransactionId = null;

        if (expenseData.linkToCash && expenseData.cashAccountId && data) {
          try {
            const expenseDate = new Date(expenseData.date);
            const formattedDate = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;

            const cashTransactionData = {
              user_id: userData.user.id,
              location_id: currentBusiness.id,
              account_id: expenseData.cashAccountId,
              amount: expenseData.amount,
              transaction_type: 'cash_out',
              category: expenseData.category || 'Expense',
              description: `Expense: ${expenseData.description}`,
              person_in_charge: expenseData.personInCharge || null,
              date: formattedDate,
              payment_method: expenseData.paymentMethod || null,
              receipt_image: expenseData.receiptImage || null,
              tags: null
            };

            const { data: cashTransactionResult, error: cashError } = await supabase
              .from('cash_transactions')
              .insert(cashTransactionData)
              .select()
              .single();

            if (!cashError && cashTransactionResult) {
              cashTransactionId = cashTransactionResult.id;
              await supabase
                .from('expenses')
                .update({ cash_transaction_id: cashTransactionId })
                .eq('id', data.id);
            }
          } catch (cashError) {
            console.error('Error linking bulk expense to cash:', cashError);
          }
        }

        bulkResults.push({
          id: data.id,
          amount: data.amount,
          description: data.description,
          category: data.category,
          date: new Date(data.date),
          paymentMethod: data.payment_method,
          personInCharge: data.person_in_charge,
          receiptImage: data.receipt_image,
          cashAccountId: data.cash_account_id,
          cashTransactionId: cashTransactionId || data.cash_transaction_id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        });
      }

      // Update local state and cache once
      setExpenses(prev => [...bulkResults, ...prev]);
      queryClient.setQueryData(queryKey, (oldData: Expense[] | undefined) => {
        return oldData ? [...bulkResults, ...oldData] : bulkResults;
      });

      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: `Successfully created ${expensesData.length} expenses`
      });

      return bulkResults;
    } catch (error) {
      console.error('Error creating bulk expenses:', error);
      toast({
        title: "Error",
        description: "Failed to create bulk expenses. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    expenses,
    isLoading,
    createExpense,
    createBulkExpenses,
    updateExpense,
    deleteExpense,
    refreshExpenses
  };
};
