
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';

export interface ExpenseCategory {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

const DEFAULT_CATEGORIES = [
  'Rent & Utilities',
  'Salaries & Wages',
  'Marketing & Advertising',
  'Office Supplies & Equipment',
  'Professional Services',
  'Cost of bringing Goods',
  'Delivery To Customer',
  'Insurance',
  'Licenses, Permits & Fees',
  'Software & Subscriptions',
  'Depreciation & Amortization',
  'Training & Development',
  'Communication',
  'Bank & Transaction Fees',
  'Miscellaneous'
];

export const useExpenseCategories = () => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
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
        .from('expense_categories')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      const formattedCategories: ExpenseCategory[] = data?.map(category => ({
        id: category.id,
        name: category.name,
        isDefault: category.is_default,
        createdAt: new Date(category.created_at)
      })) || [];

      // Remove duplicates based on name (case-insensitive)
      const uniqueCategories = formattedCategories.filter((category, index, self) =>
        index === self.findIndex(c => c.name.toLowerCase() === category.name.toLowerCase())
      );

      // If no categories exist, create default ones
      if (uniqueCategories.length === 0) {
        await createDefaultCategories();
        return;
      }

      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading expense categories:', error);
      toast({
        title: "Error",
        description: "Failed to load expense categories. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultCategories = async () => {
    if (!currentBusiness) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Check if any default categories already exist for this location
      const { data: existingCategories } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('location_id', currentBusiness.id)
        .eq('is_default', true);

      const existingNames = new Set(existingCategories?.map(cat => cat.name.toLowerCase()) || []);

      // Only create categories that don't already exist
      const categoriesToCreate = DEFAULT_CATEGORIES.filter(
        name => !existingNames.has(name.toLowerCase())
      );

      if (categoriesToCreate.length === 0) {
        // If all default categories already exist, just reload
        await loadCategories();
        return;
      }

      const defaultCategoriesData = categoriesToCreate.map(name => ({
        user_id: userData.user.id,
        location_id: currentBusiness.id,
        name,
        is_default: true
      }));

      const { data, error } = await supabase
        .from('expense_categories')
        .insert(defaultCategoriesData)
        .select();

      if (error) throw error;

      const newCategories: ExpenseCategory[] = data?.map(category => ({
        id: category.id,
        name: category.name,
        isDefault: category.is_default,
        createdAt: new Date(category.created_at)
      })) || [];

      // Combine with existing categories and remove duplicates
      const allCategories = [...(existingCategories?.map(cat => ({
        id: cat.id,
        name: cat.name,
        isDefault: true,
        createdAt: new Date()
      })) || []), ...newCategories];

      const uniqueCategories = allCategories.filter((category, index, self) =>
        index === self.findIndex(c => c.name.toLowerCase() === category.name.toLowerCase())
      );

      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error creating default categories:', error);
      toast({
        title: "Error",
        description: "Failed to create default categories. Please try again.",
        variant: "destructive"
      });
    }
  };

  const createCategory = async (name: string) => {
    if (!currentBusiness) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Check if category already exists (case-insensitive)
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
        .from('expense_categories')
        .insert({
          user_id: userData.user.id,
          location_id: currentBusiness.id,
          name,
          is_default: false
        })
        .select()
        .single();

      if (error) throw error;

      const newCategory: ExpenseCategory = {
        id: data.id,
        name: data.name,
        isDefault: data.is_default,
        createdAt: new Date(data.created_at)
      };

      setCategories([...categories, newCategory]);
      return newCategory;
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

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expense_categories')
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

  useEffect(() => {
    loadCategories();
  }, [currentBusiness?.id]);

  return {
    categories,
    isLoading,
    createCategory,
    deleteCategory,
    refreshCategories: loadCategories
  };
};
