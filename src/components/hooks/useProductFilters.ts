import { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, ProductFilters } from '@/types';
import { useBusiness } from '@/contexts/BusinessContext';

/**
 * Hook for filtering products based on search, category, and stock status
 */
export const useProductFilters = (products: Product[]) => {
  const { currentBusiness } = useBusiness();

  const FILTER_STORAGE_KEY = useMemo(() =>
    currentBusiness?.id ? `productFilters_${currentBusiness.id}` : 'productFilters'
    , [currentBusiness?.id]);

  // Load initial filters from localStorage or use defaults
  const loadFiltersFromStorage = useCallback((): ProductFilters => {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          search: parsed.search || '',
          category: parsed.category || '',
          stockStatus: parsed.stockStatus || 'all'
        };
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }

    return {
      search: '',
      category: '',
      stockStatus: 'all'
    };
  }, [FILTER_STORAGE_KEY]);

  const [filters, setFiltersState] = useState<ProductFilters>(loadFiltersFromStorage);

  // Reload filters when business changes
  useEffect(() => {
    if (currentBusiness?.id) {
      setFiltersState(loadFiltersFromStorage());
    }
  }, [currentBusiness?.id, loadFiltersFromStorage]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  }, [filters, FILTER_STORAGE_KEY]);

  // Wrapper function to update filters
  const setFilters = (newFilters: ProductFilters) => {
    setFiltersState(newFilters);
  };

  const applyFilters = (products: Product[], filters: ProductFilters): Product[] => {
    return products.filter(product => {
      // Search filter - now includes item number
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm) ||
          product.category.toLowerCase().includes(searchTerm) ||
          product.supplier?.toLowerCase().includes(searchTerm) ||
          product.itemNumber.toLowerCase().includes(searchTerm); // Added item number search

        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category && filters.category !== product.category) {
        return false;
      }

      // Stock status filter
      if (filters.stockStatus !== 'all') {
        if (filters.stockStatus === 'inStock' && product.quantity <= product.minimumStock) {
          return false;
        }
        if (filters.stockStatus === 'lowStock' && (product.quantity === 0 || product.quantity > product.minimumStock)) {
          return false;
        }
        if (filters.stockStatus === 'outOfStock' && product.quantity > 0) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredProducts = useMemo(() => {
    return applyFilters(products, filters);
  }, [products, filters]);

  return {
    filters,
    setFilters,
    filteredProducts,
    applyFilters
  };
};
