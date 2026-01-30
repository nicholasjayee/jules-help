
import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a sequential receipt number using atomic database function.
 * This prevents race conditions when multiple sales are created simultaneously.
 */
export const generateReceiptNumber = async (locationId?: string): Promise<string> => {
  try {
    if (!locationId) {
      console.error('Location ID is required for receipt number generation');
      return '000001';
    }

    // Use the database function to atomically get the next receipt number
    const { data, error } = await supabase.rpc('get_next_receipt_number', {
      location_uuid: locationId
    });

    if (error) {
      console.error('Error generating receipt number:', error);
      // Fallback: get max from existing sales and add 1
      return await getFallbackReceiptNumber(locationId);
    }

    return data || '000001';
  } catch (error) {
    console.error('Error generating receipt number:', error);
    // Fallback: get max from existing sales and add 1
    return await getFallbackReceiptNumber(locationId);
  }
};

/**
 * Fallback method to generate receipt number if database function fails
 */
async function getFallbackReceiptNumber(locationId: string): Promise<string> {
  try {
    const { data: salesData, error } = await supabase
      .from('sales')
      .select('receipt_number')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(100); // Only check recent sales for performance

    if (error) {
      console.error('Error in fallback receipt generation:', error);
      return '000001';
    }

    let maxNumber = 0;
    if (salesData && salesData.length > 0) {
      salesData.forEach(sale => {
        const receiptNumber = sale.receipt_number;
        const numericValue = parseInt(receiptNumber, 10);
        if (!isNaN(numericValue) && numericValue > maxNumber) {
          maxNumber = numericValue;
        }
      });
    }

    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(6, '0');
  } catch (error) {
    console.error('Error in fallback receipt generation:', error);
    return '000001';
  }
}
