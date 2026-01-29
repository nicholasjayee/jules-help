
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductFormData, mapDbProductToProduct, mapProductToDbProduct, ProductFilters } from '@/types';
import { useBusinessSettings } from './useBusinessSettings';
import { useStockHistory } from './useStockHistory';
import { useProductFilters } from './useProductFilters';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clearInventoryCaches } from '@/utils/inventoryCacheUtils';

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

  // Add filtering functionality back
  const { filters, setFilters, filteredProducts } = useProductFilters(products);

  // Track when user is typing (before debounce completes)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);

  const setFiltersWithTypingState = useCallback((newFilters: ProductFilters) => {
    // If search changed, mark as typing
    if (newFilters.search !== filters.search) {
      setIsTyping(true);

      // Clear existing timer
      if (typingTimer) clearTimeout(typingTimer);

      // Set new timer to clear typing state after debounce
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 600); // Slightly longer than debounce to ensure query completes

      setTypingTimer(timer);
    }

    setFilters(newFilters);
  }, [filters.search, typingTimer, setFilters]);

  const loadProducts = useCallback(async (): Promise<{ products: Product[], count: number }> => {
    if (!userId || !currentBusiness) {
      return { products: [], count: 0 };
    }

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products' as any)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('location_id', currentBusiness.id);

      // Apply search filter at database level
      if (filters.search) {
        const searchTerm = filters.search;
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,supplier.ilike.%${searchTerm}%,item_number.ilike.%${searchTerm}%`);
      }

      // Apply category filter at database level
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      // Apply stock status filter at database level
      if (filters.stockStatus === 'outOfStock') {
        query = query.eq('quantity', 0);
      } else if (filters.stockStatus === 'lowStock') {
        // For low stock, we need to filter where quantity > 0 AND quantity <= minimum_stock
        // Supabase doesn't support column comparisons directly, so we'll handle this client-side
      } else if (filters.stockStatus === 'inStock') {
        query = query.gt('quantity', 0);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })  // Add secondary sort for stable pagination
        .range(from, to);

      if (error) {
        throw error;
      }

      if (data) {
        let formattedProducts = (data as any[]).map(mapDbProductToProduct);

        // Apply low stock filter client-side (can't do column comparison in Supabase easily)
        if (filters.stockStatus === 'lowStock') {
          formattedProducts = formattedProducts.filter(p => p.quantity > 0 && p.quantity <= p.minimumStock);
        }

        return { products: formattedProducts, count: count || 0 };
      }
      return { products: [], count: 0 };
    } catch (error) {
      console.error('Error loading products:', error);
      return { products: [], count: 0 };
    }
  }, [userId, currentBusiness?.id, page, pageSize, filters.search, filters.category, filters.stockStatus]);

  // React Query caching
  // React Query caching - using a base key for broad invalidation
  const baseQueryKey = useMemo(() => ['products', userId, currentBusiness?.id], [userId, currentBusiness?.id]);
  const queryKey = useMemo(() => [...baseQueryKey, page, pageSize, filters.search, filters.category, filters.stockStatus], [baseQueryKey, page, pageSize, filters.search, filters.category, filters.stockStatus]);
  const { data: queriedData, isLoading: isQueryLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: loadProducts,
    enabled: !!userId && !!currentBusiness?.id,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (queriedData) {
      setProducts(queriedData.products);
      setTotalCount(queriedData.count);
    }
  }, [queriedData]);

  // Derived loading state - only for initial load or new query keys
  const isLoading = (isQueryLoading && !queriedData) && !isTyping;

  // Add image upload functionality back
  const uploadProductImage = async (imageFile: File): Promise<string | null> => {
    try {
      if (!userId) return null;

      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile, { upsert: true });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadProductImage:', error);
      return null;
    }
  };

  const createProduct = async (productData: ProductFormData): Promise<Product | null> => {
    try {
      if (!userId || !currentBusiness) return null;

      // Get the next item number for the current business location
      const { data: itemNumberData, error: itemNumberError } = await (supabase as any)
        .rpc('get_next_item_number', { location_uuid: currentBusiness.id });

      if (itemNumberError) {
        console.error('Error generating item number:', itemNumberError);
        return null;
      }

      const itemNumber = itemNumberData;

      // Create dbProduct with all required fields properly set
      const dbProduct = {
        user_id: userId,
        location_id: currentBusiness.id,
        item_number: itemNumber,
        name: productData.name, // Ensure name is required
        description: productData.description || null,
        category: productData.category || 'Uncategorized',
        quantity: productData.quantity || 0,
        cost_price: productData.costPrice || 0,
        selling_price: productData.sellingPrice || 0,
        supplier: productData.supplier || null,
        image_url: productData.imageUrl || null,
        minimum_stock: productData.minimumStock || 0,
        created_at: productData.createdAt?.toISOString() || new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('products')
        .insert(dbProduct)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const newProduct = mapDbProductToProduct(data);

      // Create initial stock history entry if quantity > 0
      if (newProduct.quantity > 0) {
        await createStockHistoryEntry(
          newProduct.id,
          0,
          newProduct.quantity,
          'Initial stock',
          undefined,
          productData.createdAt,
          undefined,
          newProduct.name
        );
        // Only pass date if explicitly provided, otherwise let DB use now()
      }

      // Update local state immediately
      setProducts(prev => [newProduct, ...prev]);
      setTotalCount(c => c + 1);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return { products: [newProduct], count: 1 };
        return {
          products: [newProduct, ...oldData.products],
          count: (oldData.count || 0) + 1
        };
      });

      // Clear all inventory-related caches
      clearInventoryCaches(queryClient);

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
      if (!userId) return false;

      let currentProduct = products.find(p => p.id === id);

      // If not in local state, fetch from DB
      if (!currentProduct) {
        console.log(`DEBUG: Product ${id} not in local state, fetching from DB...`);
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !data) {
          console.error(`DEBUG: Failed to fetch product ${id} from DB:`, fetchError);
          return false;
        }
        currentProduct = mapDbProductToProduct(data as any);
      }
      if (!currentProduct) return false;

      let imageUrl = updates.imageUrl;

      // Handle image upload if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${id}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          return false;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const updatedData = { ...updates, imageUrl };
      console.log(`DEBUG: Raw updates for product ${id}:`, updatedData);

      const dbUpdates = mapProductToDbProduct(updatedData, userId);
      console.log(`DEBUG: DB updates for product ${id}:`, dbUpdates);

      const { error } = await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', id)
        .eq('location_id', currentBusiness?.id);

      if (error) {
        console.error(`DEBUG: Database error for product ${id}:`, error);
        throw error;
      }

      // Update local state immediately
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          products: oldData.products.map((p: Product) =>
            p.id === id ? { ...p, ...updatedData } : p
          )
        };
      });

      // Create stock history entry if quantity changed and not skipping history
      if (updates.quantity !== undefined &&
        updates.quantity !== currentProduct.quantity &&
        customChangeReason !== 'skip-history') {

        let changeReason = 'Manual stock adjustment';

        // Use custom reason if provided, otherwise determine based on context
        if (customChangeReason) {
          changeReason = customChangeReason;
        } else if (isFromSale) {
          changeReason = 'Sale';
        } else if (updates.quantity > currentProduct.quantity) {
          changeReason = 'Manual stock addition';
        } else {
          changeReason = 'Manual stock reduction';
        }

        await createStockHistoryEntry(
          id,
          currentProduct.quantity,
          updates.quantity,
          changeReason,
          referenceId,
          adjustmentDate,
          receiptNumber,
          currentProduct.name
        );
      }

      queryClient.invalidateQueries({ queryKey: baseQueryKey });
      clearInventoryCaches(queryClient);
      return true;
    } catch (error) {
      console.error('Error updating product:', error);
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      if (!userId) return false;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('location_id', currentBusiness?.id);

      if (error) {
        throw error;
      }
      // Optimistic update: remove from local state
      setProducts(prev => prev.filter(p => p.id !== id));
      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const { products: oldProducts, count } = old;
        const newProducts = (oldProducts as Product[]).filter(p => p.id !== id);
        return { products: newProducts, count: Math.max(0, (count || 0) - 1) };
      });
      queryClient.invalidateQueries({ queryKey: baseQueryKey });
      clearInventoryCaches(queryClient);
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  };

  // Realtime: invalidate products cache on changes for current location
  useEffect(() => {
    if (!userId || !currentBusiness?.id) return;

    const channel = supabase
      .channel('products_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `location_id=eq.${currentBusiness.id}`
      }, () => {
        console.log('[Realtime] Product change detected, invalidating cache...');
        queryClient.invalidateQueries({ queryKey: baseQueryKey });
        // Clear all inventory-related caches on remote changes
        clearInventoryCaches(queryClient);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentBusiness?.id, baseQueryKey]);

  // Bulk update products for performance-critical operations (e.g., sales)
  const updateProductsBulk = async (
    updates: Array<{ id: string; updated: Partial<Product>; imageFile?: File | null }>,
    userIdForHistory?: string,
    changeReason?: string,
    referenceId?: string,
    adjustmentDate?: Date,
    receiptNumber?: string
  ): Promise<boolean> => {
    console.log('🔥 updateProductsBulk CALLED', {
      updateCount: updates.length,
      productIds: updates.map(u => u.id),
      reason: changeReason,
      refId: referenceId,
      receipt: receiptNumber,
      adjustmentDate: adjustmentDate?.toISOString(),
      stack: new Error().stack
    });

    try {
      // Fetch OLD quantities and names from DB BEFORE any updates to avoid using stale in-memory state
      const productIds = updates.map(u => u.id);
      const { data: dbProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, quantity, name')
        .in('id', productIds)
        .eq('location_id', currentBusiness?.id);
      if (fetchError) throw fetchError;
      if (!dbProducts) return false;

      // Capture old quantities and names BEFORE updates
      const oldQuantities = new Map<string, number>();
      const productNames = new Map<string, string>();
      for (const dbProduct of dbProducts) {
        if (dbProduct.quantity !== undefined) {
          oldQuantities.set(dbProduct.id, dbProduct.quantity);
        }
        if (dbProduct.name) {
          productNames.set(dbProduct.id, dbProduct.name);
        }
      }

      // Prepare upsert payloads
      const upsertPayload = [] as any[];
      for (const { id, updated } of updates) {
        // Find in local products first for performance
        let baseProduct = products.find(p => p.id === id);

        // If not found locally, use the data we just fetched from DB
        if (!baseProduct) {
          const dbData = dbProducts.find(p => p.id === id);
          if (dbData) {
            // We need a partial "Product" to pass to mapProductToDbProduct
            // dbData is a Row from Supabase, so we map it first
            baseProduct = mapDbProductToProduct(dbData as any);
          }
        }

        if (!baseProduct) {
          console.warn(`⚠️ updateProductsBulk: Product ${id} not found in local state or DB fetch result. Skipping.`);
          continue;
        }

        const dbUpdates = mapProductToDbProduct({ ...baseProduct, ...updated }, userId);
        upsertPayload.push({ id, ...dbUpdates });
      }

      if (upsertPayload.length === 0) return false;

      // Update products in parallel for better performance
      const updatePromises = upsertPayload.map(async (payload) => {
        const { id, ...updates } = payload;
        return supabase
          .from('products')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .eq('location_id', currentBusiness?.id);
      });

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      // Create stock history entries using CAPTURED old quantities (not stale in-memory state)
      if (changeReason && userIdForHistory) {
        const processedProducts = new Set<string>();

        for (const { id, updated } of updates) {
          // Skip if already processed (prevents duplicates if same product appears twice)
          if (processedProducts.has(id)) continue;

          const oldQuantity = oldQuantities.get(id);
          if (updated.quantity === undefined || oldQuantity === undefined || updated.quantity === oldQuantity) continue;

          await createStockHistoryEntry(
            id,
            oldQuantity,
            updated.quantity,
            changeReason,
            referenceId,
            adjustmentDate,
            receiptNumber,
            productNames.get(id)
          );

          processedProducts.add(id);
        }
      }

      queryClient.invalidateQueries({ queryKey: baseQueryKey });
      clearInventoryCaches(queryClient);
      return true;
    } catch (error) {
      console.error('Error in updateProductsBulk:', error);
      return false;
    }
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
    // Return filtering functionality
    filters,
    setFilters: setFiltersWithTypingState,
    filteredProducts
  };
};
