import jsPDF from 'jspdf';
import { ReceiptData } from '@/components/types/receipt';

interface VectorPDFOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  returnBlob?: boolean;
}

// Helper function to format currency properly (e.g., "Ush 25,000")
const formatCurrency = (amount: number, currency: string = 'Ush'): string => {
  const formatted = Math.round(amount).toLocaleString();
  return `${currency} ${formatted}`;
};

export const generateReceiptVectorPDF = async (
  receiptData: ReceiptData,
  options: VectorPDFOptions
): Promise<void | Blob> => {
  const {
    filename,
    orientation = 'portrait',
    format = 'a4',
    margins = { top: 20, right: 20, bottom: 20, left: 20 },
    returnBlob = false
  } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;
  let currentY = margins.top;

  // Define thinner line width
  const STANDARD_LINE_WIDTH = 0.2;

  // Helper functions
  const setStandardLineWidth = () => {
    pdf.setLineWidth(STANDARD_LINE_WIDTH);
  };

  const addText = (text: string, x: number, y: number, options: any = {}) => {
    const { fontSize = 10, fontStyle = 'normal', align = 'left', maxWidth } = options;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    
    if (maxWidth) {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y, { align });
      return lines.length * (fontSize * 0.35);
    } else {
      pdf.text(text, x, y, { align });
      return fontSize * 0.35;
    }
  };

  const addMultilineText = (text: string, x: number, y: number, maxWidth: number, options: any = {}) => {
    const { fontSize = 10, fontStyle = 'normal', align = 'left', lineHeight = 1.2 } = options;
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    const lineSpacing = fontSize * 0.35 * lineHeight;
    
    lines.forEach((line: string, index: number) => {
      pdf.text(line, x, y + (index * lineSpacing), { align });
    });
    
    return lines.length * lineSpacing;
  };

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    setStandardLineWidth();
    pdf.line(x1, y1, x2, y2);
  };

  const addRect = (x: number, y: number, width: number, height: number, style: 'S' | 'F' | 'FD' = 'S') => {
    setStandardLineWidth();
    pdf.rect(x, y, width, height, style);
  };

  // Function to draw page border
  const drawPageBorder = () => {
    addRect(margins.left, margins.top, contentWidth, pageHeight - margins.top - margins.bottom, 'S');
  };

  // Check if we need a new page and draw border
  const checkPageBreak = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - margins.bottom) {
      pdf.addPage();
      currentY = margins.top + 10; // Add some top margin on new page
      drawPageBorder(); // Draw border on new page
      return true;
    }
    return false;
  };

  // Draw initial page border
  drawPageBorder();

  // Add padding inside border
  const innerMargin = 8;
  const innerLeft = margins.left + innerMargin;
  const innerWidth = contentWidth - (innerMargin * 2);
  currentY += innerMargin;

  // Header section with logo on left, business info on right
  const headerStartY = currentY;
  
  // Logo on the left (if available) - reduced size
  if (receiptData.businessLogo) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              const dataURL = canvas.toDataURL('image/png');
              
              // Logo dimensions - reduced size for more professional look
              const maxLogoHeight = 15; // Further reduced from 18
              const aspectRatio = img.width / img.height;
              const logoHeight = Math.min(maxLogoHeight, 15);
              const logoWidth = logoHeight * aspectRatio;
              
              // Position logo on the left
              pdf.addImage(dataURL, 'PNG', innerLeft, currentY, logoWidth, logoHeight);
            }
          } catch (error) {
            console.error('Error adding logo to PDF:', error);
          }
          resolve();
        };
        
        img.onerror = () => {
          console.error('Error loading logo image');
          resolve();
        };
        
        img.src = receiptData.businessLogo;
      });
    } catch (error) {
      console.error('Error processing logo:', error);
    }
  }

  // Business information on the right - extended area with right alignment
  const businessInfoX = innerLeft + innerWidth * 0.25; // Extended area starts earlier
  const businessInfoWidth = innerWidth * 0.75; // Wider area for business info
  const businessInfoRightX = innerLeft + innerWidth; // Right edge for alignment
  let businessY = currentY;

  if (receiptData.businessName) {
    businessY += addText(receiptData.businessName, businessInfoRightX, businessY, {
      fontSize: 14,
      fontStyle: 'bold',
      align: 'right'
    });
    businessY += 1.5; // Reduced spacing
  }

  if (receiptData.businessAddress) {
    const lines = pdf.splitTextToSize(receiptData.businessAddress, businessInfoWidth);
    const lineHeight = 10 * 0.35 * 0.9; // Further reduced line height
    
    lines.forEach((line: string, index: number) => {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(line, businessInfoRightX, businessY + (index * lineHeight), { align: 'right' });
    });
    
    businessY += lines.length * lineHeight + 0.5; // Reduced spacing
  }

  if (receiptData.businessPhone) {
    businessY += addText(`Phone: ${receiptData.businessPhone}`, businessInfoRightX, businessY, {
      fontSize: 9,
      align: 'right'
    });
    businessY += 0.5; // Reduced spacing
  }

  if (receiptData.businessEmail) {
    businessY += addText(`Email: ${receiptData.businessEmail}`, businessInfoRightX, businessY, {
      fontSize: 9,
      align: 'right'
    });
    businessY += 0.5; // Reduced spacing
  }

  // Move currentY to after header section - reduced spacing
  currentY = Math.max(currentY + 18, businessY) + 5; // Further reduced spacing

  // Check for page break after header
  checkPageBreak(20);

  // Horizontal line after header
  addLine(innerLeft, currentY, innerLeft + innerWidth, currentY);
  currentY += 6; // Reduced from 8

  // Document title centered
  currentY += addText(receiptData.documentTitle.toUpperCase(), pageWidth / 2, currentY, {
    fontSize: 16,
    fontStyle: 'bold',
    align: 'center'
  });
  currentY += 4; // Reduced from 6

  // Receipt details section - further reduced spacing
  const detailsStartY = currentY;
  
  // Left side - Receipt details with minimal spacing
  let leftY = detailsStartY;
  leftY += addText(`${receiptData.documentNumberLabel} ${receiptData.receiptNumber}`, innerLeft, leftY, {
    fontSize: 11,
    fontStyle: 'bold'
  });
  leftY += 2; // Further reduced from 3
  
  leftY += addText(`Date: ${receiptData.date}`, innerLeft, leftY, {
    fontSize: 10
  });
  leftY += 2; // Further reduced from 3
  
  leftY += addText(`Time: ${receiptData.time}`, innerLeft, leftY, {
    fontSize: 10
  });

  // Right side - Payment status
  const rightX = innerLeft + innerWidth * 0.7;
  addText(`Status: ${receiptData.status}`, rightX, detailsStartY, {
    fontSize: 11,
    fontStyle: 'bold',
    align: 'left'
  });

  currentY = leftY + 4; // Reduced from 6

  // Customer information without labels
  if (receiptData.customerName && receiptData.customerName.trim() !== '') {
    checkPageBreak(30);
    
    currentY += addText('Customer Information:', innerLeft, currentY, {
      fontSize: 11,
      fontStyle: 'bold'
    });
    currentY += 3; // Reduced from 4

    // Customer name without "Name:" label
    currentY += addText(receiptData.customerName, innerLeft, currentY, {
      fontSize: 10
    });
    currentY += 2.5; // Reduced spacing

    if (receiptData.customerAddress && receiptData.customerAddress.trim() !== '') {
      // Customer address without "Address:" label
      const addressHeight = addMultilineText(receiptData.customerAddress, innerLeft, currentY, innerWidth * 0.8, {
        fontSize: 10,
        lineHeight: 1.0 // Reduced from 1.1
      });
      currentY += addressHeight;
      currentY += 2.5; // Reduced spacing
    }

    if (receiptData.customerContact && receiptData.customerContact.trim() !== '') {
      // Customer contact without "Contact:" label
      currentY += addText(receiptData.customerContact, innerLeft, currentY, {
        fontSize: 10
      });
      currentY += 2.5; // Reduced spacing
    }

    currentY += 3; // Reduced from 6
  }

  // Items table - check if any items have discounts to add discount column
  const hasDiscounts = receiptData.items.some(item => 
    (item.discountPercentage || 0) > 0 || (item.discountAmount || 0) > 0
  );
  const tableHeaders = hasDiscounts 
    ? ['Description', 'Qty', 'Unit Price', 'Discount', 'Amount']
    : ['Description', 'Qty', 'Unit Price', 'Amount'];
  const colWidths = hasDiscounts
    ? [innerWidth * 0.35, innerWidth * 0.15, innerWidth * 0.18, innerWidth * 0.12, innerWidth * 0.2]
    : [innerWidth * 0.45, innerWidth * 0.15, innerWidth * 0.2, innerWidth * 0.2];
  
  // Table header background
  pdf.setFillColor(245, 245, 245);
  addRect(innerLeft, currentY - 2, innerWidth, 10, 'F');
  
  // Table header borders
  addRect(innerLeft, currentY - 2, innerWidth, 10, 'S');
  
  // Table header text
  let tableX = innerLeft;
  tableHeaders.forEach((header, index) => {
    addText(header, tableX + 3, currentY + 4, {
      fontSize: 10,
      fontStyle: 'bold'
    });
    // Add vertical lines between columns
    if (index < tableHeaders.length - 1) {
      addLine(tableX + colWidths[index], currentY - 2, tableX + colWidths[index], currentY + 8);
    }
    tableX += colWidths[index];
  });
  
  currentY += 10;
  
  // Table rows with proper text wrapping and row separation
  let subtotal = 0;
  const minRowHeight = 8; // Minimum row height
  
  receiptData.items.forEach((item, index) => {
    // Calculate required row height based on description text wrapping
    pdf.setFontSize(9);
    const descriptionLines = pdf.splitTextToSize(item.description, colWidths[0] - 6);
    const calculatedRowHeight = Math.max(minRowHeight, descriptionLines.length * 3.5 + 4);
    
    // Check if we need a new page for this item
    checkPageBreak(calculatedRowHeight + 5);
    
    const itemSubtotal = item.unitPrice * item.quantity;
    const discountAmount = item.discountAmount || 0;
    const itemTotal = item.amount; // This should already be calculated with discount applied
    subtotal += itemTotal;
    
    // Alternate row background for better readability
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      addRect(innerLeft, currentY, innerWidth, calculatedRowHeight, 'F');
    }
    
    // Row border
    addRect(innerLeft, currentY, innerWidth, calculatedRowHeight, 'S');
    
    tableX = innerLeft;
    
    // Description with proper text wrapping
    addMultilineText(item.description, tableX + 3, currentY + 4, colWidths[0] - 6, {
      fontSize: 9,
      lineHeight: 1.1
    });
    tableX += colWidths[0];
    
    // Add vertical line after description
    addLine(tableX, currentY, tableX, currentY + calculatedRowHeight);
    
    // Quantity - centered in cell
    addText(item.quantity.toString(), tableX + colWidths[1] - 3, currentY + calculatedRowHeight/2 + 1.5, {
      fontSize: 9,
      align: 'right'
    });
    tableX += colWidths[1];
    
    // Add vertical line after quantity
    addLine(tableX, currentY, tableX, currentY + calculatedRowHeight);
    
    // Unit Price - right aligned
    addText(formatCurrency(item.unitPrice, receiptData.currency), tableX + colWidths[2] - 3, currentY + calculatedRowHeight/2 + 1.5, {
      fontSize: 9,
      align: 'right'
    });
    tableX += colWidths[2];
    
    // Add vertical line after unit price
    addLine(tableX, currentY, tableX, currentY + calculatedRowHeight);
    
    // Discount column (if applicable)
    if (hasDiscounts) {
      let discountText = '-';
      if ((item.discountPercentage || 0) > 0) {
        discountText = `${item.discountPercentage}%`;
      } else if ((item.discountAmount || 0) > 0) {
        discountText = formatCurrency(item.discountAmount, receiptData.currency);
      }
      addText(discountText, tableX + colWidths[3] - 3, currentY + calculatedRowHeight/2 + 1.5, {
        fontSize: 9,
        align: 'right'
      });
      tableX += colWidths[3];
      
      // Add vertical line after discount
      addLine(tableX, currentY, tableX, currentY + calculatedRowHeight);
    }
    
    // Amount - right aligned (final amount after discount)
    const finalColumnIndex = hasDiscounts ? 4 : 3;
    addText(formatCurrency(itemTotal, receiptData.currency), tableX + colWidths[finalColumnIndex] - 3, currentY + calculatedRowHeight/2 + 1.5, {
      fontSize: 9,
      align: 'right'
    });
    
    currentY += calculatedRowHeight;
    
    // Add separator line between items (except for the last item)
    if (index < receiptData.items.length - 1) {
      addLine(innerLeft, currentY, innerLeft + innerWidth, currentY);
    }
  });
  
  currentY += 5; // Reduced from 10
  
  // Professional totals section with improved layout for large figures
  checkPageBreak(70); // Increased space requirement for installment sales
  
  // Create a proper totals table without header
  const totalsStartX = innerLeft + innerWidth * 0.45;
  const totalsWidth = innerWidth * 0.55;
  const labelWidth = totalsWidth * 0.55;
  const valueWidth = totalsWidth * 0.45;
  
  // Calculate total discount for the totals section
  const totalDiscount = receiptData.items.reduce((total, item) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    const discountAmount = (item.discountType === 'amount') 
      ? (item.discountAmount || 0)
      : (itemSubtotal * (item.discountPercentage || 0)) / 100;
    return total + discountAmount;
  }, 0);
  
  // Subtotal (before discount) row - only show if there are discounts
  if (totalDiscount > 0) {
    addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
    pdf.setFillColor(248, 248, 248);
    addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
    
    addText('Subtotal (before discount):', totalsStartX + 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal'
    });
    
    // Vertical line separating label and value
    addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
    
    addText(formatCurrency(subtotal + totalDiscount, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'right'
    });
    currentY += 8;
    
    // Total discount row
    addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
    pdf.setFillColor(255, 240, 220); // Light orange background
    addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
    
    addText('Total Discount:', totalsStartX + 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal'
    });
    
    // Vertical line separating label and value
    addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
    
    addText(`-${formatCurrency(totalDiscount, receiptData.currency)}`, totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'right'
    });
    currentY += 8;
  }
  
  // Subtotal row (after discount or just subtotal if no discounts)
  addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
  pdf.setFillColor(248, 248, 248);
  addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
  
  addText(totalDiscount > 0 ? 'Subtotal (after discount):' : 'Subtotal:', totalsStartX + 4, currentY + 5.5, {
    fontSize: 10,
    fontStyle: 'normal'
  });
  
  // Vertical line separating label and value
  addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
  
  addText(formatCurrency(subtotal, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
    fontSize: 10,
    fontStyle: 'normal',
    align: 'right'
  });
  currentY += 8;
  
  // Tax row (if applicable)
  if (receiptData.showTaxRow && receiptData.taxAmount > 0) {
    addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
    pdf.setFillColor(250, 250, 250);
    addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
    
    addText(`Tax (${receiptData.taxRate}%):`, totalsStartX + 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal'
    });
    
    // Vertical line separating label and value
    addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
    
    addText(formatCurrency(receiptData.taxAmount, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'right'
    });
    currentY += 8;
  }
  
  // Total row with emphasis and larger height for big figures
  addRect(totalsStartX, currentY, totalsWidth, 12, 'S');
  pdf.setFillColor(220, 220, 220);
  addRect(totalsStartX, currentY, totalsWidth, 12, 'F');
  
  addText('TOTAL:', totalsStartX + 4, currentY + 7.5, {
    fontSize: 12,
    fontStyle: 'bold'
  });
  
  // Vertical line separating label and value
  addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 12);
  
  addText(formatCurrency(receiptData.totalAmount, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 7.5, {
    fontSize: 12,
    fontStyle: 'bold',
    align: 'right'
  });
  currentY += 12;

  // Add Amount Paid and Amount Due for installment sales
  if (receiptData.isInstallmentSale) {
    // Amount Paid row
    if (receiptData.amountPaid !== undefined) {
      addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
      pdf.setFillColor(240, 248, 255); // Light blue background
      addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
      
      addText('Amount Paid:', totalsStartX + 4, currentY + 5.5, {
        fontSize: 10,
        fontStyle: 'bold'
      });
      
      // Vertical line separating label and value
      addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
      
      addText(formatCurrency(receiptData.amountPaid, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
        fontSize: 10,
        fontStyle: 'bold',
        align: 'right'
      });
      currentY += 8;
    }
    
    // Amount Due row
    if (receiptData.amountDue !== undefined) {
      addRect(totalsStartX, currentY, totalsWidth, 8, 'S');
      pdf.setFillColor(255, 240, 240); // Light red background
      addRect(totalsStartX, currentY, totalsWidth, 8, 'F');
      
      addText('Amount Due:', totalsStartX + 4, currentY + 5.5, {
        fontSize: 10,
        fontStyle: 'bold'
      });
      
      // Vertical line separating label and value
      addLine(totalsStartX + labelWidth, currentY, totalsStartX + labelWidth, currentY + 8);
      
      addText(formatCurrency(receiptData.amountDue, receiptData.currency), totalsStartX + labelWidth + valueWidth - 4, currentY + 5.5, {
        fontSize: 10,
        fontStyle: 'bold',
        align: 'right'
      });
      currentY += 8;
    }
  }
  
  currentY += 7; // Reduced from 15

  // Amount in words with slightly increased spacing
  if (receiptData.totalAmountInWords) {
    checkPageBreak(20);
    
    currentY += 2; // Keep existing spacing
    addText('Amount in words:', innerLeft, currentY, {
      fontSize: 10,
      fontStyle: 'bold'
    });
    currentY += 4; // Increased from 3 to 4
    
    // Better text wrapping for amount in words with increased line height
    const amountText = `${receiptData.currency} ${receiptData.totalAmountInWords} only`;
    const wordsHeight = addMultilineText(amountText, innerLeft, currentY, innerWidth * 0.9, {
      fontSize: 10,
      fontStyle: 'italic',
      lineHeight: 1.4 // Increased from 1.2 to 1.4 for better spacing
    });
    currentY += wordsHeight + 4; // Increased from 3 to 4
  }

  // Improved Payment information table with reduced spacing
  if (receiptData.hasPaymentInfo && receiptData.paymentMethods && receiptData.paymentMethods.length > 0) {
    checkPageBreak(40);
    
    // Strong separator line with reduced spacing
    addLine(innerLeft, currentY, innerLeft + innerWidth, currentY);
    currentY += 5; // Reduced from 8

    addText('Payment Information:', innerLeft, currentY, {
      fontSize: 11,
      fontStyle: 'bold'
    });
    currentY += 4; // Reduced from 6

    // Payment table with better proportions
    const paymentHeaders = ['Payment Method', 'Account Number', 'Account Name'];
    const paymentColWidths = [innerWidth * 0.28, innerWidth * 0.36, innerWidth * 0.36];
    
    // Header background with stronger color
    pdf.setFillColor(240, 240, 240);
    const headerHeight = 10;
    addRect(innerLeft, currentY - 2, innerWidth, headerHeight, 'F');
    addRect(innerLeft, currentY - 2, innerWidth, headerHeight, 'S');
    
    // Header text with proper spacing
    let paymentX = innerLeft;
    paymentHeaders.forEach((header, index) => {
      addText(header, paymentX + 4, currentY + 4, {
        fontSize: 9,
        fontStyle: 'bold'
      });
      if (index < paymentHeaders.length - 1) {
        addLine(paymentX + paymentColWidths[index], currentY - 2, paymentX + paymentColWidths[index], currentY + headerHeight - 2);
      }
      paymentX += paymentColWidths[index];
    });
    
    currentY += headerHeight;
    
    // Payment rows with consistent formatting
    const validPayments = receiptData.paymentMethods.filter(payment => 
      payment.method.trim() || payment.accountNumber.trim() || payment.accountName.trim()
    );
    
    validPayments.forEach((payment, index) => {
      const rowHeight = 10;
      checkPageBreak(rowHeight + 5);
      
      // Alternating row colors
      if (index % 2 === 1) {
        pdf.setFillColor(248, 248, 248);
        addRect(innerLeft, currentY, innerWidth, rowHeight, 'F');
      }
      
      // Row border
      addRect(innerLeft, currentY, innerWidth, rowHeight, 'S');
      
      paymentX = innerLeft;
      
      // Payment method
      addText(payment.method, paymentX + 4, currentY + 5, {
        fontSize: 9,
        fontStyle: 'bold'
      });
      paymentX += paymentColWidths[0];
      addLine(paymentX, currentY, paymentX, currentY + rowHeight);
      
      // Account number
      addText(payment.accountNumber, paymentX + 4, currentY + 5, {
        fontSize: 9
      });
      paymentX += paymentColWidths[1];
      addLine(paymentX, currentY, paymentX, currentY + rowHeight);
      
      // Account name
      addText(payment.accountName, paymentX + 4, currentY + 5, {
        fontSize: 9
      });
      
      currentY += rowHeight;
    });
    
    currentY += 4; // Reduced from 8
  }

  // Notes section (if available)
  if (receiptData.notes && receiptData.notes.trim()) {
    checkPageBreak(25);
    
    // Add separator line
    addLine(innerLeft, currentY, innerLeft + innerWidth, currentY);
    currentY += 4;
    
    // Notes title
    addText('Notes:', innerLeft, currentY, {
      fontSize: 11,
      fontStyle: 'bold'
    });
    currentY += 6;
    
    // Notes content with text wrapping
    const maxWidth = innerWidth - 8;
    const lines = pdf.splitTextToSize(receiptData.notes, maxWidth);
    
    lines.forEach((line: string) => {
      checkPageBreak(8);
      addText(line, innerLeft + 4, currentY, {
        fontSize: 10
      });
      currentY += 5;
    });
    
    currentY += 4;
  }

  // Signature section (if available) with reduced spacing
  if (receiptData.signature) {
    try {
      checkPageBreak(35);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              const dataURL = canvas.toDataURL('image/png');
              
              // Calculate signature dimensions while maintaining aspect ratio
              const maxSigWidth = 40;
              const maxSigHeight = 20;
              const aspectRatio = img.width / img.height;
              
              let sigWidth, sigHeight;
              
              // Calculate dimensions based on aspect ratio
              if (aspectRatio > (maxSigWidth / maxSigHeight)) {
                // Image is wider, constrain by width
                sigWidth = maxSigWidth;
                sigHeight = maxSigWidth / aspectRatio;
              } else {
                // Image is taller, constrain by height
                sigHeight = maxSigHeight;
                sigWidth = maxSigHeight * aspectRatio;
              }
              
              // Position signature on the right
              const sigX = innerLeft + innerWidth - sigWidth;
              
              addLine(innerLeft, currentY, innerLeft + innerWidth, currentY);
              currentY += 4; // Reduced from 6
              
              pdf.addImage(dataURL, 'PNG', sigX, currentY, sigWidth, sigHeight);
              currentY += sigHeight + 2; // Reduced from 3
              
              addText('Authorized Signature', sigX + sigWidth / 2, currentY, {
                fontSize: 8,
                align: 'center'
              });
              currentY += 4; // Reduced from 6
            }
          } catch (error) {
            console.error('Error adding signature to PDF:', error);
          }
          resolve();
        };
        
        img.onerror = () => {
          console.error('Error loading signature image');
          resolve();
        };
        
        img.src = receiptData.signature;
      });
    } catch (error) {
      console.error('Error processing signature:', error);
    }
  }

  // Footer message with reduced spacing
  checkPageBreak(25);
  currentY += 6; // Reduced from 8
  addText('Thank you for your business!', pageWidth / 2, currentY, {
    fontSize: 11,
    fontStyle: 'bold',
    align: 'center'
  });
  
  currentY += 5; // Add spacing between messages
  addText('Created by Gonza Systems', pageWidth / 2, currentY, {
    fontSize: 9,
    align: 'center'
  });

  // Return blob or download
  if (returnBlob) {
    return pdf.output('blob');
  } else if (filename) {
    pdf.save(filename);
  }
};
