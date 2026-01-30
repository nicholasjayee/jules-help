import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalesCategory } from '@/types';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';

export const useSalesCategories = () => {
  const [categories, setCategories] = useState<SalesCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();

  const fetchCategories = async () => {
    if (!currentBusiness) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sales_categories')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching sales categories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [currentBusiness]);

  const createCategory = async (name: string) => {
    if (!currentBusiness || !user) {
      toast({
        title: "Error",
        description: "No business selected or user not authenticated",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('sales_categories')
        .insert({
          name,
          user_id: user.id,
          location_id: currentBusiness.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales category created successfully",
      });

      fetchCategories();
      return true;
    } catch (error) {
      console.error('Error creating sales category:', error);
      toast({
        title: "Error",
        description: "Failed to create sales category",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCategory = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('sales_categories')
        .update({ name })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales category updated successfully",
      });

      fetchCategories();
      return true;
    } catch (error) {
      console.error('Error updating sales category:', error);
      toast({
        title: "Error",
        description: "Failed to update sales category",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sales_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales category deleted successfully",
      });

      fetchCategories();
      return true;
    } catch (error) {
      console.error('Error deleting sales category:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales category",
        variant: "destructive",
      });
      return false;
    }
  };

  const createDefaultCategories = async () => {
    if (!currentBusiness || !user) return;

    const defaultCategories = [
      { name: 'Retail', is_default: true },
      { name: 'Online', is_default: true },
      { name: 'Wholesale', is_default: true },
    ];

    try {
      const { error } = await supabase
        .from('sales_categories')
        .insert(
          defaultCategories.map(category => ({
            ...category,
            user_id: user.id,
            location_id: currentBusiness.id,
          }))
        );

      if (error) throw error;
      fetchCategories();
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  };

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    createDefaultCategories,
    refetch: fetchCategories,
  };
};