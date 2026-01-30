import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface StockSummaryData {
  productId: string;
  productName: string;
  itemNumber: string;
  openingStock: number;
  itemsSold: number;
  stockIn: number;
  transferOut: number;
  returnIn: number;
  returnOut: number;
  closingStock: number;
}

export const exportStockSummaryToPDF = (
  data: StockSummaryData[],
  period: string,
  dateRange?: { from: Date | undefined; to: Date | undefined }
) => {
  // Create new PDF document in landscape orientation
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margins = { top: 15, right: 15, bottom: 15, left: 15 };
  const contentWidth = pageWidth - margins.left - margins.right;
  
  let currentY = margins.top;

  // Function to add watermark to current page
  const addWatermark = () => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150); // Light gray color
    pdf.text('Created By Gonza Systems', pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0); // Reset to black
  };

  // Table setup - optimized for landscape orientation
  const colWidths = [20, 50, 30, 25, 25, 25, 25, 25, 25]; // Item #, Product, Opening, Sold, Stock In, Transfer Out, Return In, Return Out, Closing
  const rowHeight = 7;
  const headerHeight = 8;

  // Table headers
  const headers = [
    'Item #',
    'Product Name',
    'Opening Stock',
    'Items Sold',
    'Stock In',
    'Transfer Out',
    'Return In',
    'Return Out',
    'Closing Stock'
  ];

  // Function to draw table headers
  const drawTableHeaders = () => {
    // Draw header background
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margins.left, currentY - 2, contentWidth, headerHeight, 'F');

    // Draw header borders
    pdf.setLineWidth(0.2);
    pdf.rect(margins.left, currentY - 2, contentWidth, headerHeight);

    // Header text
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    let currentX = margins.left;
    
    headers.forEach((header, index) => {
      const colWidth = colWidths[index];
      const textWidth = pdf.getTextWidth(header);
      const textX = currentX + (colWidth - textWidth) / 2;
      pdf.text(header, textX, currentY + 5);
      
      if (index < headers.length - 1) {
        pdf.line(currentX + colWidth, currentY - 2, currentX + colWidth, currentY + headerHeight - 2);
      }
      
      currentX += colWidth;
    });

    currentY += headerHeight;
  };

  // Helper function to check if we need a new page
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margins.bottom - 15) { // Reserve space for watermark
      addWatermark(); // Add watermark to current page before creating new one
      pdf.addPage();
      currentY = margins.top;
      drawTableHeaders();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      return true;
    }
    return false;
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  const title = `Stock Summary Report`;
  const titleWidth = pdf.getTextWidth(title);
  pdf.text(title, (pageWidth - titleWidth) / 2, currentY);
  currentY += 8;

  // Date range display - always show exact dates in DD/MM/YYYY format
  if (dateRange?.from && dateRange?.to) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const fromDate = format(dateRange.from, 'dd/MM/yyyy');
    const toDate = format(dateRange.to, 'dd/MM/yyyy');
    
    const dateText = fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
    const dateWidth = pdf.getTextWidth(dateText);
    pdf.text(dateText, (pageWidth - dateWidth) / 2, currentY);
    currentY += 12;
  } else {
    // Fallback to current date if no range provided
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const dateText = format(new Date(), 'dd/MM/yyyy');
    const dateWidth = pdf.getTextWidth(dateText);
    pdf.text(dateText, (pageWidth - dateWidth) / 2, currentY);
    currentY += 12;
  }

  if (data.length === 0) {
    // No data message
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const noDataText = 'No stock data available for the selected period.';
    const noDataWidth = pdf.getTextWidth(noDataText);
    pdf.text(noDataText, (pageWidth - noDataWidth) / 2, currentY + 30);
  } else {
    // Draw initial table headers
    checkPageBreak(headerHeight + 10);
    drawTableHeaders();

    // Table data
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    data.forEach((item, index) => {
      checkPageBreak(rowHeight + 5);

      const rowData = [
        item.itemNumber,
        item.productName,
        item.openingStock.toString(),
        item.itemsSold.toString(),
        item.stockIn.toString(),
        item.transferOut.toString(),
        item.returnIn.toString(),
        item.returnOut.toString(),
        item.closingStock.toString()
      ];

      // Draw row background (alternating)
      if (index % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margins.left, currentY - 1, contentWidth, rowHeight, 'F');
      }

      pdf.setLineWidth(0.1);
      pdf.rect(margins.left, currentY - 1, contentWidth, rowHeight);

      let currentX = margins.left;
      
      rowData.forEach((data, colIndex) => {
        const colWidth = colWidths[colIndex];
        let text = data;
        
        // Truncate text if too long
        if (colIndex === 1) { // Product name
          while (pdf.getTextWidth(text) > colWidth - 2 && text.length > 3) {
            text = text.substring(0, text.length - 4) + '...';
          }
        }
        
        let textX = currentX + 1;
        if (colIndex >= 2) { // Numeric columns
          const textWidth = pdf.getTextWidth(text);
          textX = currentX + colWidth - textWidth - 1;
        } else if (colIndex === 0) { // Item number - center align
          const textWidth = pdf.getTextWidth(text);
          textX = currentX + (colWidth - textWidth) / 2;
        }
        
        pdf.text(text, textX, currentY + 4);
        
        if (colIndex < rowData.length - 1) {
          pdf.line(currentX + colWidth, currentY - 1, currentX + colWidth, currentY + rowHeight - 1);
        }
        
        currentX += colWidth;
      });

      currentY += rowHeight;
    });

    // Summary section - Add more space before summary
    currentY += 15;
    checkPageBreak(35);

    // Summary title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', margins.left, currentY);
    currentY += 8;

    // Calculate totals
    const totalProducts = data.length;
    const totalOpeningStock = data.reduce((sum, item) => sum + item.openingStock, 0);
    const totalItemsSold = data.reduce((sum, item) => sum + item.itemsSold, 0);
    const totalStockIn = data.reduce((sum, item) => sum + item.stockIn, 0);
    const totalClosingStock = data.reduce((sum, item) => sum + item.closingStock, 0);

    // Draw summary box
    const summaryBoxHeight = 30;
    const summaryBoxWidth = contentWidth * 0.8;
    
    pdf.setFillColor(248, 249, 250);
    pdf.rect(margins.left, currentY - 3, summaryBoxWidth, summaryBoxHeight, 'F');
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margins.left, currentY - 3, summaryBoxWidth, summaryBoxHeight);

    // Summary data in two columns
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    const leftColumn = [
      ['Total Products:', totalProducts.toString()],
      ['Total Opening Stock:', totalOpeningStock.toString()],
      ['Total Items Sold:', totalItemsSold.toString()]
    ];

    const rightColumn = [
      ['Total Stock In:', totalStockIn.toString()],
      ['Total Closing Stock:', totalClosingStock.toString()]
    ];

    let summaryY = currentY + 6;
    const leftColumnX = margins.left + 15;
    const rightColumnX = margins.left + summaryBoxWidth / 2 + 15;

    // Draw left column
    leftColumn.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, leftColumnX, summaryY);
      pdf.setFont('helvetica', 'normal');
      const labelWidth = pdf.getTextWidth(label);
      pdf.text(value, leftColumnX + labelWidth + 5, summaryY);
      summaryY += 6;
    });

    // Reset Y for right column
    summaryY = currentY + 6;

    // Draw right column
    rightColumn.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, rightColumnX, summaryY);
      pdf.setFont('helvetica', 'normal');
      const labelWidth = pdf.getTextWidth(label);
      pdf.text(value, rightColumnX + labelWidth + 5, summaryY);
      summaryY += 6;
    });
  }

  // Add watermark to the final page
  addWatermark();

  // Generate filename based on report date range
  let filename: string;
  
  if (dateRange?.from && dateRange?.to) {
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');
    
    if (fromDate === toDate) {
      filename = `stock-summary-${fromDate}.pdf`;
    } else {
      filename = `stock-summary-${fromDate}_to_${toDate}.pdf`;
    }
  } else {
    // Fallback to current date if no range provided
    filename = `stock-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  }

  pdf.save(filename);
};
