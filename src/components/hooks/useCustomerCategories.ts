
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';

export interface CustomerCategory {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const useCustomerCategories = () => {
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();

  const loadCategories = async () => {
    if (!currentBusiness) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customer_categories')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('name');

      if (error) throw error;

      const formattedCategories: CustomerCategory[] = data?.map(category => ({
        id: category.id,
        name: category.name,
        isDefault: category.is_default,
        createdAt: new Date(category.created_at),
        updatedAt: new Date(category.updated_at)
      })) || [];

      setCategories(formattedCategories);
    } catch (error) {
      console.error('Error loading customer categories:', error);
      toast({
        title: "Error",
        description: "Failed to load customer categories. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCategory = async (name: string) => {
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('customer_categories')
        .insert({
          user_id: userData.user.id,
          location_id: currentBusiness.id,
          name: name.trim(),
          is_default: false
        })
        .select()
        .single();

      if (error) throw error;

      await loadCategories();
      
      toast({
        title: "Success",
        description: "Customer category created successfully"
      });

      return data;
    } catch (error) {
      console.error('Error creating customer category:', error);
      toast({
        title: "Error",
        description: "Failed to create customer category. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateCategory = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('customer_categories')
        .update({ name: name.trim() })
        .eq('id', id);

      if (error) throw error;

      await loadCategories();
      
      toast({
        title: "Success",
        description: "Customer category updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating customer category:', error);
      toast({
        title: "Error",
        description: "Failed to update customer category. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customer_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadCategories();
      
      toast({
        title: "Success",
        description: "Customer category deleted successfully"
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting customer category:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer category. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    loadCategories();
  }, [currentBusiness?.id]);

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    loadCategories
  };
};
