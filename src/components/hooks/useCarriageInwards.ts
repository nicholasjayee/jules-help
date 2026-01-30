
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';

export interface CarriageInward {
  id: string;
  userId: string;
  locationId: string;
  supplierName: string;
  details: string;
  amount: number;
  date: Date;
  cashAccountId?: string;
  cashTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CarriageInwardFormData {
  supplierName: string;
  details: string;
  amount: number;
  date: Date;
  cashAccountId?: string;
}

export const useCarriageInwards = () => {
  const [carriageInwards, setCarriageInwards] = useState<CarriageInward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { toast } = useToast();

  const loadCarriageInwards = useCallback(async () => {
    try {
      if (!user || !currentBusiness) {
        setCarriageInwards([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('carriage_inwards')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData: CarriageInward[] = data?.map(item => ({
        id: item.id,
        userId: item.user_id,
        locationId: item.location_id,
        supplierName: item.supplier_name,
        details: item.details,
        amount: Number(item.amount),
        date: new Date(item.date),
        cashAccountId: item.cash_account_id,
        cashTransactionId: item.cash_transaction_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      })) || [];

      setCarriageInwards(formattedData);
    } catch (error) {
      console.error('Error loading carriage inwards:', error);
      toast({
        title: "Error",
        description: "Failed to load carriage inwards records. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, currentBusiness?.id, toast]);

  const createCarriageInward = async (data: CarriageInwardFormData) => {
    try {
      if (!user || !currentBusiness) throw new Error('User not authenticated or no business selected');

      let cashTransactionId = null;

      // Create cash transaction if cash account is selected
      if (data.cashAccountId) {
        const { data: cashTransaction, error: cashError } = await supabase
          .from('cash_transactions')
          .insert({
            user_id: user.id,
            location_id: currentBusiness.id,
            account_id: data.cashAccountId,
            amount: data.amount,
            transaction_type: 'cash_out',
            category: 'Transport',
            description: `Carriage inwards - ${data.supplierName}: ${data.details}`,
            date: data.date.toISOString().split('T')[0]
          })
          .select()
          .single();

        if (cashError) throw cashError;
        cashTransactionId = cashTransaction.id;
      }

      const { data: carriageData, error } = await supabase
        .from('carriage_inwards')
        .insert({
          user_id: user.id,
          location_id: currentBusiness.id,
          supplier_name: data.supplierName,
          details: data.details,
          amount: data.amount,
          date: data.date.toISOString().split('T')[0],
          cash_account_id: data.cashAccountId || null,
          cash_transaction_id: cashTransactionId
        })
        .select()
        .single();

      if (error) throw error;

      await loadCarriageInwards();
      
      toast({
        title: "Success",
        description: "Carriage inwards record created successfully"
      });

      return carriageData;
    } catch (error) {
      console.error('Error creating carriage inwards:', error);
      toast({
        title: "Error",
        description: "Failed to create carriage inwards record. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateCarriageInward = async (id: string, updates: Partial<CarriageInwardFormData>) => {
    try {
      if (!currentBusiness) throw new Error('No business selected');

      const updateData: any = {};
      
      if (updates.supplierName !== undefined) updateData.supplier_name = updates.supplierName;
      if (updates.details !== undefined) updateData.details = updates.details;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.date !== undefined) updateData.date = updates.date.toISOString().split('T')[0];

      const { error } = await supabase
        .from('carriage_inwards')
        .update(updateData)
        .eq('id', id)
        .eq('location_id', currentBusiness.id);

      if (error) throw error;

      await loadCarriageInwards();
      
      toast({
        title: "Success",
        description: "Carriage inwards record updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating carriage inwards:', error);
      toast({
        title: "Error",
        description: "Failed to update carriage inwards record. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCarriageInward = async (id: string) => {
    try {
      if (!currentBusiness) throw new Error('No business selected');

      // Get the record to check if it has an associated cash transaction
      const { data: record, error: fetchError } = await supabase
        .from('carriage_inwards')
        .select('cash_transaction_id')
        .eq('id', id)
        .eq('location_id', currentBusiness.id)
        .single();

      if (fetchError) throw fetchError;

      // Delete associated cash transaction if exists
      if (record.cash_transaction_id) {
        const { error: cashError } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('id', record.cash_transaction_id)
          .eq('location_id', currentBusiness.id);

        if (cashError) throw cashError;
      }

      // Delete the carriage inwards record
      const { error } = await supabase
        .from('carriage_inwards')
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness.id);

      if (error) throw error;

      await loadCarriageInwards();
      
      toast({
        title: "Success",
        description: "Carriage inwards record deleted successfully"
      });

      return true;
    } catch (error) {
      console.error('Error deleting carriage inwards:', error);
      toast({
        title: "Error",
        description: "Failed to delete carriage inwards record. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    loadCarriageInwards();
  }, [loadCarriageInwards]);

  return {
    carriageInwards,
    isLoading,
    createCarriageInward,
    updateCarriageInward,
    deleteCarriageInward,
    refreshCarriageInwards: loadCarriageInwards
  };
};
