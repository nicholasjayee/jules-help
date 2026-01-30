
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BusinessLocation {
  id: string;
  name: string;
  userId: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBusinessLocation {
  id: string;
  name: string;
  user_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const mapDbBusinessLocationToBusinessLocation = (dbBusiness: DbBusinessLocation): BusinessLocation => {
  return {
    id: dbBusiness.id,
    name: dbBusiness.name,
    userId: dbBusiness.user_id,
    isDefault: dbBusiness.is_default,
    createdAt: new Date(dbBusiness.created_at),
    updatedAt: new Date(dbBusiness.updated_at)
  };
};

export const useBusiness = (userId: string | undefined) => {
  const [businesses, setBusinesses] = useState<BusinessLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadBusinesses = async () => {
    if (!userId) {
      setBusinesses([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('business_locations')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const formattedBusinesses = data ? data.map(mapDbBusinessLocationToBusinessLocation) : [];
      setBusinesses(formattedBusinesses);
    } catch (error) {
      console.error('Error loading businesses:', error);
      toast({
        title: "Error",
        description: "Failed to load business locations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [userId]);

  const createBusiness = async (name: string, setAsDefault: boolean = false): Promise<BusinessLocation | null> => {
    try {
      if (!userId) return null;

      // If setting as default, first remove default from all existing businesses
      if (setAsDefault) {
        await supabase
          .from('business_locations')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('business_locations')
        .insert({
          user_id: userId,
          name: name,
          is_default: setAsDefault
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const newBusiness = mapDbBusinessLocationToBusinessLocation(data);
      await loadBusinesses(); // Reload to get updated list
      
      toast({
        title: "Success",
        description: `Business location "${name}" created successfully.`
      });

      return newBusiness;
    } catch (error) {
      console.error('Error creating business:', error);
      toast({
        title: "Error",
        description: "Failed to create business location. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateBusiness = async (id: string, name: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      const { error } = await supabase
        .from('business_locations')
        .update({ name })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      await loadBusinesses();
      
      toast({
        title: "Success",
        description: "Business location updated successfully."
      });

      return true;
    } catch (error) {
      console.error('Error updating business:', error);
      toast({
        title: "Error",
        description: "Failed to update business location. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteBusiness = async (id: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      // Check if this is the default business
      const businessToDelete = businesses.find(b => b.id === id);
      if (!businessToDelete) {
        toast({
          title: "Error",
          description: "Business location not found.",
          variant: "destructive"
        });
        return false;
      }

      if (businessToDelete.isDefault) {
        toast({
          title: "Cannot Delete",
          description: "Cannot delete the default business location. Please set another location as default first.",
          variant: "destructive"
        });
        return false;
      }

      // With CASCADE constraints, deleting the business will automatically clean up all associated data
      const { error } = await supabase
        .from('business_locations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      await loadBusinesses();
      
      toast({
        title: "Success",
        description: `Business location "${businessToDelete.name}" and all associated data have been deleted successfully.`
      });

      return true;
    } catch (error) {
      console.error('Error deleting business:', error);
      toast({
        title: "Error",
        description: "Failed to delete business location. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const setDefaultBusiness = async (id: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      // First, remove default from all businesses
      await supabase
        .from('business_locations')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Then set the selected business as default
      const { error } = await supabase
        .from('business_locations')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      await loadBusinesses();
      
      const business = businesses.find(b => b.id === id);
      toast({
        title: "Success",
        description: `"${business?.name}" is now the default business location.`
      });

      return true;
    } catch (error) {
      console.error('Error setting default business:', error);
      toast({
        title: "Error",
        description: "Failed to set default business location. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    businesses,
    isLoading,
    loadBusinesses,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    setDefaultBusiness
  };
};
