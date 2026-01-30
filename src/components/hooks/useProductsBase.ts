
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, DbProduct, mapDbProductToProduct } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';

/**
 * Base hook for fetching and storing products
 */
export const useProductsBase = (userId: string | undefined) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();

  const loadProducts = async () => {
    try {
      if (!userId || !currentBusiness) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('location_id', currentBusiness.id)
        .order('created_at', { ascending: false }); // Changed to show newest first

      if (error) {
        throw error;
      }

      // Convert from DB format to frontend format
      const formattedProducts: Product[] = data ? 
        data.map((item: any) => mapDbProductToProduct(item as DbProduct)) : [];
      
      setProducts(formattedProducts);
      return formattedProducts;
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [userId, currentBusiness?.id]);

  return {
    products,
    isLoading,
    setProducts,
    loadProducts
  };
};
