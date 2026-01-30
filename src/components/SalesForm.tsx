// SalesForm.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Sale, SaleFormData, SaleItem, mapSaleToDbSale, Customer } from '@/components/types/index';
import { useAuth } from '@/components/auth/AuthProvider';
import { calculateProfit } from '@/utils/calculateProfit';
import { generateReceiptNumber } from '@/components/utils/generateReceiptNumber';
import { dataStore } from '@/lib/dataStore';
import { useBusinessSettings } from '@/components/hooks/useBusinessSettings';
import { useProducts } from '@/components/hooks/useProducts';
import { useSaleProductSelection } from '@/components/hooks/useSaleProductSelection';
import { useCashAccounts } from '@/components/hooks/useCashAccounts';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useSaleDraft } from '@/components/hooks/useSaleDraft';
import { useSaleFormLogic } from '@/components/hooks/useSaleFormLogic';
import { useCashTransactionOperations } from '@/components/hooks/useCashTransactionOperations';
import { useInstallmentPayments } from '@/components/hooks/useInstallmentPayments';
import { useStockHistory } from '@/components/hooks/useStockHistory';
import { useMessages } from '@/components/hooks/useMessages'; // This is the key fix!

// Components
import SaleFormHeader from '@/components/sales/SaleFormHeader';
import SaleItemsManager from '@/components/sales/SaleItemsManager';
import SalePaymentSection from '@/components/sales/SalePaymentSection';
import SaleFormActions from '@/components/sales/SaleFormActions';
import SaleCategorySelector from '@/components/sales/SaleCategorySelector';

interface SalesFormProps {
  initialData?: Sale;
  onSaleComplete?: (sale: Sale, showReceipt?: boolean, includePaymentInfo?: boolean, selectedCustomerCategoryId?: string, onClearDraft?: () => void, saleDate?: Date) => void;
  currency?: string;
  customers?: Customer[];
  onAddNewCustomer?: () => void;
  draftData?: any;
  onClearDraft?: () => void;
}

const SalesForm: React.FC<SalesFormProps> = ({
  initialData,
  onSaleComplete,
  currency = 'USD',
  customers = [],
  onAddNewCustomer,
  draftData,
  onClearDraft,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(initialData?.date || new Date());

  // Handle default payment status from props or URL params
  const defaultPaymentStatus = initialData?.paymentStatus ||
    (searchParams?.get('defaultPaymentStatus') as 'Paid' | 'NOT PAID' | 'Quote' | 'Installment Sale') ||
    'Paid';

  const { settings } = useBusinessSettings();
  const { user } = useAuth();
  const { updateInventoryForSale, updateInventoryForEditedSale } = useSaleProductSelection(user?.id);
  const { accounts: cashAccounts } = useCashAccounts();
  const { currentBusiness } = useBusiness();
  const { saveDraft } = useSaleDraft();
  const { updateStockHistoryDatesBySaleId } = useStockHistory(user?.id);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const isClearingRef = useRef(false);

  const [isSubmitted, setIsSubmitted] = useState(false);

  // Key: Use the proper messaging hook
  const { createMessage, templates = [] } = useMessages(user?.id);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendSMS, setSendSMS] = useState(true);

  // Comprehensive default SMS template
  // Comprehensive default SMS template
  const defaultSMSTemplate = "Thank you for your purchase from {business_name} We truly appreciate your support and trust in our Business. If you need any assistance or have any questions about your order, please feel free to reach out, on {business_number} We look forward to serving you again!";

  const [smsMessage, setSMSMessage] = useState(defaultSMSTemplate);

  // Custom hooks
  const {
    formData,
    errors,
    taxRateInput,
    printAfterSave,
    includePaymentInfo,
    selectedCustomerCategoryId,
    paymentDate,
    linkToCash,
    selectedCashAccountId,
    cashTransactionId,
    originalPaymentStatus,
    formRecentlyCleared,
    payments,
    pendingChanges,
    hasChanges,
    setFormData,
    setTaxRateInput,
    setPrintAfterSave,
    setIncludePaymentInfo,
    setLinkToCash,
    setSelectedCashAccountId,
    setCashTransactionId,
    setOriginalPaymentStatus,
    handleChange,
    handleSelectChange,
    handleAddItem,
    handleUpdateItem,
    handleRemoveItem,
    handleSelectCustomer,
    handleCategoryChange,
    handleSalesCategoryChange,
    handleAmountPaidChange,
    handlePaymentDateChange,
    calculateTotalAmount,
    calculateTaxAmount,
    validateForm,
    processPendingPaymentChanges,
    createInstallmentPayment,
    updateInstallmentPayment,
    deleteInstallmentPayment,
    addPaymentChange,
    clearChanges,
    getModifiedPayments,
    clearForm,
  } = useSaleFormLogic({
    initialData,
    defaultPaymentStatus,
    cashAccounts
  });

  const {
    createCashTransactionForSale,
    updateCashTransactionForSale,
    createInstallmentPaymentWithCash,
    findCashTransactionForSale,
  } = useCashTransactionOperations();

  const {
    payments: installmentPayments,
    linkPaymentToCashAccount,
    unlinkPaymentFromCashAccount,
    updatePayment: updatePaymentOriginal
  } = useInstallmentPayments(initialData?.id);

  const updatePayment = async (paymentId: string, updates: { amount?: number; notes?: string; paymentDate?: Date }) => {
    await updatePaymentOriginal(paymentId, updates);
  };

  const [saleCompleted, setSaleCompleted] = useState(false);

  // Wrapper for clear form to manage the ref and prevent race conditions
  const handleClearForm = () => {
    isClearingRef.current = true;
    if (clearForm) {
      clearForm(() => setSelectedDate(new Date()), onClearDraft);
    }
  };

  // Reset ref after render
  useEffect(() => {
    isClearingRef.current = false;
  });

  // Auto-save draft
  const autoSaveDraft = React.useCallback(() => {
    // Check ref to prevent saving during clear operation
    if (isClearingRef.current) return;

    if (!initialData && !loading && !saleCompleted && !formRecentlyCleared) {
      const hasData = formData.customerName.trim() ||
        formData.customerAddress.trim() ||
        formData.customerContact.trim() ||
        formData.items.some(item => item.description.trim() || item.quantity !== 1 || item.price !== 0);

      if (hasData) {
        saveDraft(formData, selectedDate);
      }
    }
  }, [formData, selectedDate, initialData, loading, saveDraft, saleCompleted, formRecentlyCleared]);

  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(autoSaveDraft, 2000);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveDraft(); // Save on unmount to capture data before navigation
    };
  }, [autoSaveDraft]);

  useEffect(() => {
    const handleBeforeUnload = () => autoSaveDraft();
    const handleVisibilityChange = () => document.hidden && autoSaveDraft();
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSaveDraft]);

  useEffect(() => {
    if (draftData && !initialData) {
      setFormData(draftData.formData);
      setSelectedDate(draftData.selectedDate);
      setTaxRateInput(draftData.formData.taxRate?.toString() || '');
      // Removed onClearDraft call to keep draft until sale is saved/completed
    }
  }, [draftData, initialData, setFormData, setTaxRateInput]);

  useEffect(() => {
    (async () => {
      if (initialData?.cashTransactionId) {
        setLinkToCash(true);
        setCashTransactionId(initialData.cashTransactionId);
        const accountId = await findCashTransactionForSale(initialData.cashTransactionId);
        if (accountId) setSelectedCashAccountId(accountId);
      }
      if (cashAccounts.length > 0 && !selectedCashAccountId && !initialData?.cashTransactionId) {
        const defaultAccount = cashAccounts.find(acc => acc.isDefault) || cashAccounts[0];
        setSelectedCashAccountId(defaultAccount.id);
      }
    })();
  }, [initialData, cashAccounts, findCashTransactionForSale, setSelectedCashAccountId]);

  const calculateTotalProfit = (items: SaleItem[]) => {
    return items.reduce((total, item) => {
      // Calculate the effective price after discount (same logic as revenue calculation)
      const subtotal = item.price * item.quantity;
      const discountAmount = item.discountType === 'amount'
        ? (item.discountAmount || 0)
        : (subtotal * (item.discountPercentage || 0)) / 100;
      const effectiveRevenue = subtotal - discountAmount;
      const totalCost = item.cost * item.quantity;
      const itemProfit = effectiveRevenue - totalCost;

      return total + itemProfit;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalAmount = calculateTotalAmount(formData.items);
    const taxAmount = calculateTaxAmount(totalAmount);
    const grandTotal = totalAmount + taxAmount;

    if (!validateForm(grandTotal, selectedDate)) {
      // Show specific error from errors object if available
      if (errors.customerName) {
        toast.error(errors.customerName);
      } else if (errors.taxRate) {
        toast.error(errors.taxRate);
      } else {
        toast.error('Please fill in all required fields correctly');
      }
      return;
    }

    if (formData.items.length === 0 || formData.items.every(item => !item.description.trim())) {
      toast.error('Please add at least one valid item');
      return;
    }

    setLoading(true);
    try {
      let receiptNumber = initialData?.receiptNumber || await generateReceiptNumber(currentBusiness?.id || '');
      const profit = calculateTotalProfit(formData.items);
      let finalCashTransactionId = cashTransactionId;

      if (initialData) {
        finalCashTransactionId = await updateCashTransactionForSale(
          { id: initialData.id, customerName: formData.customerName, receiptNumber: initialData.receiptNumber, items: formData.items },
          grandTotal, cashTransactionId, originalPaymentStatus, formData.paymentStatus, linkToCash, selectedCashAccountId, selectedDate
        );
        setCashTransactionId(finalCashTransactionId);
      }

      const saleDbData = mapSaleToDbSale(
        formData,
        selectedDate,
        profit,
        receiptNumber,
        user?.id || '',
        currentBusiness?.id || '',
        finalCashTransactionId
      );

      let sale: Sale;

      if (initialData) {
        const result = await dataStore.updateSale(initialData.id, {
            ...formData,
            date: selectedDate,
            profit,
            receiptNumber,
            cashTransactionId: finalCashTransactionId
        });
        if (!result) throw new Error('Failed to update sale');
        sale = result;
      } else {
        const newSale: Sale = {
            id: `sale-${Date.now()}`,
            receiptNumber,
            customerName: formData.customerName,
            customerAddress: formData.customerAddress,
            customerContact: formData.customerContact,
            items: formData.items,
            paymentStatus: formData.paymentStatus,
            profit,
            date: selectedDate,
            taxRate: formData.taxRate,
            cashTransactionId: finalCashTransactionId || undefined,
            amountPaid: formData.amountPaid,
            amountDue: formData.amountDue,
            notes: formData.notes,
            createdAt: new Date(),
            categoryId: formData.categoryId
        };
        const result = await dataStore.createSale(newSale);
        sale = result;
      }

      // Handle inventory, payments, etc.
      if (initialData) {
        // Inventory updates for edits are now handled in onSaleComplete callback in useNewSaleActions.ts
        // This prevents double deduction bug where stock was reduced twice for edited sales

        if (hasChanges) await processPendingPaymentChanges();
        if (formData.paymentStatus === 'Installment Sale' && formData.amountPaid) {
          await createInstallmentPayment({ saleId: sale.id, amount: formData.amountPaid, notes: sale.items.map(i => i.description).join(', '), paymentDate, accountId: linkToCash ? selectedCashAccountId : undefined, locationId: currentBusiness?.id });
          setFormData(prev => ({ ...prev, amountPaid: 0 }));
        }


        if (initialData.date.getTime() !== selectedDate.getTime()) {
          await updateStockHistoryDatesBySaleId(sale.id, selectedDate);
        }
      } else {
        const newCashId = await createCashTransactionForSale(sale, grandTotal, linkToCash, selectedCashAccountId, selectedDate, formData.paymentStatus);
        if (newCashId) {
          await dataStore.updateSale(sale.id, { cashTransactionId: newCashId });
          sale.cashTransactionId = newCashId;
        }
        if (formData.paymentStatus === 'Installment Sale' && formData.amountPaid) {
          await createInstallmentPaymentWithCash(sale.id, formData.amountPaid, sale.items.map(i => i.description).join(', '), linkToCash, selectedCashAccountId, currentBusiness?.id || '', createInstallmentPayment);
        }
        // Inventory update removed from here - it's handled by onSaleComplete callback in useNewSaleActions.ts
        // This prevents double deduction bug where stock was reduced twice for new sales
      }

      // Clear draft
      if (draftData && onClearDraft) onClearDraft();

      // IMPORTANT: execute onSaleComplete (which updates inventory) BEFORE showing success
      // If inventory fails, it will throw, identifying the sale as failed
      if (onSaleComplete) {
        await onSaleComplete(sale, printAfterSave, includePaymentInfo, selectedCustomerCategoryId, undefined, selectedDate);
      }

      toast.success(initialData ? 'Sale updated successfully!' : 'Sale recorded successfully!');

      // Send Thank You SMS with comprehensive template
      if (sendSMS && formData.customerContact && !initialData) {
        // Generate items list
        const itemsList = formData.items
          .map(item => `• ${item.description} (Qty: ${item.quantity})`)
          .join('\r\n');

        const personalizedMessage = smsMessage
          .replace(/\{customer_name\}/gi, formData.customerName || 'Valued Customer')
          .replace(/\{receipt_number\}/gi, sale.receiptNumber)
          .replace(/\{items_list\}/gi, itemsList)
          .replace(/\{currency\}/gi, settings.currency || 'UGX')
          .replace(/\{amount\}/gi, grandTotal.toLocaleString())
          .replace(/\{business_contact\}/gi, settings.businessPhone || 'our office')
          .replace(/\{business_name\}/gi, currentBusiness?.name || 'Our Business');

        try {
          await createMessage({
            phoneNumber: formData.customerContact,
            content: personalizedMessage,
            customerId: customers.find(c => c.phoneNumber === formData.customerContact)?.id,
            metadata: { sale_id: sale.id, receipt_number: sale.receiptNumber, type: 'thank_you' }
          });
          toast.success('Thank you SMS sent successfully!');
        } catch (smsError: any) {
          toast.error('Sale saved, but failed to send SMS: ' + smsError.message);
        }
      }

      setSaleCompleted(true);
      setIsSubmitted(true);

      setSaleCompleted(true);
      setIsSubmitted(true);

      if (!onSaleComplete) {
        router.push('/sales');
      }

    } catch (error: any) {
      console.error('Error submitting sale:', error);
      setIsSubmitted(false);
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ⚡️ Performance: Memoize expensive calculations to prevent recomputing on every render
  const totalAmount = useMemo(
    () => calculateTotalAmount(formData.items),
    [formData.items]
  );

  const taxAmount = useMemo(
    () => calculateTaxAmount(totalAmount),
    [totalAmount, formData.taxRate]
  );

  const grandTotal = useMemo(
    () => totalAmount + taxAmount,
    [totalAmount, taxAmount]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SaleFormHeader
        isEditing={!!initialData}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        customerName={formData.customerName}
        customerAddress={formData.customerAddress}
        customerContact={formData.customerContact}
        notes={formData.notes}
        onCustomerInfoChange={handleChange}
        errors={errors}
        customers={customers}
        onAddNewCustomer={onAddNewCustomer}
        onSelectCustomer={handleSelectCustomer}
        selectedCategoryId={selectedCustomerCategoryId}
        onCategoryChange={handleCategoryChange}
        onClearForm={!initialData ? handleClearForm : undefined}
      />

      <SaleCategorySelector value={formData.categoryId} onChange={handleSalesCategoryChange} />

      <SaleItemsManager
        items={formData.items}
        onAddItem={handleAddItem}
        onUpdateItem={handleUpdateItem}
        onRemoveItem={handleRemoveItem}
        taxRateInput={taxRateInput}
        onTaxRateChange={handleChange}
        errors={errors}
        totalAmount={totalAmount}
        taxAmount={taxAmount}
        grandTotal={grandTotal}
        taxRate={formData.taxRate}
        currency={settings.currency}
        saleDate={selectedDate.toISOString()}
      />

      <SalePaymentSection
        paymentStatus={formData.paymentStatus}
        onPaymentStatusChange={handleSelectChange}
        isInstallmentSale={formData.paymentStatus === 'Installment Sale'}
        amountPaid={formData.amountPaid || 0}
        amountDue={formData.amountDue || 0}
        grandTotal={grandTotal}
        currency={settings.currency}
        onAmountPaidChange={(amount) => handleAmountPaidChange(amount, grandTotal)}
        onPaymentDateChange={handlePaymentDateChange}
        paymentDate={paymentDate}
        saleId={initialData?.id}
        isEditing={!!initialData}
        payments={getModifiedPayments(payments)}
        pendingChanges={pendingChanges}
        onStagePaymentChange={initialData ? addPaymentChange : undefined}
        linkToCash={linkToCash}
        onLinkToCashChange={setLinkToCash}
        selectedCashAccountId={selectedCashAccountId}
        onCashAccountChange={setSelectedCashAccountId}
        cashAccounts={cashAccounts}
        hasPaidWithHistory={formData.paymentStatus === 'Paid' && payments.length > 0}
        onLinkPaymentToCash={linkPaymentToCashAccount}
        onUpdatePayment={updatePayment}
        onPaymentStatusChangeFromInstallment={async (newStatus) => handleSelectChange(newStatus)}
        notes={formData.notes}
        onNotesChange={handleChange}
        categoryId={formData.categoryId}
        onCategoryChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
      />

      <SaleFormActions
        loading={loading}
        isEditing={!!initialData}
        onCancel={() => router.push('/sales')}
        onClearForm={!initialData ? handleClearForm : undefined}
        printAfterSave={printAfterSave}
        onPrintAfterSaveChange={setPrintAfterSave}
        paymentStatus={formData.paymentStatus}
        includePaymentInfo={includePaymentInfo}
        onIncludePaymentInfoChange={setIncludePaymentInfo}
        hasPendingPaymentChanges={hasChanges}
        sendSMS={sendSMS}
        onSendSMSChange={setSendSMS}
        smsMessage={smsMessage}
        onSMSMessageChange={setSMSMessage}
        customerHasPhone={!!formData.customerContact}
        customerName={formData.customerName}
        disabled={isSubmitted}
      />

    </form>
  );
};

export default SalesForm;