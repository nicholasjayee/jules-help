import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useSalesData } from '@/hooks/useSalesData';
import { useSaleProductSelection } from '@/hooks/useSaleProductSelection';
import { Sale } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { useBusiness } from '@/contexts/BusinessContext';

export const useNewSaleActions = (editSale?: Sale, onSaveSuccess?: () => void) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast: uiToast } = useToast();
  const { customers, createCustomer } = useCustomers();
  const { addSale, updateSale } = useSalesData(user?.id);
  const { updateInventoryForSale, updateInventoryForEditedSale } = useSaleProductSelection(user?.id);
  const { logActivity } = useActivityLogger();
  const { currentBusiness } = useBusiness();

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [includePaymentInfo, setIncludePaymentInfo] = useState(true);

  const handleSaleComplete = useCallback(async (
    sale: Sale,
    showReceipt: boolean = false,
    includePaymentInfo: boolean = true,
    selectedCategoryId?: string,
    clearDraft?: () => void,
    saleDate?: Date
  ) => {
    // Clear draft when sale is completed
    if (!editSale && clearDraft) {
      clearDraft();
    }

    // Only save customer to customers database if they don't exist already
    if (user?.id && sale.customerName.trim()) {
      // Check if customer already exists in database (not just in memory)
      const { data: existingCustomers } = await (supabase as any)
        .from('customers')
        .select('id, full_name')
        .eq('location_id', currentBusiness?.id)
        .ilike('full_name', sale.customerName.trim());

      let customerId = '';

      // Only add if the customer doesn't exist
      if (!existingCustomers || existingCustomers.length === 0) {
        try {
          // Add customer to database with the selected category
          const newCustomer = await createCustomer({
            fullName: sale.customerName,
            phoneNumber: sale.customerContact || null,
            location: sale.customerAddress || null,
            email: null,
            birthday: null,
            gender: null,
            categoryId: selectedCategoryId || null,
            notes: null,
            tags: null,
            socialMedia: null
          });

          if (newCustomer) {
            customerId = newCustomer.id;
          }

          toast.success(`Added ${sale.customerName} to your customers list`);
        } catch (error) {
          console.error('Error adding customer:', error);
        }
      } else {
        // Use the existing customer ID
        customerId = (existingCustomers[0] as any).id;
      }

      // If we have a valid customerId, update the sale with it
      if (customerId && sale.id) {
        try {
          await (supabase as any)
            .from('sales')
            .update({ customer_id: customerId })
            .eq('id', sale.id);
        } catch (error) {
          console.error('Error associating sale with customer:', error);
        }
      }
    }

    // Update inventory for sale (new or edit)
    let inventorySuccess = false;
    if (editSale) {
      // For edits, restore original items and subtract new ones
      inventorySuccess = await updateInventoryForEditedSale(editSale.items, sale.items, sale.paymentStatus, saleDate, sale.id, sale.receiptNumber, editSale.paymentStatus);
    } else {
      // For new sale, subtract sold items
      // Use provided saleDate or undefined (which defaults to current time in updateInventoryForSale)
      inventorySuccess = await updateInventoryForSale(sale.items, sale.paymentStatus, saleDate, sale.id, sale.receiptNumber);
    }

    if (!inventorySuccess) {
      console.error('Inventory update failed. Initiating rollback...');

      // ROLLBACK STRATEGY
      if (!editSale) {
        // If it was a new sale, delete it
        const { error: deleteError } = await (supabase as any).from('sales').delete().eq('id', sale.id);
        if (deleteError) {
          console.error('CRITICAL: Failed to rollback sale after inventory failure:', deleteError);
          uiToast({
            title: "Critical Error",
            description: "Inventory failed to update, and we could not cancel the sale. Please contact support.",
            variant: "destructive"
          });
        } else {
          uiToast({
            title: "Sale Cancelled",
            description: "Inventory update failed, so the sale was cancelled to ensure data consistency.",
            variant: "destructive"
          });
        }
      } else {
        // If it was an edit, we might want to revert the sale changes in the database
        // For now, we just warn the user that inventory wasn't updated
        uiToast({
          title: "Inventory Update Failed",
          description: "The sale was saved, but inventory could not be updated. Please check stock levels manually.",
          variant: "destructive"
        });
        // Ideally we would revert the DB update here too, but that requires passing the original DB state
      }

      // STOP PROCESSING
      throw new Error('Inventory update failed');
    }

    // Calculate total amount from items for accurate logging
    const itemsTotal = sale.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const discountAmount = item.discountType === 'amount'
        ? (item.discountAmount || 0)
        : (itemTotal * (item.discountPercentage || 0) / 100);
      return sum + (itemTotal - discountAmount);
    }, 0);

    const taxAmount = sale.taxRate ? (itemsTotal * sale.taxRate / 100) : 0;
    const grandTotal = itemsTotal + taxAmount;

    // Log activity with comprehensive details
    await logActivity({
      activityType: editSale ? 'UPDATE' : 'CREATE',
      module: 'SALES',
      entityType: 'sale',
      entityId: sale.id,
      entityName: `Sale #${sale.receiptNumber}`,
      description: `${editSale ? 'Updated' : 'Created'} sale for ${sale.customerName} - Total: UGX ${grandTotal.toLocaleString()}`,
      metadata: {
        receiptNumber: sale.receiptNumber,
        customerName: sale.customerName,
        customerAddress: sale.customerAddress,
        customerContact: sale.customerContact,
        totalAmount: grandTotal,
        amountPaid: sale.amountPaid,
        profit: sale.profit,
        paymentStatus: sale.paymentStatus,
        taxRate: sale.taxRate,
        itemCount: sale.items.length,
        items: sale.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost,
          total: item.quantity * item.price,
          discountPercentage: item.discountPercentage,
          discountAmount: item.discountAmount
        })),
        notes: sale.notes
      }
    });

    uiToast({
      title: editSale ? "Sale Updated" : "Sale Created",
      description: `${editSale ? "Updated" : "Created"} sale for ${sale.customerName}. ${sale.paymentStatus === 'NOT PAID' ? 'Inventory has been updated for this credit sale.' : ''}`,
    });

    // Clear sold items cache to force refresh
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('soldItems_')) {
        localStorage.removeItem(key);
      }
    });

    // Store the completed sale
    setCompletedSale(sale);

    // ⚡️ INSTANT UPDATE: Add/update sale in cache immediately (like your campaign example)
    if (editSale) {
      updateSale(sale);
    } else {
      addSale(sale);
    }

    // Store payment info preference
    setIncludePaymentInfo(includePaymentInfo);

    // Show receipt dialog if requested
    if (showReceipt) {
      setIsReceiptOpen(true);
    } else {
      // If it's a new sale and we have a success callback, use it (to clear form)
      // Otherwise navigate to sales list
      if (!editSale && onSaveSuccess) {
        onSaveSuccess();
      } else {
        navigate('/sales');
      }
    }
  }, [user?.id, createCustomer, editSale, uiToast, navigate, logActivity, addSale, updateSale, onSaveSuccess]);

  const handleReceiptClose = useCallback(() => {
    setIsReceiptOpen(false);
    // If it's a new sale and we have a success callback, use it (to clear form)
    // Otherwise navigate to sales list
    if (!editSale && onSaveSuccess) {
      onSaveSuccess();
    } else {
      navigate('/sales');
    }
  }, [navigate, editSale, onSaveSuccess]);

  const handleAddCustomer = useCallback(async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.id) return false;
    try {
      const newCustomer = await createCustomer(customerData);
      if (newCustomer) {
        setNewCustomerDialogOpen(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding customer:', error);
      return false;
    }
  }, [user?.id, createCustomer]);

  const handleOpenNewCustomerDialog = useCallback(() => {
    setNewCustomerDialogOpen(true);
  }, []);

  return {
    isReceiptOpen,
    completedSale,
    newCustomerDialogOpen,
    includePaymentInfo,
    customers,
    handleSaleComplete,
    handleReceiptClose,
    handleAddCustomer,
    handleOpenNewCustomerDialog,
    setNewCustomerDialogOpen
  };
};