import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Requisition {
  id: string;
  userId: string;
  locationId: string;
  requisitionNumber: string;
  title: string;
  items: RequisitionItem[];
  notes: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisitionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  urgentItem?: boolean;
}

export interface DbRequisition {
  id: string;
  user_id: string;
  location_id: string;
  requisition_number: string;
  title: string;
  items: any;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const mapDbRequisitionToRequisition = (dbRequisition: DbRequisition): Requisition => {
  return {
    id: dbRequisition.id,
    userId: dbRequisition.user_id,
    locationId: dbRequisition.location_id,
    requisitionNumber: dbRequisition.requisition_number,
    title: dbRequisition.title,
    items: dbRequisition.items as RequisitionItem[],
    notes: dbRequisition.notes,
    status: dbRequisition.status as 'draft' | 'submitted' | 'approved' | 'completed',
    createdAt: new Date(dbRequisition.created_at),
    updatedAt: new Date(dbRequisition.updated_at)
  };
};

export const useRequisitions = (userId: string | undefined, locationId: string | undefined) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadRequisitions = async () => {
    if (!userId || !locationId) {
      setRequisitions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('requisitions')
        .select('*')
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedRequisitions = data ? data.map(mapDbRequisitionToRequisition) : [];
      setRequisitions(formattedRequisitions);
    } catch (error) {
      console.error('Error loading requisitions:', error);
      toast({
        title: "Error",
        description: "Failed to load requisitions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequisitions();
  }, [userId, locationId]);

  const createRequisition = async (
    title: string,
    items: RequisitionItem[],
    notes?: string
  ): Promise<Requisition | null> => {
    if (!userId || !locationId) return null;

    try {
      const requisitionNumber = generateRequisitionNumber();

      const { data, error } = await supabase
        .from('requisitions')
        .insert({
          user_id: userId,
          location_id: locationId,
          requisition_number: requisitionNumber,
          title: title,
          items: items as any,
          notes: notes || null,
          status: 'draft'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const newRequisition = mapDbRequisitionToRequisition(data);
      setRequisitions(prev => [newRequisition, ...prev]);
      
      toast({
        title: "Requisition created",
        description: `Requisition ${requisitionNumber} has been created successfully.`
      });

      return newRequisition;
    } catch (error) {
      console.error('Error creating requisition:', error);
      toast({
        title: "Error",
        description: "Failed to create requisition. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateRequisition = async (
    id: string,
    updates: Partial<{
      title: string;
      items: RequisitionItem[];
      notes: string;
      status: 'draft' | 'submitted' | 'approved' | 'completed';
    }>
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase
        .from('requisitions')
        .update({
          ...updates,
          items: updates.items as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const updatedRequisition = mapDbRequisitionToRequisition(data);
      setRequisitions(prev => prev.map(req => req.id === id ? updatedRequisition : req));
      
      toast({
        title: "Requisition updated",
        description: "Requisition has been updated successfully."
      });

      return true;
    } catch (error) {
      console.error('Error updating requisition:', error);
      toast({
        title: "Error",
        description: "Failed to update requisition. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteRequisition = async (id: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('requisitions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      setRequisitions(prev => prev.filter(req => req.id !== id));
      
      toast({
        title: "Requisition deleted",
        description: "Requisition has been deleted successfully."
      });

      return true;
    } catch (error) {
      console.error('Error deleting requisition:', error);
      toast({
        title: "Error",
        description: "Failed to delete requisition. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    requisitions,
    isLoading,
    loadRequisitions,
    createRequisition,
    updateRequisition,
    deleteRequisition
  };
};

const generateRequisitionNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const time = date.getTime().toString().slice(-4);
  return `REQ${year}${month}${day}${time}`;
};