"use client";
import { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types';

export const useProductSuggestions = (products: Product[], searchTerm: string) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get filtered suggestions based on search term
  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(searchLower) || 
      (product.description && product.description.toLowerCase().includes(searchLower)) ||
      (product.supplier && product.supplier.toLowerCase().includes(searchLower)) ||
      (product.category.toLowerCase().includes(searchLower)) ||
      (product.itemNumber.toLowerCase().includes(searchLower))
    );

    // Sort by relevance (exact matches first, then starts with, then contains)
    return filtered
      .sort((a, b) => {
        const aNameLower = a.name.toLowerCase();
        const bNameLower = b.name.toLowerCase();
        const aItemLower = a.itemNumber.toLowerCase();
        const bItemLower = b.itemNumber.toLowerCase();
        
        // Exact match on item number (highest priority)
        if (aItemLower === searchLower) return -1;
        if (bItemLower === searchLower) return 1;
        
        // Exact match on name
        if (aNameLower === searchLower) return -1;
        if (bNameLower === searchLower) return 1;
        
        // Starts with on item number
        if (aItemLower.startsWith(searchLower) && !bItemLower.startsWith(searchLower)) return -1;
        if (bItemLower.startsWith(searchLower) && !aItemLower.startsWith(searchLower)) return 1;
        
        // Starts with on name
        if (aNameLower.startsWith(searchLower) && !bNameLower.startsWith(searchLower)) return -1;
        if (bNameLower.startsWith(searchLower) && !aNameLower.startsWith(searchLower)) return 1;
        
        // Alphabetical by name
        return aNameLower.localeCompare(bNameLower);
      })
      .slice(0, 100); // Increased to 100 suggestions for better user experience
  }, [products, searchTerm]);

  // Open panel when there are suggestions and search term is present
  useEffect(() => {
    if (searchTerm.length >= 1 && suggestions.length > 0) {
      setIsOpen(true);
    } else if (searchTerm.length === 0) {
      setIsOpen(false);
    }
  }, [searchTerm, suggestions.length]);

  const openPanel = () => {
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
  };

  return {
    suggestions,
    isOpen,
    openPanel,
    closePanel
  };
};
