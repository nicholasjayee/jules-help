import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCashTransactions } from '@/hooks/useCashTransactions';

export const useCashTransactionOperations = () => {
  const { 
    createTransaction: createCashTransaction, 
    updateTransaction: updateCashTransaction, 
    deleteTransaction: deleteCashTransaction 
  } = useCashTransactions();

  const createCashTransactionForSale = useCallback(async (
    sale: any, 
    amount: number, 
    linkToCash: boolean, 
    selectedCashAccountId: string, 
    selectedDate: Date,
    paymentStatus: string
  ) => {
    if (!linkToCash || !selectedCashAccountId || paymentStatus !== 'Paid') {
      return null;
    }

    try {
      console.log('Sale object for cash transaction:', sale);
      const description = `Sale to ${sale.customerName || sale.customer_name || 'Customer'} - Receipt #${sale.receiptNumber || sale.receipt_number || 'N/A'}`;
      
      const cashTransaction = await createCashTransaction({
        accountId: selectedCashAccountId,
        amount: amount,
        transactionType: 'cash_in',
        category: 'Cash sale',
        description: description,
        date: selectedDate,
        personInCharge: '',
        tags: [],
        paymentMethod: '',
        receiptImage: ''
      });

      return cashTransaction?.id || null;
    } catch (error) {
      console.error('Error creating cash transaction:', error);
      toast.error('Failed to create cash transaction');
      return null;
    }
  }, [createCashTransaction]);

  const updateCashTransactionForSale = useCallback(async (
    sale: any,
    amount: number,
    cashTransactionId: string | null,
    originalPaymentStatus: string,
    paymentStatus: string,
    linkToCash: boolean,
    selectedCashAccountId: string,
    selectedDate: Date
  ) => {
    try {
      console.log('updateCashTransactionForSale called with:', {
        cashTransactionId,
        linkToCash,
        paymentStatus,
        selectedCashAccountId: selectedCashAccountId || 'EMPTY',
        amount
      });

      const description = `Sale to ${sale.customerName || sale.customer_name || 'Customer'} - Receipt #${sale.receiptNumber || sale.receipt_number || 'N/A'}`;
      
      // Validate selectedCashAccountId is not empty when linking to cash
      const validCashAccountId = selectedCashAccountId && selectedCashAccountId.trim() !== '';
      
      // If no existing cash transaction but user wants to link to cash account
      if (!cashTransactionId && linkToCash && paymentStatus === 'Paid' && validCashAccountId) {
        console.log('Creating new cash transaction for sale update');
        const cashTransaction = await createCashTransaction({
          accountId: selectedCashAccountId,
          amount: amount,
          transactionType: 'cash_in',
          category: 'Cash sale',
          description: description,
          date: selectedDate,
          personInCharge: '',
          tags: [],
          paymentMethod: '',
          receiptImage: ''
        });
        console.log('Created cash transaction:', cashTransaction?.id);
        return cashTransaction?.id || null;
      }
      
      // If no existing cash transaction and not linking to cash, return null
      if (!cashTransactionId) {
        console.log('No cash transaction to update, returning null');
        return null;
      }
      
      // Handle existing cash transaction
      if (originalPaymentStatus === 'Paid' && paymentStatus === 'Installment Sale') {
        console.log('Deleting cash transaction due to status change to Installment Sale');
        await deleteCashTransaction(cashTransactionId);
        return null;
      }
      
      if (linkToCash && paymentStatus === 'Paid' && validCashAccountId) {
        console.log('Updating existing cash transaction');
        await updateCashTransaction(cashTransactionId, {
          amount: amount,
          category: 'Cash sale',
          description: description,
          date: selectedDate
        });
        return cashTransactionId;
      } else {
        console.log('Deleting cash transaction - not linking to cash or not paid');
        await deleteCashTransaction(cashTransactionId);
        return null;
      }
    } catch (error) {
      console.error('Error updating cash transaction:', error);
      toast.error('Failed to update cash transaction');
      return cashTransactionId;
    }
  }, [createCashTransaction, updateCashTransaction, deleteCashTransaction]);

  const createInstallmentPaymentWithCash = useCallback(async (
    saleId: string,
    amount: number,
    saleDescription: string,
    linkToCash: boolean,
    selectedCashAccountId: string,
    locationId: string,
    createInstallmentPayment: any
  ) => {
    if (amount <= 0) {
      return null;
    }

    if (!linkToCash || !selectedCashAccountId) {
      return await createInstallmentPayment({
        saleId,
        amount
      });
    }

    return await createInstallmentPayment({
      saleId,
      amount,
      accountId: selectedCashAccountId,
      saleDescription,
      locationId,
      date: new Date()
    });
  }, []);

  const findCashTransactionForSale = useCallback(async (cashTransactionId: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('account_id')
        .eq('id', cashTransactionId)
        .single();
      
      if (!error && data) {
        return data.account_id;
      }
    } catch (error) {
      console.error('Error finding cash transaction:', error);
    }
    return null;
  }, []);

  return {
    createCashTransactionForSale,
    updateCashTransactionForSale,
    createInstallmentPaymentWithCash,
    findCashTransactionForSale,
  };
};