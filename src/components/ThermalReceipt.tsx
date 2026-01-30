
import React, { useRef, useEffect, useState } from 'react';
import { Sale, BusinessSettings } from '@/components/types';
import { format } from 'date-fns';
import { formatNumber } from '@/lib/utils';
import { parsePaymentInfo, useBusinessSettings } from '@/components/hooks/useBusinessSettings';
import { numberToWords } from '@/utils/numberToWords';
import { useInstallmentPayments } from '@/components/hooks/useInstallmentPayments';

interface ThermalReceiptProps {
  sale: Sale;
  currency?: string;
  includePaymentInfo?: boolean;
}

const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ 
  sale, 
  currency, 
  includePaymentInfo = true 
}) => {
  const { settings, isLoading: settingsLoading } = useBusinessSettings();
  const { payments } = useInstallmentPayments(sale.id);
  
  // Show loading state while business settings are being fetched
  if (settingsLoading) {
    return (
      <div className="thermal-receipt font-mono text-sm font-extrabold leading-tight bg-white p-2 flex items-center justify-center" style={{ width: '80mm', maxWidth: '302px', minHeight: '200px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <div className="text-sm">Loading receipt...</div>
        </div>
      </div>
    );
  }
  
  // Determine document title and number label based on payment status
  const getDocumentTitle = () => {
    switch (sale.paymentStatus) {
      case 'Quote':
        return 'QUOTATION';
      case 'Paid':
        return 'SALES RECEIPT';
      case 'Installment Sale':
        return 'INSTALLMENT SALE';
      case 'NOT PAID':
      default:
        return 'INVOICE';
    }
  };
  
  const getDocumentNumberLabel = () => {
    switch (sale.paymentStatus) {
      case 'Quote':
        return 'Quote #:';
      case 'Paid':
        return 'SALES RECEIPT';
      case 'Installment Sale':
        return 'Installment #:';
      case 'NOT PAID':
      default:
        return 'Invoice #:';
    }
  };
  
  const documentTitle = getDocumentTitle();
  const documentNumberLabel = getDocumentNumberLabel();

  // Calculate subtotal BEFORE discounts (raw total)
  const subtotalBeforeDiscount = sale.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calculate total discount amount
  const totalDiscountAmount = sale.items.reduce((total, item) => {
    const itemSubtotal = item.price * item.quantity;
    const discountAmount = item.discountType === 'amount' 
      ? (item.discountAmount || 0)
      : (itemSubtotal * (item.discountPercentage || 0)) / 100;
    return total + discountAmount;
  }, 0);

  // Calculate subtotal AFTER discounts
  const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;
  
  // Calculate tax amount based on taxRate (default to 0 if not present)
  const taxRate = sale.taxRate || 0;
  const taxAmount = subtotalAfterDiscount * (taxRate / 100);
  
  // Total amount including tax
  const totalAmount = subtotalAfterDiscount + taxAmount;

  // For installment sales, use payment history total; for others use the provided amounts
  const totalPaidFromHistory = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const displayAmountPaid = sale.paymentStatus === 'Installment Sale' || (sale.paymentStatus === 'Paid' && totalPaidFromHistory > 0)
    ? totalPaidFromHistory 
    : (sale.amountPaid || totalAmount);
  const displayAmountDue = sale.paymentStatus === 'Installment Sale' 
    ? Math.max(0, totalAmount - totalPaidFromHistory)
    : (sale.amountDue || 0);
  const isInstallmentSale = sale.paymentStatus === 'Installment Sale';

  // Get the total amount in words
  const totalAmountInWords = numberToWords(totalAmount);

  // Check if we should show the tax row
  const showTaxRow = taxRate > 0;

  // Parse payment info into structured format
  const paymentMethods = settings.paymentInfo ? parsePaymentInfo(settings.paymentInfo) : [];
  const hasPaymentInfo = includePaymentInfo && 
    paymentMethods.length > 0 && 
    paymentMethods.some(pm => pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== '');

  // Use the currency prop if provided, otherwise use the one from settings
  const displayCurrency = currency || settings.currency;

  // Get the receipt date and current time for display
  const receiptDate = new Date(sale.date);
  const currentDateTime = new Date(); // Use current time for receipt generation

  // Helper function to pad strings for alignment
  const padLine = (left: string, right: string, totalWidth: number = 32) => {
    const rightPadded = right.padStart(totalWidth - left.length);
    return left + rightPadded;
  };

  // Helper function to center text
  const centerText = (text: string, totalWidth: number = 32) => {
    const padding = Math.max(0, Math.floor((totalWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  };

  return (
    <div className="thermal-receipt font-mono text-sm font-extrabold leading-tight bg-white p-2" style={{ width: '80mm', maxWidth: '302px' }}>
      {/* Business Header */}
      <div className="text-center mb-2">
        {settings.businessLogo && (
          <div className="flex justify-center mb-1">
            <img
              src={settings.businessLogo}
              alt="Business Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
        )}
        <div className="font-extrabold text-base">{settings.businessName}</div>
        <div className="text-sm font-bold">{settings.businessAddress}</div>
        <div className="text-sm font-bold">Tel: {settings.businessPhone}</div>
        <div className="text-sm font-bold">{settings.businessEmail}</div>
      </div>
      
      {/* Separator */}
      <div className="text-center my-2">{'='.repeat(32)}</div>

      {/* Document Title */}
      <div className="text-center font-extrabold text-lg mb-2">
        {documentTitle}
      </div>

      {/* Receipt Details */}
      <div className="mb-2">
        <div className="font-extrabold">{documentNumberLabel} {sale.receiptNumber}</div>
        <div className="font-bold">Date: {format(receiptDate, 'MMM dd, yyyy')}</div>
        <div className="font-bold">Time: {format(currentDateTime, 'hh:mm a')}</div>
        <div className="font-bold">Status: {sale.paymentStatus}</div>
      </div>

      {/* Customer Information */}
      <div className="mb-2">
        <div className="font-extrabold">Customer:</div>
        <div className="font-bold">{sale.customerName}</div>
        <div className="font-bold">{sale.customerAddress}</div>
        <div className="font-bold">{sale.customerContact}</div>
      </div>

      {/* Separator */}
      <div className="my-2">{'='.repeat(32)}</div>

      {/* Items Header */}
      <div className="font-extrabold mb-1">
        <div>Item                    Qty  Price</div>
        <div>{'-'.repeat(32)}</div>
      </div>

      {/* Items */}
      <div className="mb-2">
        {sale.items.map((item, index) => {
          const itemSubtotal = item.quantity * item.price;
          const discountAmount = item.discountType === 'amount' 
            ? (item.discountAmount || 0)
            : (itemSubtotal * (item.discountPercentage || 0)) / 100;
          const finalAmount = itemSubtotal - discountAmount;
          
          return (
            <div key={index} className="mb-1">
              <div className="font-bold">{item.description}</div>
              <div className="flex justify-between font-extrabold">
                <span>{formatNumber(item.quantity)} x {displayCurrency} {formatNumber(item.price)}</span>
                <span>{displayCurrency} {formatNumber(finalAmount)}</span>
              </div>
              {((item.discountPercentage || 0) > 0 || (item.discountAmount || 0) > 0) && (
                <div className="text-sm text-gray-600 flex justify-between font-bold">
                  <span>
                    Discount {item.discountType === 'amount' 
                      ? '' 
                      : `(${item.discountPercentage}%)`}
                  </span>
                  <span>-{displayCurrency} {formatNumber(discountAmount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Separator */}
      <div className="my-2">{'-'.repeat(32)}</div>

      {/* Totals */}
      <div className="mb-2">
        {totalDiscountAmount > 0 ? (
          <>
            <div className="flex justify-between font-bold">
              <span>Subtotal (before discount):</span>
              <span>{displayCurrency} {formatNumber(subtotalBeforeDiscount)}</span>
            </div>
            <div className="flex justify-between text-orange-600 font-bold">
              <span>Total Discount:</span>
              <span>-{displayCurrency} {formatNumber(totalDiscountAmount)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Subtotal (after discount):</span>
              <span>{displayCurrency} {formatNumber(subtotalAfterDiscount)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between font-bold">
            <span>Subtotal:</span>
            <span>{displayCurrency} {formatNumber(subtotalBeforeDiscount)}</span>
          </div>
        )}
        {showTaxRow && (
          <div className="flex justify-between font-bold">
            <span>Tax ({taxRate}%):</span>
            <span>{displayCurrency} {formatNumber(taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-base border-t border-black pt-1">
          <span>TOTAL:</span>
          <span>{displayCurrency} {formatNumber(totalAmount)}</span>
        </div>
        {isInstallmentSale && (
          <>
            <div className="flex justify-between font-extrabold text-sm border-t border-black pt-1">
              <span>Amount Paid:</span>
              <span>{displayCurrency} {formatNumber(displayAmountPaid)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm text-red-600">
              <span>Amount Due:</span>
              <span>{displayCurrency} {formatNumber(displayAmountDue)}</span>
            </div>
          </>
        )}
      </div>

      {/* Amount in words */}
      <div className="mb-2 text-sm">
        <div className="font-extrabold">Amount in words:</div>
        <div className="font-bold">{displayCurrency} {totalAmountInWords} only</div>
      </div>

      {/* Payment Information */}
      {hasPaymentInfo && (
        <div className="mb-2">
          <div className="font-extrabold mb-1">Payment Info:</div>
          {paymentMethods
            .filter(payment => payment.method.trim() !== '' || payment.accountNumber.trim() !== '' || payment.accountName.trim() !== '')
            .map((payment, index) => (
              <div key={index} className="mb-1 text-sm">
                <div className="font-bold">{payment.method}</div>
                <div className="font-bold">Acc: {payment.accountNumber}</div>
                <div className="font-bold">Name: {payment.accountName}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* Notes */}
      {sale.notes && (
        <div className="mb-2">
          <div className="font-extrabold mb-1">Notes:</div>
          <div className="text-sm whitespace-pre-wrap font-bold">{sale.notes}</div>
        </div>
      )}

      {/* Signature */}
      {settings.signature && (
        <div className="text-center mb-2">
          <img 
            src={settings.signature} 
            alt="Signature" 
            className="h-10 mx-auto object-contain"
          />
          <div className="text-sm mt-1 font-bold">Authorized Signature</div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-4">
        <div className="font-extrabold text-sm">Thank you for your business!</div>
        <div className="text-sm mt-2 font-bold">Created by Gonza Systems</div>
      </div>

      {/* Final separator */}
      <div className="text-center mt-2">{'='.repeat(32)}</div>
    </div>
  );
};

export default ThermalReceipt;
