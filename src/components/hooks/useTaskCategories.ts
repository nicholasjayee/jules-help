
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TaskCategory } from '@/types/task';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export const useTaskCategories = () => {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();

  const loadCategories = async () => {
    if (!user?.id || !currentBusiness?.id) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('location_id', currentBusiness.id)
        .order('name');

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('Error loading task categories:', error);
      toast.error('Failed to load task categories');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createCategory = async (name: string): Promise<TaskCategory | null> => {
    if (!user?.id || !currentBusiness?.id) return null;

    try {
      const { data, error } = await supabase
        .from('task_categories')
        .insert({
          user_id: user.id,
          location_id: currentBusiness.id,
          name: name.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data]);
      toast.success('Category created successfully');
      return data;
    } catch (error) {
      console.error('Error creating task category:', error);
      toast.error('Failed to create category');
      return null;
    }
  };

  const updateCategory = async (id: string, name: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('task_categories')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCategories(prev =>
        prev.map(cat => (cat.id === id ? { ...cat, name: name.trim() } : cat))
      );
      toast.success('Category updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating task category:', error);
      toast.error('Failed to update category');
      return false;
    }
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('task_categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast.success('Category deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting task category:', error);
      toast.error('Failed to delete category');
      return false;
    }
  };

  const createDefaultCategories = async () => {
    if (!user?.id || !currentBusiness?.id) return;

    const defaultCategories = ['General', 'Marketing', 'Operations', 'Finance', 'Follow-up'];
    
    try {
      const categoriesToCreate = defaultCategories.map(name => ({
        user_id: user.id,
        location_id: currentBusiness.id,
        name,
      }));

      const { data, error } = await supabase
        .from('task_categories')
        .insert(categoriesToCreate)
        .select();

      if (error) throw error;

      if (data) {
        setCategories(prev => [...prev, ...data]);
      }
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [user?.id, currentBusiness?.id]);

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    createDefaultCategories,
    refreshCategories: loadCategories,
  };
};
