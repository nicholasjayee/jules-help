"use client";
import { useState, useEffect } from 'react';
import { ProductCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { getCategories } from '@/lib/dummyData';

export const useCategories = (userId: string | undefined) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();

  const loadCategories = async () => {
    try {
      if (!userId || !currentBusiness) return;
      
      setIsLoading(true);
      const data = await getCategories();
      setCategories(data);
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
      // Mock creation
      const newCategory: ProductCategory = { id: `cat-${Date.now()}`, name };
      setCategories([...categories, newCategory]);
      return newCategory;
  };

  const updateCategory = async (id: string, name: string) => {
      // Mock update
      setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
      return true;
  };

  const deleteCategory = async (id: string) => {
      // Mock delete
      setCategories(categories.filter(c => c.id !== id));
      return true;
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
