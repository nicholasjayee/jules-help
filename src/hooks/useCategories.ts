
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductCategory, DbProductCategory, mapDbProductCategoryToProductCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';

export const useCategories = (userId: string | undefined) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();

  const loadCategories = async () => {
    try {
      if (!userId || !currentBusiness) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('name');

      if (error) {
        throw error;
      }

      const formattedCategories: ProductCategory[] = data ? 
        data.map((item: DbProductCategory) => mapDbProductCategoryToProductCategory(item)) : [];
      
      setCategories(formattedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Error",
        description: "Failed to load product categories. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [userId, currentBusiness?.id]);

  const createCategory = async (name: string) => {
    try {
      if (!userId || !currentBusiness) return null;

      // Check if category already exists
      const existingCategory = categories.find(
        cat => cat.name.toLowerCase() === name.toLowerCase()
      );
      
      if (existingCategory) {
        toast({
          title: "Category exists",
          description: "This category already exists.",
          variant: "default"
        });
        return existingCategory;
      }

      const { data, error } = await supabase
        .from('product_categories')
        .insert({
          user_id: userId,
          location_id: currentBusiness.id,
          name
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newCategory = mapDbProductCategoryToProductCategory(data as DbProductCategory);
        setCategories([...categories, newCategory]);
        return newCategory;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateCategory = async (id: string, name: string) => {
    try {
      if (!userId) return false;

      // Check if category already exists
      const existingCategory = categories.find(
        cat => cat.name.toLowerCase() === name.toLowerCase() && cat.id !== id
      );
      
      if (existingCategory) {
        toast({
          title: "Category exists",
          description: "Another category with this name already exists.",
          variant: "default"
        });
        return false;
      }

      const { data, error } = await supabase
        .from('product_categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedCategory = mapDbProductCategoryToProductCategory(data as DbProductCategory);
        setCategories(categories.map(c => c.id === id ? updatedCategory : c));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      if (!userId) return false;

      // First check if there are any products using this category
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category', categories.find(c => c.id === id)?.name || '');
      
      if (productsError) throw productsError;
      
      if (products && products.length > 0) {
        toast({
          title: "Cannot delete category",
          description: "This category is being used by one or more products.",
          variant: "destructive"
        });
        return false;
      }

      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(categories.filter(c => c.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  return { 
    categories, 
    isLoading, 
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
};
