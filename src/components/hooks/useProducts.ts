
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductFormData, ProductFilters } from '@/components/types/index';
import { useBusinessSettings } from './useBusinessSettings';
import { useStockHistory } from './useStockHistory';
import { useProductFilters } from './useProductFilters';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataStore } from '@/lib/dataStore';

export const useProducts = (userId: string | undefined, initialPageSize: number = 50) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const { settings } = useBusinessSettings();
  const { createStockHistoryEntry } = useStockHistory(userId);
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const { filters, setFilters, filteredProducts } = useProductFilters(products);
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);

  const setFiltersWithTypingState = useCallback((newFilters: ProductFilters) => {
    if (newFilters.search !== filters.search) {
      setIsTyping(true);
      if (typingTimer) clearTimeout(typingTimer);
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 600);
      setTypingTimer(timer);
    }
    setFilters(newFilters);
  }, [filters.search, typingTimer, setFilters]);

  const loadProducts = useCallback(async (): Promise<{ products: Product[], count: number }> => {
    if (!userId || !currentBusiness) {
      return { products: [], count: 0 };
    }

    try {
      const allProducts = await dataStore.getProducts(userId, currentBusiness.id);

      // We can do filtering here if we want to mimic DB filtering,
      // but strictly speaking the `filteredProducts` from useProductFilters handles client side filtering.
      // However, the original code did filtering at DB level.
      // For dummy data, client side filtering is fine.

      return { products: allProducts, count: allProducts.length };
    } catch (error) {
      console.error('Error loading products:', error);
      return { products: [], count: 0 };
    }
  }, [userId, currentBusiness?.id]);

  const baseQueryKey = useMemo(() => ['products', userId, currentBusiness?.id], [userId, currentBusiness?.id]);
  const queryKey = useMemo(() => [...baseQueryKey, page, pageSize], [baseQueryKey, page, pageSize]);

  const { data: queriedData, isLoading: isQueryLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: loadProducts,
    enabled: !!userId && !!currentBusiness?.id,
  });

  useEffect(() => {
    if (queriedData) {
      setProducts(queriedData.products);
      setTotalCount(queriedData.count);
    }
  }, [queriedData]);

  const isLoading = (isQueryLoading && !queriedData) && !isTyping;

  const uploadProductImage = async (imageFile: File): Promise<string | null> => {
    // Stub
    return URL.createObjectURL(imageFile);
  };

  const createProduct = async (productData: ProductFormData): Promise<Product | null> => {
    try {
      if (!userId || !currentBusiness) return null;

      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        itemNumber: `ITM-${Date.now()}`,
        name: productData.name,
        description: productData.description || null,
        category: productData.category || 'Uncategorized',
        quantity: productData.quantity || 0,
        costPrice: productData.costPrice || 0,
        sellingPrice: productData.sellingPrice || 0,
        supplier: productData.supplier || null,
        imageUrl: productData.imageUrl || null,
        minimumStock: productData.minimumStock || 0,
        createdAt: productData.createdAt || new Date(),
        updatedAt: new Date()
      };

      await dataStore.createProduct(newProduct);

      setProducts(prev => [newProduct, ...prev]);
      setTotalCount(c => c + 1);

      queryClient.invalidateQueries({ queryKey: baseQueryKey });

      return newProduct;
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    }
  };

  const updateProduct = async (
    id: string,
    updates: Partial<Product>,
    imageFile?: File | null,
    isFromSale = false,
    customChangeReason?: string,
    adjustmentDate?: Date,
    referenceId?: string,
    receiptNumber?: string
  ): Promise<boolean> => {
    try {
        let imageUrl = updates.imageUrl;
        if (imageFile) {
            imageUrl = URL.createObjectURL(imageFile);
        }

        const updatedData = { ...updates, imageUrl };
        if (imageUrl === undefined) delete updatedData.imageUrl;

        const result = await dataStore.updateProduct(id, updatedData);
        if (!result) return false;

        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
        queryClient.invalidateQueries({ queryKey: baseQueryKey });

        return true;
    } catch (error) {
        console.error('Error updating product:', error);
        return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
        await dataStore.deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        queryClient.invalidateQueries({ queryKey: baseQueryKey });
        return true;
    } catch (error) {
        console.error('Error deleting product:', error);
        return false;
    }
  };

  const updateProductsBulk = async (
    updates: Array<{ id: string; updated: Partial<Product>; imageFile?: File | null }>,
    userIdForHistory?: string,
    changeReason?: string,
    referenceId?: string,
    adjustmentDate?: Date,
    receiptNumber?: string
  ): Promise<boolean> => {
      for (const update of updates) {
          await updateProduct(update.id, update.updated, update.imageFile);
      }
      return true;
  };

  return {
    products,
    isLoading,
    loadProducts,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    createProduct,
    updateProduct,
    updateProductsBulk,
    deleteProduct,
    uploadProductImage,
    refetch,
    isFetching,
    filters,
    setFilters: setFiltersWithTypingState,
    filteredProducts
  };
};
