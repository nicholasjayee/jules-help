import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Product, StockHistoryEntry } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Edit, Package, AlertCircle, ArrowLeft, Trash2, Copy, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import DeleteProductDialog from './DeleteProductDialog';
import { useProducts } from '@/hooks/useProducts';
import { useStockHistory } from '@/hooks/useStockHistory';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface ProductDetailsProps {
  product: Product;
  stockHistory: StockHistoryEntry[];
  isLoadingHistory: boolean;
  onStockUpdate?: () => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({
  product,
  stockHistory,
  onStockUpdate
}) => {
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const { user } = useAuth();
  const { updateProduct, deleteProduct } = useProducts(user?.id);
  const { createStockHistoryEntry, stockHistory: allStockHistory } = useStockHistory(user?.id, product.id);
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'Stock In' | 'Transfer Out' | 'Return In' | 'Return Out'>('Stock In');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentDate, setAdjustmentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adjustmentTime, setAdjustmentTime] = useState<string>(new Date().toTimeString().split(' ')[0]);
  const [isApplying, setIsApplying] = useState(false);

  const handleDeleteProduct = async () => {
    const result = await deleteProduct(product.id);
    if (result) {
      toast({
        title: "Product deleted",
        description: "The product has been removed from your inventory.",
      });
      navigate('/products');
      return true;
    }
    return false;
  };

  const handleDuplicateProduct = () => {
    // Navigate to new product page with product data for duplication
    navigate('/inventory/new', {
      state: {
        duplicateData: {
          name: `${product.name} (Copy)`,
          description: product.description,
          category: product.category,
          supplier: product.supplier,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          imageUrl: product.imageUrl,
          createdAt: product.createdAt,
          minimumStock: product.minimumStock
        }
      }
    });
  };

  const getStockStatusBadge = () => {
    if (product.quantity === 0) {
      return <Badge variant="destructive" className="text-sm">Out of stock</Badge>;
    }

    if (product.quantity <= product.minimumStock) {
      return <Badge variant="warning" className="bg-amber-500 text-sm">Low stock</Badge>;
    }

    return <Badge variant="success" className="bg-green-600 text-sm">In stock</Badge>;
  };

  // Get the initial stock date (chronologically first entry)
  const getInitialStockDate = (): Date | null => {
    const historyToCheck = stockHistory.length > 0 ? stockHistory : allStockHistory;
    if (historyToCheck.length === 0) return null;
    const sortedHistory = [...historyToCheck].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sortedHistory[0]?.createdAt || null;
  };

  const validateAdjustmentDateTime = (dateStr: string, timeStr: string): string => {
    if (!dateStr) return '';

    const initialStockDate = getInitialStockDate();
    if (!initialStockDate) return '';

    // Create the proposed datetime with selected date and time
    const [year, month, day] = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);
    const [hours, minutes, seconds = 0] = timeParts;
    const proposedDateTime = new Date(year, month - 1, day, hours, minutes, seconds);

    if (proposedDateTime < initialStockDate) {
      return `Date and time cannot be before the initial stock date and time (${format(initialStockDate, 'PPP p')})`;
    }

    return '';
  };

  const handleStockAdjustment = async () => {
    if (!adjustmentQuantity || adjustmentQuantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity greater than zero",
        variant: "destructive"
      });
      return;
    }

    // Validate adjustment date and time
    const dateTimeError = validateAdjustmentDateTime(adjustmentDate, adjustmentTime);
    if (dateTimeError) {
      toast({
        title: "Invalid date/time",
        description: dateTimeError,
        variant: "destructive"
      });
      return;
    }

    setIsApplying(true);

    try {
      const previousQuantity = product.quantity;
      let newQuantity = previousQuantity;
      // Use standardized reason format for stock summary mapping
      let changeReason = adjustmentReason.trim()
        ? `${adjustmentType}: ${adjustmentReason}`
        : adjustmentType;

      switch (adjustmentType) {
        case 'Stock In':
        case 'Return In':
          newQuantity = previousQuantity + adjustmentQuantity;
          break;
        case 'Transfer Out':
        case 'Return Out':
          newQuantity = Math.max(0, previousQuantity - adjustmentQuantity);
          if (newQuantity === 0 && previousQuantity < adjustmentQuantity) {
            toast({
              title: "Warning",
              description: `Attempted to remove ${adjustmentQuantity} items but only ${previousQuantity} were available. Stock is now 0.`
            });
          }
          break;
      }

      // Create proper datetime for the adjustment using selected date and time
      const [year, month, day] = adjustmentDate.split('-').map(Number);
      const timeParts = adjustmentTime.split(':').map(Number);
      const [hours, minutes, seconds = 0] = timeParts;
      const adjustmentDateTime = new Date(year, month - 1, day, hours, minutes, seconds);

      // Create the stock history entry which will automatically recalculate the stock chain
      const historyCreated = await createStockHistoryEntry(
        product.id,
        previousQuantity,
        newQuantity,
        changeReason,
        undefined,
        adjustmentDateTime,
        undefined,
        product.name
      );

      // If history was created successfully, update the product quantity
      const result = historyCreated ? await updateProduct(product.id, {
        quantity: newQuantity
      }, undefined, false, 'skip-history') : false; // Use a special flag to skip history creation

      if (result) {
        toast({
          title: "Stock updated",
          description: `${adjustmentType} of ${adjustmentQuantity} items processed. Stock chain recalculated automatically.`
        });

        // Reset form
        setAdjustmentQuantity(0);
        setAdjustmentReason("");
        setAdjustmentDate(new Date().toISOString().split('T')[0]);
        setAdjustmentTime(new Date().toTimeString().split(' ')[0]);

        // Trigger refresh of product data
        if (onStockUpdate) {
          onStockUpdate();
        }
      }
    } catch (error) {
      console.error('Error applying stock adjustment:', error);
      toast({
        title: "Error",
        description: "Failed to apply stock adjustment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Navigation and Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
        <div className="flex flex-col space-y-3 lg:flex-row lg:justify-between lg:items-center lg:space-y-0 lg:gap-4">
          {/* Navigation and Refresh - Same Line */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/products')}
              className="flex items-center gap-2 hover:bg-gray-50 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onStockUpdate}
              className="flex items-center gap-1 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2 lg:flex-row lg:items-center lg:space-y-0 lg:gap-2">
            {/* Duplicate Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateProduct}
              className="flex items-center justify-center gap-2 w-full lg:w-auto hover:bg-blue-50 hover:border-blue-300 text-sm"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>

            {/* Primary Action - Edit Button with Secondary Color */}
            <Button
              onClick={() => navigate(`/inventory/edit/${product.id}`)}
              className="flex items-center justify-center gap-2 w-full lg:w-auto bg-secondary hover:bg-secondary/90 text-sm"
              size="sm"
            >
              <Edit className="h-4 w-4" />
              Edit Product
            </Button>

            {/* Delete Button - Below Edit */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center justify-center gap-2 w-full lg:w-auto text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Product Details</span>
              {getStockStatusBadge()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              {product.imageUrl && (
                <div className="md:w-1/3">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-auto object-contain border rounded-md"
                  />
                </div>
              )}

              <div className={product.imageUrl ? 'md:w-2/3' : 'w-full'}>
                <h2 className="text-2xl font-bold mb-2">{product.name}</h2>

                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{product.category}</Badge>
                  <Badge variant="secondary">#{product.itemNumber}</Badge>
                </div>

                {product.description && (
                  <p className="text-gray-700 mb-4">{product.description}</p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <dt className="text-gray-500">Item Number:</dt>
                  <dd className="font-semibold">#{product.itemNumber}</dd>

                  <dt className="text-gray-500">Quantity in Stock:</dt>
                  <dd className="font-semibold">{product.quantity % 1 === 0 ? product.quantity : product.quantity.toFixed(2)}</dd>

                  <dt className="text-gray-500">Minimum Stock Level:</dt>
                  <dd>{product.minimumStock}</dd>

                  <dt className="text-gray-500">Cost Price:</dt>
                  <dd>{settings.currency} {formatNumber(product.costPrice)}</dd>

                  <dt className="text-gray-500">Selling Price:</dt>
                  <dd>{settings.currency} {formatNumber(product.sellingPrice)}</dd>

                  <dt className="text-gray-500">Total Cost:</dt>
                  <dd className="font-semibold">{settings.currency} {formatNumber(product.quantity * product.costPrice)}</dd>

                  <dt className="text-gray-500">Profit Margin:</dt>
                  <dd>{((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(2)}%</dd>

                  {product.supplier && (
                    <>
                      <dt className="text-gray-500">Supplier:</dt>
                      <dd>{product.supplier}</dd>
                    </>
                  )}

                  <dt className="text-gray-500">Created:</dt>
                  <dd>{format(product.createdAt, 'MMM d, yyyy')}</dd>

                  <dt className="text-gray-500">Last Updated:</dt>
                  <dd>{format(product.updatedAt, 'MMM d, yyyy')}</dd>
                </dl>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {product.quantity <= product.minimumStock && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 w-full flex items-center gap-3">
                  <AlertCircle className="text-amber-600 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-800">Low Stock Alert</h4>
                    <p className="text-sm text-amber-700">
                      Current stock ({product.quantity}) is below or equal to the minimum threshold ({product.minimumStock}).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Stock Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Adjustment Type</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button
                      type="button"
                      variant={adjustmentType === 'Stock In' ? 'default' : 'outline'}
                      onClick={() => setAdjustmentType('Stock In')}
                      className="w-full"
                    >
                      Stock In
                    </Button>
                    <Button
                      type="button"
                      variant={adjustmentType === 'Transfer Out' ? 'default' : 'outline'}
                      onClick={() => setAdjustmentType('Transfer Out')}
                      className="w-full"
                    >
                      Transfer Out
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={adjustmentType === 'Return In' ? 'default' : 'outline'}
                      onClick={() => setAdjustmentType('Return In')}
                      className="w-full"
                    >
                      Return In
                    </Button>
                    <Button
                      type="button"
                      variant={adjustmentType === 'Return Out' ? 'default' : 'outline'}
                      onClick={() => setAdjustmentType('Return Out')}
                      className="w-full"
                    >
                      Return Out
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={adjustmentQuantity || ''}
                    onChange={(e) => setAdjustmentQuantity(parseInt(e.target.value) || 0)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                  <Input
                    type="text"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="e.g., Weekly restock, Damaged goods"
                    maxLength={100}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <Input
                      type="date"
                      value={adjustmentDate}
                      onChange={(e) => setAdjustmentDate(e.target.value)}
                      min={product.createdAt ? new Date(product.createdAt).toISOString().split('T')[0] : undefined}
                      max={new Date().toISOString().split('T')[0]}
                      className={validateAdjustmentDateTime(adjustmentDate, adjustmentTime) ? 'border-destructive border-2 bg-destructive/5' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time</label>
                    <Input
                      type="time"
                      step="1"
                      value={adjustmentTime}
                      onChange={(e) => setAdjustmentTime(e.target.value)}
                      className={validateAdjustmentDateTime(adjustmentDate, adjustmentTime) ? 'border-destructive border-2 bg-destructive/5' : ''}
                    />
                  </div>
                </div>
                {validateAdjustmentDateTime(adjustmentDate, adjustmentTime) && (
                  <p className="text-sm text-destructive mt-1">{validateAdjustmentDateTime(adjustmentDate, adjustmentTime)}</p>
                )}

                <Button
                  onClick={handleStockAdjustment}
                  disabled={isApplying || adjustmentQuantity <= 0 || !!validateAdjustmentDateTime(adjustmentDate, adjustmentTime)}
                  className="w-full"
                >
                  <Package className="mr-2 h-4 w-4" />
                  {isApplying ? 'Applying...' : `Apply ${adjustmentType}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteProductDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        product={product}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
};

export default ProductDetails;