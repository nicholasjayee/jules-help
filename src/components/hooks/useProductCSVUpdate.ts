import { useState } from 'react';
import { useToast } from '@/components/hooks/use-toast';
import { useProducts } from '@/components/hooks/useProducts';
import { useCategories } from '@/components/hooks/useCategories';
import { CSVProductUpdateRow } from '@/utils/csvUpdateParser';
import { Product } from '@/components/types';

export interface ProductUpdateData {
  productId: string;
  itemNumber: string;
  updates: {
    name?: string;
    category?: string;
    quantity?: number;
    costPrice?: number;
    sellingPrice?: number;
    supplier?: string;
    description?: string;
  };
  quantityChange?: {
    oldQuantity: number;
    newQuantity: number;
  };
}

export const useProductCSVUpdate = (userId: string | undefined) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();
  // Load all products by setting a very high page size
  const { products, updateProduct } = useProducts(userId, 10000);
  const { categories, createCategory } = useCategories(userId);

  const validateUpdates = (
    updateRows: CSVProductUpdateRow[]
  ): { validUpdates: ProductUpdateData[]; errors: string[] } => {
    const validUpdates: ProductUpdateData[] = [];
    const errors: string[] = [];

    updateRows.forEach((row, index) => {
      const itemNumber = row['Item Number']?.trim();
      // Handle leading zeros - Excel removes them but database has them
      const paddedItemNumber = itemNumber?.padStart(4, '0');
      const product = products.find(p => 
        p.itemNumber === itemNumber || p.itemNumber === paddedItemNumber
      );

      if (!product) {
        errors.push(`Row ${index + 1}: Product with Item Number "${itemNumber}" not found`);
        return;
      }

      const updates: ProductUpdateData['updates'] = {};
      let quantityChange: ProductUpdateData['quantityChange'] | undefined;

      // Check each field for updates
      if (row['Name']?.trim() && row['Name'].trim() !== product.name) {
        updates.name = row['Name'].trim();
      }

      if (row['Category']?.trim() && row['Category'].trim() !== product.category) {
        updates.category = row['Category'].trim();
      }

      if (row['Quantity']?.trim() !== '' && !isNaN(Number(row['Quantity']))) {
        const newQuantity = Number(row['Quantity']);
        if (newQuantity !== product.quantity) {
          updates.quantity = newQuantity;
          quantityChange = {
            oldQuantity: product.quantity,
            newQuantity: newQuantity
          };
        }
      }

      if (row['Cost Price']?.trim() !== '' && !isNaN(Number(row['Cost Price']))) {
        const newCostPrice = Number(row['Cost Price']);
        // Use precision-safe comparison for numbers
        if (Math.abs(newCostPrice - product.costPrice) > 0.001) {
          updates.costPrice = newCostPrice;
        }
      }

      if (row['Selling Price']?.trim() !== '' && !isNaN(Number(row['Selling Price']))) {
        const newSellingPrice = Number(row['Selling Price']);
        // Use precision-safe comparison for numbers
        if (Math.abs(newSellingPrice - product.sellingPrice) > 0.001) {
          updates.sellingPrice = newSellingPrice;
        }
      }

      if (row['Supplier']?.trim() && row['Supplier'].trim() !== (product.supplier || '')) {
        updates.supplier = row['Supplier'].trim();
      }

      if (row['Description']?.trim() && row['Description'].trim() !== (product.description || '')) {
        updates.description = row['Description'].trim();
      }

      // Only add if there are actual updates
      if (Object.keys(updates).length > 0) {
        validUpdates.push({
          productId: product.id,
          itemNumber: product.itemNumber,
          updates,
          quantityChange
        });
      }
    });

    return { validUpdates, errors };
  };

  const detectNewCategories = (updateRows: CSVProductUpdateRow[]): string[] => {
    const existingCategories = categories.map(cat => cat.name);
    const csvCategories = updateRows
      .map(row => row['Category']?.trim())
      .filter(category => category && category !== '');
    
    return [...new Set(csvCategories)].filter(category => !existingCategories.includes(category));
  };

  const bulkUpdateProducts = async (
    updateRows: CSVProductUpdateRow[],
    onProgress?: (current: number, total: number) => void
  ) => {
    setIsUpdating(true);
    setUpdateProgress({ current: 0, total: updateRows.length });

    try {
      // Validate updates
      const { validUpdates, errors } = validateUpdates(updateRows);

      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(', ')}`);
      }

      // Create new categories if needed
      const newCategories = detectNewCategories(updateRows);
      for (const categoryName of newCategories) {
        await createCategory(categoryName);
      }

      // Update products
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < validUpdates.length; i++) {
        const updateData = validUpdates[i];
        
        try {
          console.log(`DEBUG: Calling updateProduct for ${updateData.itemNumber} with updates:`, updateData.updates);
          
          // Update product - the updateProduct function will handle stock history for quantity changes
          const success = await updateProduct(
            updateData.productId,
            updateData.updates,
            undefined, // no image file
            false, // not from sale
            'CSV Edit' // custom change reason for stock history
          );

          console.log(`DEBUG: UpdateProduct result for ${updateData.itemNumber}: ${success}`);

          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(`Error updating product ${updateData.itemNumber}:`, error);
          failureCount++;
        }

        const current = i + 1;
        setUpdateProgress({ current, total: validUpdates.length });
        onProgress?.(current, validUpdates.length);
      }

      if (successCount > 0) {
        toast({
          title: "Products updated successfully",
          description: `${successCount} product${successCount > 1 ? 's' : ''} updated successfully`,
        });
      }

      if (failureCount > 0) {
        toast({
          title: "Some updates failed",
          description: `${failureCount} product${failureCount > 1 ? 's' : ''} could not be updated`,
          variant: "destructive"
        });
      }

      return { successCount, failureCount };

    } catch (error) {
      console.error('Bulk update failed:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred during the update",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUpdating(false);
      setUpdateProgress(null);
    }
  };

  return {
    isUpdating,
    updateProgress,
    validateUpdates,
    detectNewCategories,
    bulkUpdateProducts
  };
};