"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductFormData, ProductFilters } from '@/types';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts, addProduct, updateProductInDb, deleteProductFromDb } from '@/lib/dummyData';

export const useProducts = (userId: string | undefined, initialPageSize: number = 50) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  // Filters state
  const [filters, setFiltersState] = useState<ProductFilters>({
    search: '',
    category: '',
    stockStatus: 'all'
  });

  // Derived filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(searchTerm) ||
          (product.description && product.description.toLowerCase().includes(searchTerm)) ||
          product.category.toLowerCase().includes(searchTerm) ||
          (product.supplier && product.supplier.toLowerCase().includes(searchTerm)) ||
          product.itemNumber.toLowerCase().includes(searchTerm);

        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      // Stock status filter
      if (filters.stockStatus === 'outOfStock' && product.quantity > 0) return false;
      if (filters.stockStatus === 'inStock' && product.quantity <= 0) return false;
      if (filters.stockStatus === 'lowStock' && (product.quantity <= 0 || product.quantity > product.minimumStock)) return false;

      return true;
    });
  }, [products, filters]);

  // Debounce typing logic
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);

  const setFilters = useCallback((newFilters: ProductFilters) => {
    if (newFilters.search !== filters.search) {
      setIsTyping(true);
      if (typingTimer) clearTimeout(typingTimer);
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 600);
      setTypingTimer(timer);
    }
    setFiltersState(newFilters);
  }, [filters.search, typingTimer]);


  const loadProducts = useCallback(async (): Promise<{ products: Product[], count: number }> => {
    if (!userId || !currentBusiness) {
      return { products: [], count: 0 };
    }
    const allProducts = await getProducts();
    return { products: allProducts, count: allProducts.length };
  }, [userId, currentBusiness?.id]);

  const queryKey = useMemo(() => ['products', userId, currentBusiness?.id], [userId, currentBusiness?.id]);

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
    return URL.createObjectURL(imageFile); // Mock image upload
  };

  const createProduct = async (productData: ProductFormData): Promise<Product | null> => {
    try {
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
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await addProduct(newProduct);
        setProducts(prev => [newProduct, ...prev]);
        setTotalCount(c => c + 1);
        queryClient.invalidateQueries({ queryKey });
        return newProduct;
    } catch (e) {
        console.error(e);
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
      let imageUrl = updates.imageUrl;
      if (imageFile) {
          imageUrl = URL.createObjectURL(imageFile);
      }
      const finalUpdates = { ...updates, imageUrl: imageUrl || null };

      await updateProductInDb(id, finalUpdates);

      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...finalUpdates } : p));
      queryClient.invalidateQueries({ queryKey });
      return true;
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
      await deleteProductFromDb(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      queryClient.invalidateQueries({ queryKey });
      return true;
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
    setFilters,
    filteredProducts
  };
};
