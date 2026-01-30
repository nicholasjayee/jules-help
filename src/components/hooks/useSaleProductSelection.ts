import { useState } from 'react';
import { Product, SaleItem } from '@/types';
import { useProducts } from './useProducts';
import { useInventoryActions } from './useInventoryActions';
import { useBusiness } from '@/contexts/BusinessContext';

export const useSaleProductSelection = (userId: string | undefined) => {
  const { products } = useProducts(userId);
  const { currentBusiness } = useBusiness();
  const { deductStockForSale, adjustStockForEditedSale } = useInventoryActions(userId);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string | null>>({});

  const selectProduct = (itemIndex: number, productId: string | null) => {
    setSelectedProducts(prev => ({
      ...prev,
      [itemIndex]: productId
    }));
  };

  const getProductForItem = (itemIndex: number): Product | null => {
    const productId = selectedProducts[itemIndex];
    if (!productId) return null;

    return products.find(p => p.id === productId) || null;
  };

  const updateInventoryForSale = async (
    items: SaleItem[],
    paymentStatus?: string,
    saleDate?: Date,
    saleId?: string,
    receiptNumber?: string
  ) => {
    // Only skip inventory if still a quote
    if (paymentStatus === 'Quote') return true;

    return deductStockForSale(items, saleId, saleDate, receiptNumber, currentBusiness?.id);
  };


  const updateInventoryForEditedSale = async (
    originalItems: SaleItem[],
    newItems: SaleItem[],
    newStatus?: string,
    saleDate?: Date,
    saleId?: string,
    receiptNumber?: string,
    originalStatus?: string
  ) => {
    // Determine if we should add back original items and deduct new items
    const shouldRestoreOriginal = originalStatus !== 'Quote';
    const shouldDeductNew = newStatus !== 'Quote';

    // If neither status affects inventory, we can skip
    if (!shouldRestoreOriginal && !shouldDeductNew) return true;

    // Filter lists based on status. 
    // If original was Quote, we DO NOT restore (empty list).
    // If new is Quote, we DO NOT deduct (empty list).
    const itemsToRestore = shouldRestoreOriginal ? originalItems : [];
    const itemsToDeduct = shouldDeductNew ? newItems : [];

    return adjustStockForEditedSale(itemsToRestore, itemsToDeduct, saleId, saleDate, receiptNumber, currentBusiness?.id);
  };

  return {
    products,
    selectedProducts,
    selectProduct,
    getProductForItem,
    updateInventoryForSale,
    updateInventoryForEditedSale
  };
};
