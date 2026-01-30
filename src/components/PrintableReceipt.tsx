import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sale, BusinessSettings } from '@/types';
import { generatePDF } from '@/utils/generatePDF';
import { directPrint } from '@/utils/directPrint';
import { format } from 'date-fns';
import { Printer, Download, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parsePaymentInfo, useBusinessSettings } from '@/hooks/useBusinessSettings';
import { numberToWords } from '@/utils/numberToWords';
import { useIsMobile } from '@/hooks/use-mobile';
import { isIOS, isAndroid } from '@/utils/deviceDetection';
import ThermalReceipt from './ThermalReceipt';
import { toast } from 'sonner';
import { useInstallmentPayments } from '@/hooks/useInstallmentPayments';
import { print } from "@/utils/thermalPrinterPlug";
import { generateThermalText } from "@/utils/generateThermalText";

interface PrintableReceiptProps {
  sale: Sale;
  currency?: string;
  isMobile?: boolean;
  includePaymentInfo?: boolean;
}

type ReceiptType = 'standard' | 'thermal';

const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  sale,
  currency,
  isMobile,
  includePaymentInfo = true
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const thermalReceiptRef = useRef<HTMLDivElement>(null);
  const { settings, isLoading: settingsLoading } = useBusinessSettings();
  const { payments } = useInstallmentPayments(sale.id);
  const [receiptType, setReceiptType] = useState<ReceiptType>('standard');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const isMobileDevice = useIsMobile();

  // Update receipt type when settings are loaded
  useEffect(() => {
    if (settings.defaultPrintFormat) {
      setReceiptType(settings.defaultPrintFormat);
    }
  }, [settings.defaultPrintFormat]);

  // Determine document title based on payment status
  const getDocumentTitle = () => {
    switch (sale.paymentStatus) {
      case 'Quote':
        return 'QUOTATION';
      case 'Paid':
        return 'SALES RECEIPT';
      case 'Installment Sale':
        return 'INVOICE';
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
        return 'Receipt #:';
      case 'Installment Sale':
        return 'Installment #:';
      case 'NOT PAID':
      default:
        return 'Invoice #:';
    }
  };

  const documentTitle = getDocumentTitle();
  const documentNumberLabel = getDocumentNumberLabel();

  // Calculate subtotal with discounts
  const subtotal = sale.items.reduce((total, item) => {
    const itemSubtotal = item.price * item.quantity;
    const discountAmount = item.discountType === 'amount'
      ? (item.discountAmount || 0)
      : (itemSubtotal * (item.discountPercentage || 0)) / 100;
    return total + (itemSubtotal - discountAmount);
  }, 0);

  // Calculate tax amount based on taxRate (default to 0 if not present)
  const taxRate = sale.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);

  // Total amount including tax
  const totalAmount = subtotal + taxAmount;

  // For installment sales, use payment history total; for others use the provided amounts
  const totalPaidFromHistory = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const displayAmountPaid = sale.paymentStatus === 'Installment Sale' || (sale.paymentStatus === 'Paid' && totalPaidFromHistory > 0)
    ? totalPaidFromHistory
    : (sale.amountPaid || totalAmount);
  const displayAmountDue = sale.paymentStatus === 'Installment Sale'
    ? Math.max(0, totalAmount - totalPaidFromHistory)
    : (sale.amountDue || 0);

  // Get the total amount in words
  const totalAmountInWords = numberToWords(totalAmount);

  // Check if we should show the tax row
  const showTaxRow = taxRate > 0;

  // Check if this is an installment sale
  const isInstallmentSale = sale.paymentStatus === 'Installment Sale';

  // Parse payment info into structured format
  const paymentMethods = settings.paymentInfo ? parsePaymentInfo(settings.paymentInfo) : [];
  // Only show payment methods table if there are valid payment methods AND includePaymentInfo is true
  const hasPaymentInfo = includePaymentInfo &&
    paymentMethods.length > 0 &&
    paymentMethods.some(pm => pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== '');

  // Use the currency prop if provided, otherwise use the one from settings
  const displayCurrency = currency || settings.currency;

  // Check if device is iOS or Android
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();

  // Get the receipt date and current time for display
  const receiptDate = new Date(sale.date);
  const currentDateTime = new Date();

  // Helper function to create structured receipt data
  const createReceiptData = () => {
    const receiptDate = new Date(sale.date);
    const currentDateTime = new Date();
    const paymentMethods = settings.paymentInfo ? parsePaymentInfo(settings.paymentInfo) : [];
    const hasPaymentInfo = includePaymentInfo &&
      paymentMethods.length > 0 &&
      paymentMethods.some(pm => pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== '');

    return {
      documentTitle: getDocumentTitle(),
      documentNumberLabel: getDocumentNumberLabel(),
      receiptNumber: sale.receiptNumber,
      date: format(receiptDate, 'MMM dd, yyyy'),
      time: format(currentDateTime, 'hh:mm a'),
      status: sale.paymentStatus,
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      businessPhone: settings.businessPhone,
      businessEmail: settings.businessEmail,
      businessLogo: settings.businessLogo,
      signature: settings.signature,
      customerName: sale.customerName,
      customerAddress: sale.customerAddress,
      customerContact: sale.customerContact,
      items: sale.items.map(item => {
        const itemSubtotal = item.quantity * item.price;
        const discountAmount = item.discountType === 'amount'
          ? (item.discountAmount || 0)
          : (itemSubtotal * (item.discountPercentage || 0)) / 100;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.price,
          discountPercentage: item.discountPercentage || 0,
          discountAmount,
          discountType: item.discountType || 'percentage',
          amount: itemSubtotal - discountAmount
        };
      }),
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      amountPaid: displayAmountPaid,
      amountDue: displayAmountDue,
      isInstallmentSale,
      totalAmountInWords,
      paymentMethods: hasPaymentInfo ? paymentMethods.filter(pm =>
        pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== ''
      ) : undefined,
      currency: displayCurrency,
      showTaxRow,
      hasPaymentInfo,
      notes: sale.notes
    };
  };

  // Optimized download handler with vector PDF for standard receipts
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;

    setIsDownloading(true);

    try {
      toast.success('Preparing download...');

      const filePrefix = sale.paymentStatus === 'Quote'
        ? 'Quote'
        : (sale.paymentStatus === 'Paid' ? 'Receipt' : 'Invoice');

      const fileName = receiptType === 'thermal'
        ? `${filePrefix}_Thermal-${sale.receiptNumber}.pdf`
        : `${filePrefix}-${sale.receiptNumber}.pdf`;

      if (receiptType === 'standard') {
        // Use new vector PDF generation for standard receipts
        const { generateReceiptVectorPDF } = await import('@/utils/generateReceiptVectorPDF');
        const receiptData = createReceiptData();
        await generateReceiptVectorPDF(receiptData, {
          filename: fileName,
          orientation: 'portrait',
          format: 'a4',
          margins: { top: 20, right: 20, bottom: 20, left: 20 }
        });
      } else {
        // Use existing method for thermal receipts
        await generatePDF(receiptRef.current, fileName, { isReceipt: true });
      }

      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share handle share
  const handleShare = async () => {
    try {
      const { generateReceiptVectorPDF } = await import('@/utils/generateReceiptVectorPDF');
      const receiptData = createReceiptData();
      const pdfBlob = await generateReceiptVectorPDF(receiptData, { returnBlob: true });
      if (!pdfBlob) return;

      // 🔹 Use dynamic prefix same as download
      const filePrefix =
        sale.paymentStatus === 'Quote'
          ? 'Quotation'
          : sale.paymentStatus === 'Paid'
            ? 'Receipt'
            : 'Invoice';

      const fileName = `${filePrefix}-${sale.receiptNumber}.pdf`;

      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${filePrefix} - ${sale.receiptNumber}`,
          text: `${filePrefix} #${sale.receiptNumber}`,
        });
        toast.success(`${filePrefix} shared successfully!`);
      } else {
        toast.error('Sharing not supported on this device.');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      toast.error('Failed to share document.');
    }
  };

  // Optimized print handler with PDF generation for desktop
  const handlePrint = async () => {
    const printElement =
      receiptType === 'thermal' ? thermalReceiptRef.current : receiptRef.current;
    if (!printElement) return;

    setIsPrinting(true);

    try {
      if (receiptType === 'thermal') {
        const textData = generateThermalText(sale, settings, displayCurrency);

        // Always use public API
        const result = await print(textData);
        const { success, message } = result || { success: false, message: 'Unknown print error' };

        success ? toast.success(message) : toast.error(message);
        return;
      }

      toast.success('Preparing receipt for printing...');

      if (isMobileDevice) {
        const baseDocumentName =
          sale.paymentStatus === 'Quote'
            ? 'Quotation'
            : sale.paymentStatus === 'Paid'
              ? 'Receipt'
              : 'Invoice';

        directPrint(printElement, baseDocumentName);
        toast.success('Print dialog opened!');
      } else {
        const { generateReceiptVectorPDF } = await import(
          '@/utils/generateReceiptVectorPDF'
        );
        const receiptData = createReceiptData();
        const pdfBlob = await generateReceiptVectorPDF(receiptData, {
          returnBlob: true,
        });

        if (pdfBlob) {
          const blobUrl = URL.createObjectURL(pdfBlob);
          const printWindow = window.open(blobUrl, '_blank');

          if (printWindow) {
            printWindow.addEventListener('load', () => {
              setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.addEventListener('afterprint', () => printWindow.close());
              }, 500);
            });
          }

          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        }

        toast.success('Print dialog opened!');
      }
    } catch (error: any) {
      console.error('Error printing receipt:', error);
      toast.error(error?.message || 'Failed to print receipt. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };


  // Show loading state while business settings are loading
  if (settingsLoading) {
    return (
      <div className={`bg-white ${isMobile ? 'p-2' : 'p-6'} rounded-lg shadow-md`}>
        <div className="mb-4 flex justify-between items-center flex-wrap">
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-sales-primary`}>{documentTitle}</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading business settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white ${isMobile ? 'p-2' : 'p-6'} rounded-lg shadow-md`}>
      <div className="mb-4 flex justify-between items-center flex-wrap">
        <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-sales-primary`}>{documentTitle}</h2>

        <div className="print:hidden flex space-x-2 mt-2 sm:mt-0">
          {/* Print button for all devices */}
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={handlePrint}
            disabled={isPrinting || isDownloading}
            className="flex items-center"
          >
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {isPrinting ? 'Processing...' : 'Print'}
          </Button>

          {/* Download PDF button */}
          <Button
            variant="default"
            size={isMobile ? "sm" : "default"}
            onClick={handleDownloadPDF}
            disabled={isPrinting || isDownloading}
            className="flex items-center"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </Button>
          {/* Share Button  */}
          <Button
            variant="default"
            size={isMobile ? "sm" : "default"}
            onClick={handleShare}
            className="flex items-center"
          >
            <Share2 className="mr-2 h-4 w-4" />
          </Button>

        </div>

      </div>

      {/* Receipt Type Selector */}
      <div className="mb-4 print:hidden">
        <div className="flex items-center space-x-3">
          <label htmlFor="receipt-type" className="text-sm font-medium">
            Receipt Format:
          </label>
          <Select value={receiptType} onValueChange={(value: ReceiptType) => setReceiptType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select receipt type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard Receipt</SelectItem>
              <SelectItem value="thermal">Thermal Receipt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={receiptRef}>
        {receiptType === 'thermal' ? (
          <div ref={thermalReceiptRef}>
            <ThermalReceipt
              sale={sale}
              currency={displayCurrency}
              includePaymentInfo={includePaymentInfo}
            />
          </div>
        ) : (
          <div className={`border-[1.5px] border-black ${isMobile ? 'p-3' : 'p-6'} rounded-md`}>
            <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
              <div className="flex-shrink-0">
                {settings.businessLogo && (
                  <img
                    src={settings.businessLogo}
                    alt="Business Logo"
                    className="h-12 w-auto object-contain max-w-[100px] sm:h-16 sm:max-w-[150px]"
                  />
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-800">{settings.businessName}</div>
                <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>{settings.businessAddress}</div>
                <div className="text-xs text-gray-500">Phone: {settings.businessPhone}</div>
                <div className="text-xs text-gray-500">Email: {settings.businessEmail}</div>
              </div>
            </div>

            <Separator className="my-3 sm:my-4 border-black border-t-[1.5px]" />

            <div className="text-center mb-4">
              <h1 className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} uppercase tracking-wider text-gray-900`}>
                {sale.paymentStatus === 'Quote' ? 'QUOTATION' : (sale.paymentStatus === 'Paid' ? 'SALES RECEIPT' : 'INVOICE')}
              </h1>
            </div>

            <div className="flex justify-between mb-4 sm:mb-6 text-sm flex-wrap gap-2">
              <div>
                <div className="font-semibold">{documentNumberLabel} {sale.receiptNumber}</div>
                <div>Date: {format(receiptDate, 'MMM dd, yyyy')}</div>
                <div>Time: {format(currentDateTime, 'hh:mm a')}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{sale.paymentStatus}</div>
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              <h3 className="font-semibold mb-2 text-sm">Customer Information:</h3>
              <div className="text-sm">
                <div>{sale.customerName}</div>
                <div>{sale.customerAddress}</div>
                <div>{sale.customerContact}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full mb-4 sm:mb-6 text-sm">
                <thead>
                  <tr className="border-b border-black border-b-[1.5px]">
                    <th className="py-2 text-left bg-gray-200 px-2">Description</th>
                    <th className="py-2 text-right bg-gray-200 px-2">Qty</th>
                    <th className="py-2 text-right bg-gray-200 px-2">Unit Price</th>
                    <th className="py-2 text-right bg-gray-200 px-2">Discount</th>
                    <th className="py-2 text-right bg-gray-200 px-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, index) => {
                    const itemSubtotal = item.quantity * item.price;
                    const discountAmount = item.discountType === 'amount'
                      ? (item.discountAmount || 0)
                      : (itemSubtotal * (item.discountPercentage || 0)) / 100;
                    const finalAmount = itemSubtotal - discountAmount;

                    return (
                      <tr key={index} className="border-b border-black">
                        <td className="py-2 sm:py-3">{item.description}</td>
                        <td className="py-2 sm:py-3 text-right">{formatNumber(item.quantity)}</td>
                        <td className="py-2 sm:py-3 text-right">{displayCurrency} {formatNumber(item.price)}</td>
                        <td className="py-2 sm:py-3 text-right">
                          {item.discountType === 'amount'
                            ? (item.discountAmount && item.discountAmount > 0 ? `${displayCurrency} ${formatNumber(item.discountAmount)}` : '-')
                            : ((item.discountPercentage || 0) > 0 ? `${item.discountPercentage}%` : '-')
                          }
                        </td>
                        <td className="py-2 sm:py-3 text-right">{displayCurrency} {formatNumber(finalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalDiscount = sale.items.reduce((total, item) => {
                      const itemSubtotal = item.quantity * item.price;
                      const discountAmount = item.discountType === 'amount'
                        ? (item.discountAmount || 0)
                        : (itemSubtotal * (item.discountPercentage || 0)) / 100;
                      return total + discountAmount;
                    }, 0);

                    return (
                      <>
                        <tr className="border-t border-black border-t-[1.5px]">
                          <td colSpan={4} className="py-2 text-right font-medium bg-gray-200 px-2">Subtotal (before discount):</td>
                          <td className="py-2 text-right bg-gray-200 px-2">{displayCurrency} {formatNumber(subtotal + totalDiscount)}</td>
                        </tr>
                        {totalDiscount > 0 && (
                          <tr>
                            <td colSpan={4} className="py-2 text-right font-medium bg-orange-100 px-2">Total Discount:</td>
                            <td className="py-2 text-right bg-orange-100 px-2">-{displayCurrency} {formatNumber(totalDiscount)}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={4} className="py-2 text-right font-medium bg-gray-200 px-2">Subtotal:</td>
                          <td className="py-2 text-right bg-gray-200 px-2">{displayCurrency} {formatNumber(subtotal)}</td>
                        </tr>
                      </>
                    );
                  })()}
                  {showTaxRow && (
                    <tr>
                      <td colSpan={4} className="py-2 text-right font-medium bg-gray-200 px-2">Tax ({taxRate}%):</td>
                      <td className="py-2 text-right bg-gray-200 px-2">{displayCurrency} {formatNumber(taxAmount)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-black border-t-[1.5px] font-bold">
                    <td colSpan={4} className="py-2 sm:py-3 text-right bg-gray-300 px-2">Total:</td>
                    <td className="py-2 sm:py-3 text-right bg-gray-300 px-2">{displayCurrency} {formatNumber(totalAmount)}</td>
                  </tr>
                  {isInstallmentSale && (
                    <>
                      <tr>
                        <td colSpan={4} className="py-2 text-right font-medium bg-blue-100 px-2">Amount Paid:</td>
                        <td className="py-2 text-right bg-blue-100 px-2">{displayCurrency} {formatNumber(displayAmountPaid)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-2 text-right font-medium bg-red-100 px-2">Amount Due:</td>
                        <td className="py-2 text-right bg-red-100 px-2">{displayCurrency} {formatNumber(displayAmountDue)}</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td colSpan={5} className="py-2 sm:py-3 text-left border-t border-black px-2 italic">
                      <span className="font-medium">Amount in words:</span> {displayCurrency} {totalAmountInWords} only
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {hasPaymentInfo && (
              <div className="mt-4 pt-3 border-t border-black">
                <h3 className="font-semibold text-sm mb-2">Payment Information:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="font-medium py-1 px-2 text-left">Payment Method</th>
                        <th className="font-medium py-1 px-2 text-left">Account Number</th>
                        <th className="font-medium py-1 px-2 text-left">Account Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentMethods
                        .filter(payment => payment.method.trim() !== '' || payment.accountNumber.trim() !== '' || payment.accountName.trim() !== '')
                        .map((payment, index) => (
                          <tr key={index}>
                            <td className="py-1 px-2 font-medium">{payment.method}</td>
                            <td className="py-1 px-2">{payment.accountNumber}</td>
                            <td className="py-1 px-2">{payment.accountName}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sale.notes && (
              <div className="mt-4 pt-3 border-t border-black">
                <h3 className="font-semibold text-sm mb-2">Notes:</h3>
                <div className="text-sm whitespace-pre-wrap">{sale.notes}</div>
              </div>
            )}

            {settings.signature && (
              <div className="mt-6 pt-4 border-t border-black">
                <div className="flex justify-end">
                  <div className="text-center">
                    <img
                      src={settings.signature}
                      alt="Business Signature"
                      className="h-16 object-contain mb-1"
                    />
                    <div className="text-xs text-gray-600 mt-1 font-medium">Authorized Signature</div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-xs sm:text-sm mt-4 sm:mt-8">
              <p className="font-medium">Thank you for your business!</p>
              <p className="text-gray-600 text-xs mt-3">Created by Gonza Systems</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintableReceipt;
