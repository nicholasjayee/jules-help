import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InstallmentPayment {
  id: string;
  saleId: string;
  userId: string;
  amount: number;
  paymentDate: Date;
  notes?: string;
  cashTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const useInstallmentPayments = (saleId?: string) => {
  const [payments, setPayments] = useState<InstallmentPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchPayments = async (targetSaleId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('installment_payments')
        .select('*')
        .eq('sale_id', targetSaleId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const formattedPayments: InstallmentPayment[] = data?.map(payment => ({
        id: payment.id,
        saleId: payment.sale_id,
        userId: payment.user_id,
        amount: Number(payment.amount),
        paymentDate: new Date(payment.payment_date),
        notes: payment.notes || undefined,
        cashTransactionId: payment.cash_transaction_id || undefined,
        createdAt: new Date(payment.created_at),
        updatedAt: new Date(payment.updated_at)
      })) || [];

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Error fetching installment payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payment history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCashTransactionForPayment = async (payment: {
    amount: number;
    description: string;
    date: Date;
    accountId: string;
    locationId: string;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
          user_id: userData.user.id,
          account_id: payment.accountId,
          location_id: payment.locationId,
          amount: payment.amount,
          transaction_type: 'cash_in',
          category: 'Installment payment',
          description: payment.description,
          date: payment.date.toISOString().split('T')[0],
          person_in_charge: '',
          tags: [],
          payment_method: '',
          receipt_image: ''
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating cash transaction:', error);
      return null;
    }
  };

  const createPayment = async (payment: {
    saleId: string;
    amount: number;
    notes?: string;
    accountId?: string;
    saleDescription?: string;
    locationId?: string;
    paymentDate?: Date;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Count existing payments to determine if this is the first payment
      const { data: existingPayments, error: countError } = await supabase
        .from('installment_payments')
        .select('id')
        .eq('sale_id', payment.saleId);

      if (countError) throw countError;

      // Determine the note based on payment count
      const isFirstPayment = !existingPayments || existingPayments.length === 0;
      const automaticNote = isFirstPayment ? 'Initial payment' : 'Payment update';
      
      // Use provided notes or automatic note
      const finalNotes = payment.notes || automaticNote;

      let cashTransactionId = null;

      // Create cash transaction if account ID and location ID are provided
      if (payment.accountId && payment.locationId) {
        // Get sale details for better description
        const { data: saleData } = await supabase
          .from('sales')
          .select('customer_name, receipt_number')
          .eq('id', payment.saleId)
          .single();
        
        const description = saleData 
          ? `Installment payment for ${saleData.customer_name} - Receipt #${saleData.receipt_number}`
          : `Installment payment for sale`;
          
        cashTransactionId = await createCashTransactionForPayment({
          amount: payment.amount,
          description: description,
          date: payment.paymentDate || new Date(),
          accountId: payment.accountId,
          locationId: payment.locationId
        });
      }

      const { data, error } = await supabase
        .from('installment_payments')
        .insert({
          sale_id: payment.saleId,
          user_id: userData.user.id,
          amount: payment.amount,
          notes: finalNotes,
          cash_transaction_id: cashTransactionId,
          payment_date: payment.paymentDate?.toISOString() || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const newPayment: InstallmentPayment = {
        id: data.id,
        saleId: data.sale_id,
        userId: data.user_id,
        amount: Number(data.amount),
        paymentDate: new Date(data.payment_date),
        notes: data.notes || undefined,
        cashTransactionId: data.cash_transaction_id || undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setPayments(prev => [newPayment, ...prev]);
      return newPayment;
    } catch (error) {
      console.error('Error creating payment:', error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive"
      });
      return null;
    }
  };

  const updatePayment = async (paymentId: string, updates: {
    amount?: number;
    notes?: string;
    paymentDate?: Date;
  }) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');

      // Prepare update data
      const updateData: any = {};
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.paymentDate !== undefined) updateData.payment_date = updates.paymentDate.toISOString();

      // Update installment payment
      const { data, error } = await supabase
        .from('installment_payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;

      // Update associated cash transaction if it exists
      if (payment.cashTransactionId) {
        const cashUpdateData: any = {};
        if (updates.amount !== undefined) cashUpdateData.amount = updates.amount;
        if (updates.paymentDate !== undefined) cashUpdateData.date = updates.paymentDate.toISOString().split('T')[0];

        if (Object.keys(cashUpdateData).length > 0) {
          const { error: cashError } = await supabase
            .from('cash_transactions')
            .update(cashUpdateData)
            .eq('id', payment.cashTransactionId);

          if (cashError) {
            console.error('Error updating cash transaction:', cashError);
          }
        }
      }

      const updatedPayment: InstallmentPayment = {
        id: data.id,
        saleId: data.sale_id,
        userId: data.user_id,
        amount: Number(data.amount),
        paymentDate: new Date(data.payment_date),
        notes: data.notes || undefined,
        cashTransactionId: data.cash_transaction_id || undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setPayments(prev => prev.map(p => p.id === paymentId ? updatedPayment : p));
      toast({
        title: "Success",
        description: "Payment updated successfully",
      });
      return updatedPayment;
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        title: "Error",
        description: "Failed to update payment",
        variant: "destructive"
      });
      return null;
    }
  };

  const deletePayment = async (paymentId: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');

      // Delete associated cash transaction first if it exists
      if (payment.cashTransactionId) {
        const { error: cashError } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('id', payment.cashTransactionId);

        if (cashError) {
          console.error('Error deleting cash transaction:', cashError);
        }
      }

      // Delete installment payment
      const { error } = await supabase
        .from('installment_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      setPayments(prev => prev.filter(p => p.id !== paymentId));
      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Error",
        description: "Failed to delete payment",
        variant: "destructive"
      });
    }
  };

  const linkPaymentToCashAccount = async (paymentId: string, accountId: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');
      
      if (payment.cashTransactionId) {
        throw new Error('Payment is already linked to a cash account');
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Get account info for location_id
      const { data: accountData, error: accountError } = await supabase
        .from('cash_accounts')
        .select('location_id')
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;

      // Get sale details for better description
      const { data: saleData } = await supabase
        .from('sales')
        .select('customer_name, receipt_number')
        .eq('id', payment.saleId)
        .single();

      const description = saleData 
        ? `Installment payment for ${saleData.customer_name} - Receipt #${saleData.receipt_number}`
        : `Installment payment #${payment.id.substring(0, 8)}`;

      // Create cash transaction
      const cashTransactionId = await createCashTransactionForPayment({
        amount: payment.amount,
        description: description,
        date: payment.paymentDate,
        accountId,
        locationId: accountData.location_id
      });

      if (!cashTransactionId) throw new Error('Failed to create cash transaction');

      // Update payment with cash transaction ID
      const { error: updateError } = await supabase
        .from('installment_payments')
        .update({ cash_transaction_id: cashTransactionId })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Update local state
      setPayments(prev => prev.map(p => 
        p.id === paymentId 
          ? { ...p, cashTransactionId }
          : p
      ));

      toast({
        title: "Success",
        description: "Payment linked to cash account successfully",
      });
    } catch (error) {
      console.error('Error linking payment to cash account:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to link payment to cash account",
        variant: "destructive"
      });
      throw error;
    }
  };

  const unlinkPaymentFromCashAccount = async (paymentId: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');
      
      if (!payment.cashTransactionId) {
        throw new Error('Payment is not linked to a cash account');
      }

      // Delete cash transaction
      const { error: cashError } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('id', payment.cashTransactionId);

      if (cashError) throw cashError;

      // Update payment to remove cash transaction ID
      const { error: updateError } = await supabase
        .from('installment_payments')
        .update({ cash_transaction_id: null })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Update local state
      setPayments(prev => prev.map(p => 
        p.id === paymentId 
          ? { ...p, cashTransactionId: undefined }
          : p
      ));

      toast({
        title: "Success",
        description: "Payment unlinked from cash account successfully",
      });
    } catch (error) {
      console.error('Error unlinking payment from cash account:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unlink payment from cash account",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    if (saleId) {
      fetchPayments(saleId);
    }
  }, [saleId]);

  return {
    payments,
    isLoading,
    fetchPayments,
    createPayment,
    updatePayment,
    deletePayment,
    linkPaymentToCashAccount,
    unlinkPaymentFromCashAccount
  };
};
