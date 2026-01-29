import { useState } from 'react';

export const useProductCSVUpdate = (userId?: string) => {
  return {
    bulkUpdateProducts: async (products: any[], progressCallback?: (current: number, total: number) => void) => {
        return { successCount: products.length, failureCount: 0, errors: [] };
    },
    detectNewCategories: (products: any[]) => [],
    isUpdating: false
  };
};
