
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StockHistoryEntry } from '@/types';
import { useBusiness } from '@/contexts/BusinessContext';

export const useStockHistory = (userId: string | undefined, productId?: string) => {
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentBusiness } = useBusiness();

  // Memoize the load function to prevent infinite re-renders
  const loadStockHistory = useCallback(async () => {
    if (!userId || !currentBusiness) {
      setStockHistory([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Fetch all stock history without any limits
      // We'll implement a recursive fetch to get all records
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000; // Fetch in smaller, more manageable batches

      while (hasMore) {
        let query = supabase
          .from('stock_history')
          .select('*, products(name, cost_price, selling_price, item_number)')
          .eq('location_id', currentBusiness.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1);

        // If productId is provided, filter by it
        if (productId) {
          query = query.eq('product_id', productId);
        }

        const { data: batchData, error: batchError } = await query;

        if (batchError) {
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          allData = [...allData, ...batchData];

          // If we got less than the batch size, we've reached the end
          if (batchData.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      const data = allData;

      // Remove the individual query as it's now handled in the batch loop above
      const error = null; // No error if we reached this point

      if (error) {
        throw error;
      }

      if (data) {
        const formattedHistory: StockHistoryEntry[] = data.map(entry => {
          const productData = entry.products;
          return {
            id: entry.id,
            productId: entry.product_id,
            oldQuantity: entry.previous_quantity,
            newQuantity: entry.new_quantity,
            changeReason: entry.change_reason,
            createdAt: new Date(entry.created_at),
            referenceId: entry.reference_id,
            receiptNumber: entry.receipt_number,
            product: productData ? {
              name: productData.name,
              costPrice: productData.cost_price,
              sellingPrice: productData.selling_price,
              itemNumber: productData.item_number
            } : undefined
          };
        });
        // Reverse for display (newest first for UI)
        setStockHistory(formattedHistory.reverse());
      }
    } catch (error) {
      console.error('Error loading stock history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentBusiness, productId]);

  useEffect(() => {
    loadStockHistory();
  }, [loadStockHistory]);

  // Create stock history entry with standardized reasons and recalculate stock chain
  const createStockHistoryEntry = async (
    productId: string,
    previousQuantity: number,
    newQuantity: number,
    reason: string,
    referenceId?: string,
    entryDate?: Date,
    receiptNumber?: string,
    productName?: string
  ) => {
    console.log('📝 createStockHistoryEntry CALLED', {
      productId,
      productName,
      prevQty: previousQuantity,
      newQty: newQuantity,
      reason,
      refId: referenceId,
      receipt: receiptNumber,
      entryDate: entryDate?.toISOString(),
      stack: new Error().stack
    });

    try {
      if (!userId || !currentBusiness) return false;

      // Prefix reason with product name for future retrieval if product is deleted
      const snapshottedReason = productName
        ? `[${productName}] | ${reason}`
        : reason;

      const insertData: any = {
        user_id: userId,
        product_id: productId,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        change_reason: snapshottedReason,
        reference_id: referenceId,
        receipt_number: receiptNumber,
        location_id: currentBusiness.id
      };

      // ONLY use explicit date if provided AND it includes a real time component
      // Otherwise let database use now() to avoid midnight UTC issues (which show as 3:00 AM in EAT)
      if (entryDate) {
        const hours = entryDate.getHours();
        const minutes = entryDate.getMinutes();
        const seconds = entryDate.getSeconds();

        // Skip midnight (00:00:00) - this is from date pickers, let DB use now() instead
        // Also skip noon (12:00:00) from our date picker fix - let DB use now()
        const isMidnight = hours === 0 && minutes === 0 && seconds === 0;
        const isNoon = hours === 12 && minutes === 0 && seconds === 0;

        if (!isMidnight && !isNoon) {
          insertData.created_at = entryDate.toISOString();
        }
        // If it's midnight or noon, don't set created_at - let DB use now() for accurate timestamp
      }

      const { error } = await supabase
        .from('stock_history')
        .insert(insertData);

      if (error) {
        console.error('Error creating stock history entry:', error);
        return false;
      }

      // Chain recalculation disabled to prevent cascading errors
      // Use the Reconciliation tool to fix stock discrepancies instead
      // const recalcSuccess = await recalculateStockChain(productId);

      // Refresh stock history after creating new entry
      await loadStockHistory();

      return true;
    } catch (error) {
      console.error('Error creating stock history:', error);
      return false;
    }
  };

  // Update stock history entry and recalculate all subsequent entries
  const updateStockHistoryEntry = async (
    entryId: string,
    newQuantity: number,
    newChangeReason: string,
    newDate?: Date
  ) => {
    try {
      if (!userId || !currentBusiness) return false;

      // First, get the current entry to understand the change
      const { data: currentEntry, error: fetchError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('id', entryId)
        .single();

      if (fetchError || !currentEntry) {
        console.error('Error fetching current entry:', fetchError);
        return false;
      }

      // Check if this is the initial stock entry by getting all stock history for this product
      const { data: allStockHistory, error: stockHistoryError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('product_id', currentEntry.product_id)
        .eq('location_id', currentBusiness.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (stockHistoryError || !allStockHistory) {
        console.error('Error fetching stock history:', stockHistoryError);
        return false;
      }

      const isInitialStock = allStockHistory.length > 0 && allStockHistory[0].id === entryId;

      // Update the current entry
      const updateData: any = {
        new_quantity: newQuantity,
        change_reason: newChangeReason,
      };

      if (newDate) {
        // Use toISOString() to preserve the exact local time without timezone conversion
        updateData.created_at = newDate.toISOString();
      }

      const { error: updateError } = await supabase
        .from('stock_history')
        .update(updateData)
        .eq('id', entryId);

      if (updateError) {
        console.error('Error updating stock history entry:', updateError);
        return false;
      }

      // If this is initial stock and date is being updated, also update product creation date
      if (isInitialStock && newDate) {
        const { error: productDateUpdateError } = await supabase
          .from('products')
          .update({ created_at: newDate.toISOString() })
          .eq('id', currentEntry.product_id);

        if (productDateUpdateError) {
          console.error('Error updating product creation date:', productDateUpdateError);
          return false;
        }
      }

      // Use the already fetched stock history to avoid duplicate queries
      const allHistory = allStockHistory;

      // Find the index of the updated entry
      const updatedEntryIndex = allHistory.findIndex(entry => entry.id === entryId);
      if (updatedEntryIndex === -1) return false;

      // Calculate the user's intended change amount for the edited entry
      const userChangeAmount = newQuantity - currentEntry.previous_quantity;

      // Recalculate the entire chain from the beginning
      const updatesToMake = [];
      let runningQuantity = 0; // Start from initial stock of 0

      for (let i = 0; i < allHistory.length; i++) {
        const entry = allHistory[i];

        if (i === updatedEntryIndex) {
          // For the updated entry, preserve the user's intended change amount
          const newPreviousQuantity = runningQuantity;
          const newNewQuantity = newPreviousQuantity + userChangeAmount;

          // Update both previous and new quantities to preserve user's change amount
          if (entry.previous_quantity !== newPreviousQuantity || entry.new_quantity !== newNewQuantity) {
            updatesToMake.push({
              id: entry.id,
              previous_quantity: newPreviousQuantity,
              new_quantity: newNewQuantity
            });
          }

          runningQuantity = newNewQuantity;
        } else {
          // For all other entries, recalculate based on their original change amount
          const originalChange = entry.new_quantity - entry.previous_quantity;
          const newPreviousQuantity = runningQuantity;
          const newNewQuantity = newPreviousQuantity + originalChange;

          // Only update if values have changed
          if (entry.previous_quantity !== newPreviousQuantity || entry.new_quantity !== newNewQuantity) {
            updatesToMake.push({
              id: entry.id,
              previous_quantity: newPreviousQuantity,
              new_quantity: newNewQuantity
            });
          }

          runningQuantity = newNewQuantity;
        }
      }

      // Perform batch updates for all subsequent entries
      if (updatesToMake.length > 0) {
        for (const update of updatesToMake) {
          const { error: batchUpdateError } = await supabase
            .from('stock_history')
            .update({
              previous_quantity: update.previous_quantity,
              new_quantity: update.new_quantity
            })
            .eq('id', update.id);

          if (batchUpdateError) {
            console.error('Error updating subsequent entry:', batchUpdateError);
            // Continue with other updates even if one fails
          }
        }
      }

      // Update the final product quantity
      const finalQuantity = runningQuantity;

      const { error: productUpdateError } = await supabase
        .from('products')
        .update({ quantity: finalQuantity })
        .eq('id', currentEntry.product_id);

      if (productUpdateError) {
        console.error('Error updating product quantity:', productUpdateError);
        return false;
      }

      // Refresh stock history to show updated chain
      await loadStockHistory();

      return true;
    } catch (error) {
      console.error('Error updating stock history:', error);
      return false;
    }
  };

  // Delete multiple stock history entries (for bulk operations like deleting entire invoice)
  const deleteMultipleStockHistoryEntries = async (entryIds: string[]) => {
    try {
      if (!userId || !currentBusiness || entryIds.length === 0) return false;

      // Get all entries to be deleted
      const { data: entriesToDelete, error: fetchError } = await supabase
        .from('stock_history')
        .select('*')
        .in('id', entryIds);

      if (fetchError || !entriesToDelete) {
        console.error('Error fetching entries to delete:', fetchError);
        return false;
      }

      // Group entries by product_id to handle recalculation properly
      const entriesByProduct = entriesToDelete.reduce((acc, entry) => {
        if (!acc[entry.product_id]) {
          acc[entry.product_id] = [];
        }
        acc[entry.product_id].push(entry);
        return acc;
      }, {} as Record<string, typeof entriesToDelete>);

      // Delete all entries in a single batch
      const { error: deleteError } = await supabase
        .from('stock_history')
        .delete()
        .in('id', entryIds);

      if (deleteError) {
        console.error('Error deleting stock history entries:', deleteError);
        return false;
      }

      // Chain recalculation disabled to prevent cascading errors
      // Use the Reconciliation tool to fix stock discrepancies instead
      // for (const productId of Object.keys(entriesByProduct)) {
      //   await recalculateStockChain(productId);
      // }

      return true;
    } catch (error) {
      console.error('Error deleting multiple stock history entries:', error);
      return false;
    }
  };

  // Delete stock history entry and recalculate all subsequent entries
  const deleteStockHistoryEntry = async (entryId: string) => {
    try {
      if (!userId || !currentBusiness) return false;

      // First, get the entry to be deleted
      const { data: entryToDelete, error: fetchError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('id', entryId)
        .single();

      if (fetchError || !entryToDelete) {
        console.error('Error fetching entry to delete:', fetchError);
        return false;
      }

      // Get all stock history for this product in chronological order
      const { data: allHistory, error: historyError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('product_id', entryToDelete.product_id)
        .eq('location_id', currentBusiness.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (historyError || !allHistory) {
        console.error('Error fetching stock history:', historyError);
        return false;
      }

      // Find the index of the entry to delete
      const deleteIndex = allHistory.findIndex(entry => entry.id === entryId);
      if (deleteIndex === -1) return false;

      // Delete the entry
      const { error: deleteError } = await supabase
        .from('stock_history')
        .delete()
        .eq('id', entryId);

      if (deleteError) {
        console.error('Error deleting stock history entry:', deleteError);
        return false;
      }

      // Recalculate all subsequent entries
      const updatesToMake = [];

      // If this was the first entry, the next entry's previous_quantity should be 0
      // If this was a middle entry, the next entry's previous_quantity should be the previous entry's new_quantity
      let newPreviousQuantity = 0;
      if (deleteIndex > 0) {
        newPreviousQuantity = allHistory[deleteIndex - 1].new_quantity;
      }

      // Recalculate all entries after the deleted one
      for (let i = deleteIndex + 1; i < allHistory.length; i++) {
        const entry = allHistory[i];
        const originalChange = entry.new_quantity - entry.previous_quantity;
        const newNewQuantity = newPreviousQuantity + originalChange;

        updatesToMake.push({
          id: entry.id,
          previous_quantity: newPreviousQuantity,
          new_quantity: newNewQuantity
        });

        newPreviousQuantity = newNewQuantity;
      }

      // Perform batch updates for all subsequent entries
      if (updatesToMake.length > 0) {
        for (const update of updatesToMake) {
          const { error: batchUpdateError } = await supabase
            .from('stock_history')
            .update({
              previous_quantity: update.previous_quantity,
              new_quantity: update.new_quantity
            })
            .eq('id', update.id);

          if (batchUpdateError) {
            console.error('Error updating subsequent entry:', batchUpdateError);
            // Continue with other updates even if one fails
          }
        }
      }

      // Update the final product quantity
      const finalQuantity = updatesToMake.length > 0
        ? updatesToMake[updatesToMake.length - 1].new_quantity
        : (deleteIndex > 0 ? allHistory[deleteIndex - 1].new_quantity : 0);

      const { error: productUpdateError } = await supabase
        .from('products')
        .update({ quantity: finalQuantity })
        .eq('id', entryToDelete.product_id);

      if (productUpdateError) {
        console.error('Error updating product quantity:', productUpdateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting stock history:', error);
      return false;
    }
  };

  // Recalculate the entire stock chain for a product to maintain proper flow
  const recalculateStockChain = async (productId: string) => {
    try {
      if (!userId || !currentBusiness) return false;

      // Get all stock history for this product in chronological order
      const { data: allHistory, error: historyError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('product_id', productId)
        .eq('location_id', currentBusiness.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (historyError || !allHistory) {
        console.error('Error fetching stock history for recalculation:', historyError);
        return false;
      }

      if (allHistory.length === 0) return true;

      // Recalculate the entire chain from the beginning
      const updatesToMake = [];
      let runningQuantity = 0; // Start from initial stock of 0

      for (let i = 0; i < allHistory.length; i++) {
        const entry = allHistory[i];

        // Calculate the original change amount for this entry
        const originalChange = entry.new_quantity - entry.previous_quantity;

        // Set the correct previous quantity and recalculated new quantity
        const newPreviousQuantity = runningQuantity;
        const newNewQuantity = newPreviousQuantity + originalChange;

        // Only update if values have changed
        if (entry.previous_quantity !== newPreviousQuantity || entry.new_quantity !== newNewQuantity) {
          updatesToMake.push({
            id: entry.id,
            previous_quantity: newPreviousQuantity,
            new_quantity: newNewQuantity
          });
        }

        runningQuantity = newNewQuantity;
      }

      // Perform batch updates for all entries that need updating
      if (updatesToMake.length > 0) {
        for (const update of updatesToMake) {
          const { error: batchUpdateError } = await supabase
            .from('stock_history')
            .update({
              previous_quantity: update.previous_quantity,
              new_quantity: update.new_quantity
            })
            .eq('id', update.id);

          if (batchUpdateError) {
            console.error('Error updating entry during chain recalculation:', batchUpdateError);
            // Continue with other updates even if one fails
          }
        }
      }

      // Update the final product quantity
      const finalQuantity = runningQuantity;

      const { error: productUpdateError } = await supabase
        .from('products')
        .update({ quantity: finalQuantity })
        .eq('id', productId);

      if (productUpdateError) {
        console.error('Error updating product quantity during chain recalculation:', productUpdateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error recalculating stock chain:', error);
      return false;
    }
  };

  // Recalculate product stock based on remaining history
  // Update stock history dates for a specific sale
  const updateStockHistoryDatesBySaleId = async (saleId: string, newDate: Date) => {
    try {
      if (!userId || !currentBusiness) {
        console.log('Missing userId or currentBusiness for stock history update');
        return false;
      }

      console.log('Updating stock history dates for sale:', saleId, 'to date:', newDate);

      // Find all stock history entries with this sale as reference_id
      const { data: stockEntries, error: fetchError } = await supabase
        .from('stock_history')
        .select('*')
        .eq('reference_id', saleId)
        .eq('location_id', currentBusiness.id);

      if (fetchError) {
        console.error('Error fetching stock history entries for sale:', fetchError);
        return false;
      }

      console.log('Found stock history entries for sale:', stockEntries?.length || 0);

      if (!stockEntries || stockEntries.length === 0) {
        console.log('No stock entries found for sale:', saleId);
        return true; // No stock entries to update
      }

      // Group entries by product_id to handle recalculation properly
      const entriesByProduct = stockEntries.reduce((acc, entry) => {
        if (!acc[entry.product_id]) {
          acc[entry.product_id] = [];
        }
        acc[entry.product_id].push(entry);
        return acc;
      }, {} as Record<string, typeof stockEntries>);

      // Update each stock history entry's date
      for (const entry of stockEntries) {
        console.log('Updating stock history entry:', entry.id, 'from date:', entry.created_at, 'to:', newDate.toISOString());

        const { error: updateError } = await supabase
          .from('stock_history')
          .update({ created_at: newDate.toISOString() })
          .eq('id', entry.id);

        if (updateError) {
          console.error('Error updating stock history date:', updateError);
          return false;
        }
      }

      console.log('Successfully updated', stockEntries.length, 'stock history entries');

      // Chain recalculation disabled to prevent cascading errors
      // Use the Reconciliation tool to fix stock discrepancies instead
      // for (const productId of Object.keys(entriesByProduct)) {
      //   const recalcSuccess = await recalculateStockChain(productId);
      //   if (!recalcSuccess) {
      //     console.error('Failed to recalculate stock chain for product:', productId);
      //   }
      // }

      // Refresh stock history to reflect the updated dates
      await loadStockHistory();

      return true;
    } catch (error) {
      console.error('Error updating stock history dates by sale ID:', error);
      return false;
    }
  };

  const recalculateProductStock = async (productId: string) => {
    try {
      if (!userId || !currentBusiness) return null;

      // Get all stock history for this product in chronological order
      const { data, error } = await supabase
        .from('stock_history')
        .select('*')
        .eq('product_id', productId)
        .eq('location_id', currentBusiness.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching stock history for recalculation:', error);
        return null;
      }

      // Calculate final stock quantity from history
      let currentStock = 0;
      if (data && data.length > 0) {
        // Start with the first entry's new quantity
        currentStock = data[0].new_quantity;

        // Process remaining entries sequentially
        for (let i = 1; i < data.length; i++) {
          const entry = data[i];
          const previousEntry = data[i - 1];

          // Calculate the change based on the difference
          const change = entry.new_quantity - entry.previous_quantity;
          currentStock = previousEntry.new_quantity + change;
        }

        // The final stock is the new_quantity of the last entry
        if (data.length > 0) {
          currentStock = data[data.length - 1].new_quantity;
        }
      }

      // Update the product's quantity
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: currentStock })
        .eq('id', productId);

      if (updateError) {
        console.error('Error updating product quantity:', updateError);
        return null;
      }

      return currentStock;
    } catch (error) {
      console.error('Error recalculating product stock:', error);
      return null;
    }
  };

  return {
    stockHistory,
    isLoading,
    createStockHistoryEntry,
    updateStockHistoryEntry,
    deleteStockHistoryEntry,
    deleteMultipleStockHistoryEntries,
    recalculateStockChain,
    updateStockHistoryDatesBySaleId,
    recalculateProductStock,
    loadStockHistory
  };
};
