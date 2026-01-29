"use client";
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileDown, ChevronDown } from 'lucide-react';
import { Product } from '@/types';
import { formatNumber } from '@/lib/utils';
import ProductImage from './ProductImage';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TopSellingProduct extends Product {
  soldQuantity: number;
}

interface TopSellingProductsTableProps {
  products: TopSellingProduct[];
  onExport?: () => void;
  period?: string;
}

const TopSellingProductsTable: React.FC<TopSellingProductsTableProps> = ({
  products,
  onExport,
  period = 'this-month'
}) => {
  const settings = { currency: 'UGX' };
  const router = useRouter();

  const handleProductClick = (productId: string) => {
    router.push(`/inventory/${productId}`);
  };

  const calculateProfitMargin = (product: TopSellingProduct) => {
    const profit = product.sellingPrice - product.costPrice;
    const margin = product.costPrice > 0 ? (profit / product.costPrice) * 100 : 0;
    return margin;
  };

  const handleCSVExport = () => {
    const headers = [
      'Rank',
      'Item Number',
      'Product Name',
      'Category',
      'Sold Quantity',
      'Available Quantity',
      'Cost Price',
      'Selling Price',
      'Profit Margin (%)'
    ];

    const rows = products.map((product, index) => [
      (index + 1).toString(),
      product.itemNumber,
      product.name,
      product.category,
      product.soldQuantity.toString(),
      product.quantity.toString(),
      product.costPrice.toString(),
      product.sellingPrice.toString(),
      calculateProfitMargin(product).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodLabel = period.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    link.download = `top-selling-products-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePDFExport = () => {
    const doc = new jsPDF('landscape'); // Set to landscape orientation
    const periodLabel = period.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Add title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text('Top Selling Products Report', 14, 22);
    
    // Add period and date
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${periodLabel}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

    // Prepare table data (can show full names now in landscape)
    const tableData = products.map((product, index) => [
      (index + 1).toString(),
      product.itemNumber,
      product.name.length > 40 ? product.name.substring(0, 37) + '...' : product.name,
      product.category.length > 20 ? product.category.substring(0, 17) + '...' : product.category,
      product.soldQuantity.toString(),
      product.quantity.toString(),
      `${settings.currency} ${formatNumber(product.costPrice)}`,
      `${settings.currency} ${formatNumber(product.sellingPrice)}`,
      `${formatNumber(calculateProfitMargin(product))}%`
    ]);

    // Add table with better column widths for landscape
    autoTable(doc, {
      head: [['Rank', 'Item #', 'Product Name', 'Category', 'Sold Qty', 'Available Qty', 'Cost Price', 'Selling Price', 'Profit Margin']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { cellWidth: 35 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'center', cellWidth: 30 },
        6: { halign: 'right', cellWidth: 30 },
        7: { halign: 'right', cellWidth: 30 },
        8: { halign: 'right', cellWidth: 25 }
      }
    });

    // Save the PDF
    doc.save(`top-selling-products-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Export Dropdown */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileDown size={16} />
              Export
              <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport || handleCSVExport}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePDFExport}>
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px] min-w-[60px]">Image</TableHead>
            <TableHead className="w-[100px] min-w-[100px]">Item #</TableHead>
            <TableHead className="min-w-[180px]">Product Name</TableHead>
            <TableHead className="min-w-[120px]">Category</TableHead>
            <TableHead className="w-[80px] min-w-[80px] text-right">Sold Qty</TableHead>
            <TableHead className="w-[100px] min-w-[100px] text-right">Available Qty</TableHead>
            <TableHead className="w-[100px] min-w-[100px] text-right">Cost Price</TableHead>
            <TableHead className="w-[120px] min-w-[120px] text-right">Selling Price</TableHead>
            <TableHead className="w-[100px] min-w-[100px] text-right">Profit Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No sales data for the selected period
              </TableCell>
            </TableRow>
          ) : (
            products.map((product, index) => (
              <TableRow 
                key={product.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleProductClick(product.id)}
              >
                <TableCell>
                  <ProductImage imageUrl={product.imageUrl} alt={product.name} size="sm" />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {product.itemNumber}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <span className="truncate">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="truncate">{product.category}</TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {product.soldQuantity}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {product.quantity % 1 === 0 ? product.quantity : product.quantity.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {settings.currency} {formatNumber(product.costPrice)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {settings.currency} {formatNumber(product.sellingPrice)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <span className={calculateProfitMargin(product) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatNumber(calculateProfitMargin(product))}%
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default TopSellingProductsTable;