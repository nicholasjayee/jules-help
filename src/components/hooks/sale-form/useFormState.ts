import { useState, useCallback } from 'react';
import { SaleFormData, FormErrors, SaleItem } from '@/components/types';

const emptyItem: SaleItem = {
  description: '',
  quantity: 1,
  price: 0,
  cost: 0,
};

interface UseFormStateProps {
  initialData?: any;
  defaultPaymentStatus: string;
}

export const useFormState = ({ initialData, defaultPaymentStatus }: UseFormStateProps) => {
  const [formData, setFormData] = useState<SaleFormData>({
    customerName: initialData?.customerName || '',
    customerAddress: initialData?.customerAddress || '',
    customerContact: initialData?.customerContact || '',
    items: initialData?.items || [{ ...emptyItem }],
    paymentStatus: defaultPaymentStatus as 'Paid' | 'NOT PAID' | 'Quote' | 'Installment Sale',
    taxRate: initialData?.taxRate || 0,
    amountPaid: (initialData && initialData.paymentStatus === 'Installment Sale') ? 0 : (initialData?.amountPaid || 0),
    amountDue: initialData?.amountDue || 0,
    notes: initialData?.notes || '',
    categoryId: initialData?.categoryId || ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [taxRateInput, setTaxRateInput] = useState<string>(
    initialData?.taxRate ? initialData.taxRate.toString() : ''
  );
  const [printAfterSave, setPrintAfterSave] = useState<boolean>(true);
  const [includePaymentInfo, setIncludePaymentInfo] = useState<boolean>(true);
  const [selectedCustomerCategoryId, setSelectedCustomerCategoryId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  
  // Cash account integration states
  const [linkToCash, setLinkToCash] = useState<boolean>(false);
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>('');
  const [cashTransactionId, setCashTransactionId] = useState<string | null>(null);
  const [originalPaymentStatus, setOriginalPaymentStatus] = useState<string>(defaultPaymentStatus);
  const [formRecentlyCleared, setFormRecentlyCleared] = useState<boolean>(false);

  const clearFormState = useCallback((onDateReset?: () => void) => {
    setFormData({
      customerName: '',
      customerAddress: '',
      customerContact: '',
      items: [{ ...emptyItem }],
      paymentStatus: defaultPaymentStatus as 'Paid' | 'NOT PAID' | 'Quote' | 'Installment Sale',
      taxRate: 0,
      amountPaid: 0,
      amountDue: 0,
      notes: '',
      categoryId: ''
    });
    setTaxRateInput('');
    setSelectedCustomerCategoryId('');
    setPaymentDate(new Date());
    setLinkToCash(false);
    setErrors({});
    setFormRecentlyCleared(true);
    if (onDateReset) {
      onDateReset();
    }
  }, [defaultPaymentStatus]);

  return {
    // State
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
    
    // Setters
    setFormData,
    setErrors,
    setTaxRateInput,
    setPrintAfterSave,
    setIncludePaymentInfo,
    setSelectedCustomerCategoryId,
    setPaymentDate,
    setLinkToCash,
    setSelectedCashAccountId,
    setCashTransactionId,
    setOriginalPaymentStatus,
    setFormRecentlyCleared,
    
    // Actions
    clearFormState,
  };
};