
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/hooks/use-toast';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataStore } from '@/lib/dataStore';
import { Expense } from '@/components/types/index';
import { useAuth } from '@/components/auth/AuthProvider';

// Re-export Expense interface or import it?
// It is imported from types.

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const loadExpenses = useCallback(async (): Promise<Expense[]> => {
    if (!currentBusiness || !user) {
      return [];
    }

    try {
      const data = await dataStore.getExpenses(user.id);
      // Filter by location if needed, but dummy data might not be segmented
      return data;
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast({
        title: "Error",
        description: "Failed to load expenses. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [currentBusiness?.id, user, toast]);

  const queryKey = ['expenses', currentBusiness?.id];
  const { data: queriedExpenses, isLoading: isQueryLoading } = useQuery({
    queryKey,
    queryFn: loadExpenses,
    enabled: !!currentBusiness?.id && !!user,
  });

  useEffect(() => {
    if (queriedExpenses) {
      setExpenses(queriedExpenses);
    }
  }, [queriedExpenses]);

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
    if (!currentBusiness || !user) {
      toast({
        title: "Error",
        description: "No business selected or user not authenticated",
        variant: "destructive"
      });
      return;
    }

    try {
      const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        amount: expenseData.amount,
        description: expenseData.description,
        category: expenseData.category || null,
        date: expenseData.date,
        paymentMethod: expenseData.paymentMethod || null,
        personInCharge: expenseData.personInCharge || null,
        receiptImage: expenseData.receiptImage || null,
        cashAccountId: expenseData.linkToCash && expenseData.cashAccountId ? expenseData.cashAccountId : null,
        cashTransactionId: null, // Cash linking not fully mocked
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dataStore.createExpense(newExpense);

      setExpenses(prev => [newExpense, ...prev]);
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense created successfully"
      });
    } catch (error) {
      console.error('Error creating expense:', error);
      toast({
        title: "Error",
        description: "Failed to create expense.",
        variant: "destructive"
      });
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense & { linkToCash?: boolean }>) => {
    try {
      const { linkToCash, ...expenseUpdates } = updates;

      await dataStore.updateExpense(id, expenseUpdates);

      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...expenseUpdates } : e));
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense updated successfully"
      });
    } catch (error) {
      console.error('Error updating expense:', error);
      toast({
        title: "Error",
        description: "Failed to update expense.",
        variant: "destructive"
      });
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await dataStore.deleteExpense(id);

      setExpenses(prev => prev.filter(e => e.id !== id));
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Expense deleted successfully"
      });
      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      return false;
    }
  };

  const refreshExpenses = async () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const createBulkExpenses = async (expensesData: any[]) => {
      // Stub
      return [];
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
