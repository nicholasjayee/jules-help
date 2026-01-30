import { useProducts } from './useProducts';
import { SaleItem, Product, mapDbProductToProduct } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const useInventoryActions = (userId: string | undefined) => {
    const { updateProductsBulk, products } = useProducts(userId);

    /**
     * Helper to fetch fresh product data from DB to avoid race conditions/stale data
     */
    const fetchFreshProducts = async (productIds: string[], locationId?: string) => {
        if (!productIds.length) return [];

        let query = supabase
            .from('products')
            .select('*')
            .in('id', productIds);

        if (locationId) {
            query = query.eq('location_id', locationId);
        }

        const { data: dbProducts, error } = await query;

        if (error) {
            console.error('Error fetching fresh products:', error);
            throw error;
        }

        return (dbProducts || []).map(mapDbProductToProduct);
    };

    /**
     * Deduct stock for a new sale
     */
    const deductStockForSale = async (
        items: SaleItem[],
        saleId?: string,
        saleDate?: Date,
        receiptNumber?: string,
        locationId?: string
    ): Promise<boolean> => {
        if (!userId) return false;

        try {
            const itemsWithProductIds = items.filter(item => item.productId);
            if (itemsWithProductIds.length === 0) return true;

            const uniqueIds = [...new Set(itemsWithProductIds.map(item => item.productId!))];
            const freshProducts = await fetchFreshProducts(uniqueIds, locationId);

            if (freshProducts.length === 0) return false;

            // Calculate total quantity to deduct per product
            const quantityChanges = new Map<string, number>();
            for (const item of itemsWithProductIds) {
                const existing = quantityChanges.get(item.productId!) || 0;
                quantityChanges.set(item.productId!, existing + item.quantity);
            }

            const bulkUpdates = [];
            for (const [productId, quantityToDeduct] of quantityChanges.entries()) {
                const product = freshProducts.find(p => p.id === productId);
                if (!product) continue;

                const newQuantity = product.quantity - quantityToDeduct;

                bulkUpdates.push({
                    id: productId,
                    updated: { ...product, quantity: newQuantity }
                });

                if (newQuantity < 0) {
                    toast.warning(`${product.name} inventory is now negative (${newQuantity}). Please restock soon.`);
                }
            }

            if (bulkUpdates.length > 0) {
                await updateProductsBulk(bulkUpdates, userId, 'Sale', saleId, saleDate, receiptNumber);
            }

            return true;
        } catch (error) {
            console.error('Error deducting stock for sale:', error);
            return false;
        }
    };

    /**
     * Restore stock (e.g. when deleting a sale)
     */
    const restoreStockForSale = async (
        items: SaleItem[],
        saleId?: string, // Reference ID for history
        receiptNumber?: string, // Reference receipt number
        locationId?: string
    ): Promise<boolean> => {
        if (!userId) return false;

        try {
            const itemsWithProductIds = items.filter(item => item.productId);
            if (itemsWithProductIds.length === 0) return true;

            const uniqueIds = [...new Set(itemsWithProductIds.map(item => item.productId!))];
            const freshProducts = await fetchFreshProducts(uniqueIds, locationId);

            // Calculate total quantity to restore
            const quantityChanges = new Map<string, number>();
            for (const item of itemsWithProductIds) {
                const existing = quantityChanges.get(item.productId!) || 0;
                quantityChanges.set(item.productId!, existing + item.quantity);
            }

            const bulkUpdates = [];
            for (const [productId, quantityToRestore] of quantityChanges.entries()) {
                const product = freshProducts.find(p => p.id === productId);
                if (!product) continue;

                const newQuantity = product.quantity + quantityToRestore;

                bulkUpdates.push({
                    id: productId,
                    updated: { ...product, quantity: newQuantity }
                });
            }

            if (bulkUpdates.length > 0) {
                await updateProductsBulk(bulkUpdates, userId, 'Deleted Sale', saleId, undefined, receiptNumber);
            }

            return true;
        } catch (error) {
            console.error('Error restoring stock for sale:', error);
            return false;
        }
    };

    /**
     * Adjust stock for an edited sale (Handle both adding and removing items)
     */
    const adjustStockForEditedSale = async (
        originalItems: SaleItem[],
        newItems: SaleItem[],
        saleId?: string,
        saleDate?: Date,
        receiptNumber?: string,
        locationId?: string
    ): Promise<boolean> => {
        if (!userId) return false;

        try {
            const allProductIds = [
                ...originalItems.filter(i => i.productId).map(i => i.productId!),
                ...newItems.filter(i => i.productId).map(i => i.productId!)
            ];
            const uniqueIds = [...new Set(allProductIds)];
            if (uniqueIds.length === 0) return true;

            const freshProducts = await fetchFreshProducts(uniqueIds, locationId);

            const productNetChanges = new Map<string, number>();

            // 1. Restore original items (add back to stock)
            for (const item of originalItems.filter(i => i.productId)) {
                const current = productNetChanges.get(item.productId!) || 0;
                productNetChanges.set(item.productId!, current + item.quantity);
            }

            // 2. Deduct new items (remove from stock)
            for (const item of newItems.filter(i => i.productId)) {
                const current = productNetChanges.get(item.productId!) || 0;
                productNetChanges.set(item.productId!, current - item.quantity);
            }

            const bulkUpdates = [];
            for (const [productId, netChange] of productNetChanges.entries()) {
                if (netChange === 0) continue;

                const product = freshProducts.find(p => p.id === productId);
                if (!product) continue;

                const newQuantity = product.quantity + netChange;

                bulkUpdates.push({
                    id: productId,
                    updated: { ...product, quantity: newQuantity }
                });

                if (newQuantity < 0) {
                    toast.warning(`${product.name} inventory is now negative (${newQuantity}). Please restock soon.`);
                }
            }

            if (bulkUpdates.length > 0) {
                await updateProductsBulk(bulkUpdates, userId, 'Sale Status/Qty Edit', saleId, saleDate, receiptNumber);
            }

            return true;
        } catch (error) {
            console.error('Error adjusting stock for edited sale:', error);
            return false;
        }
    };

    return {
        deductStockForSale,
        restoreStockForSale,
        adjustStockForEditedSale
    };
};
