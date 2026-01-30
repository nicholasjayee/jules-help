
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/hooks/use-toast';
import { useCustomers, Customer } from '@/components/hooks/useCustomers';
import { useSalesData } from '@/components/hooks/useSalesData';
import { useSaleProductSelection } from '@/components/hooks/useSaleProductSelection';
import { Sale } from '@/components/types/index';
import { toast } from 'sonner';
import { useActivityLogger } from '@/components/hooks/useActivityLogger';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { dataStore } from '@/lib/dataStore';

export const useNewSaleActions = (editSale?: Sale, onSaveSuccess?: () => void) => {
  const router = useRouter();
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
      const existingCustomers = (await dataStore.getCustomers(user.id))
        .filter(c => c.fullName.toLowerCase() === sale.customerName.trim().toLowerCase());

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
        customerId = existingCustomers[0].id;
      }

      // If we have a valid customerId, update the sale with it
      if (customerId && sale.id) {
        try {
          await dataStore.updateSale(sale.id, { customerId });
        } catch (error) {
          console.error('Error associating sale with customer:', error);
        }
      }
    }

    // Inventory update logic (simulated in dummy data via createSale/updateSale logic mostly,
    // but hooks handle it more granularly).
    // For now we assume hooks work or are stubbed.

    // ... skipping complex rollback logic for dummy data ...

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

    uiToast({
      title: editSale ? "Sale Updated" : "Sale Created",
      description: `${editSale ? "Updated" : "Created"} sale for ${sale.customerName}.`,
    });

    // Clear sold items cache to force refresh
    if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
        if (key.startsWith('soldItems_')) {
            localStorage.removeItem(key);
        }
        });
    }

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
        router.push('/sales');
      }
    }
  }, [user?.id, createCustomer, editSale, uiToast, router, logActivity, addSale, updateSale, onSaveSuccess]);

  const handleReceiptClose = useCallback(() => {
    setIsReceiptOpen(false);
    // If it's a new sale and we have a success callback, use it (to clear form)
    // Otherwise navigate to sales list
    if (!editSale && onSaveSuccess) {
      onSaveSuccess();
    } else {
      router.push('/sales');
    }
  }, [router, editSale, onSaveSuccess]);

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
